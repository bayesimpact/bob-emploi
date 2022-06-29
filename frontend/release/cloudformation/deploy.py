#!/usr/bin/env python3
"""Script to deploy new versions of cloudformation configurations.

Uses awscli (usually installed by pip).
"""

import argparse
import difflib
import functools
import hashlib
import json
import logging
from os import path
import re
import subprocess
import sys
import threading
import time
import typing
from typing import Any, Iterator, Mapping, Optional, TypedDict
import unittest
from urllib import parse

from botocore import exceptions

if typing.TYPE_CHECKING:
    class _DeploymentDict(TypedDict, total=False):
        deployment: str
        deprecatedFor: str
        region: str
        stackId: str

    class _TemplateOutput(TypedDict):
        Description: str

    class _TemplateParameterDefBase(TypedDict):
        Type: str
        Description: str

    class _TemplateParameterDef(_TemplateParameterDefBase, TypedDict, total=False):
        Default: str

    class _TemplateResourceBase(TypedDict):
        Properties: dict[str, Any]
        Type: str

    class _TemplateResource(_TemplateResourceBase, TypedDict, total=False):
        DependsOn: list[str]

    class _TemplateJson(TypedDict):
        Outputs: dict[str, _TemplateOutput]
        Parameters: dict[str, _TemplateParameterDef]
        Resources: dict[str, _TemplateResource]

    class _RequestParameter(TypedDict, total=False):
        ParameterKey: str
        ParameterValue: str
        UsePreviousValue: bool

    class _UploadArgs(typing.Protocol):
        change_set_name: str
        deployments: list['_Deployment']
        dry_run: bool

    _Arg = typing.TypeVar('_Arg', bound='_UploadArgs')

    class _ParamArgs(_UploadArgs, typing.Protocol):
        parameters: list['_TemplateParameter']

    class _CheckArgs(_UploadArgs, typing.Protocol):
        revision: str

    class _UrlArgs(typing.Protocol):
        template: str


# Absolute path to the directory of the current file.
# Used to reference the following files:
# - main_template.json which is the cloudformation template, in this directory
# - stack_deployments.json which has all the needed information about Bob's deployments.
#     Currently in the parent directory (frontend/release).
_DIRNAME = path.dirname(path.abspath(__file__))

_SUBSTITUTION_PATTERN = re.compile(r'\${.*\}')


def _run_git(*cmd: str) -> str:
    return subprocess.check_output(['git'] + list(cmd), text=True).strip()


# TODO(cyrille): Find a way to call botocore directly.
def _run_aws(*cmd: str) -> str:
    try:
        return subprocess.check_output(['aws'] + list(cmd), text=True).strip()
    except subprocess.CalledProcessError as error:
        raise exceptions.ClientError({}, cmd[0]) from error


@functools.cache
def _get_git_dirname() -> str:
    return path.dirname(_run_git('ls-files', path.abspath(__file__))) or '.'


def stringify(json_value: Any) -> str:
    """Canonical way to stringify a JSON value."""

    # TODO(cyrille): Add sort_keys=True.
    return json.dumps(json_value, indent=2)


@functools.cache
def _get_deployments() -> dict[str, '_DeploymentDict']:
    file_name = path.join(path.dirname(_DIRNAME), 'stack_deployments.json')
    with open(file_name, 'rb') as file:
        all_deployments = typing.cast(list['_DeploymentDict'], json.load(file))
    return {d['deployment']: d for d in all_deployments}


class _Deployment(typing.NamedTuple):
    id: str
    region: str
    stack_name: str

    def __str__(self) -> str:
        """Output only the ID, for the argparse choices output."""

        return self.id

    @staticmethod
    def from_name(deployment: str, warn_on_deprecated: bool = True) -> '_Deployment':
        """Parse from JSON."""

        all_deployments = _get_deployments()
        try:
            dep = all_deployments[deployment]
        except KeyError as error:
            raise ValueError(
                f'Use an existing deployment name: {", ".join(all_deployments)}') from error
        try:
            deprecated_for = dep['deprecatedFor']
            if warn_on_deprecated:
                logging.warning(
                    'Deployment %s is deprecated, use %s instead.', deployment, deprecated_for)
            return _Deployment.from_name(deprecated_for)
        except KeyError:
            return _Deployment(dep['deployment'], dep['region'], dep['stackId'])

    def get_stack(self) -> '_Stack':
        """A stack representation of the template associated with this deployment."""

        return _Stack(_Template('main_template'), self)

    def get_change_set_console_url(self, *, stack_id: str, change_set_id: str) -> str:
        """Give an URL where the change set can be reviewed."""

        params = parse.urlencode({
            'changeSetId': change_set_id,
            'stackId': stack_id,
        })
        return (
            f'https://{self.region}.console.aws.amazon.com/cloudformation/home?'
            f'region={self.region}#/stacks/changesets/changes?{params}')


# TODO(cyrille): Use the AWS object (_RequestParameter) directly.
class _TemplateParameter(typing.NamedTuple):
    key: str
    value: str


class _Template:

    _s3_bucket = 'bob-emploi-cf-templates'
    _s3_region = 'eu-west-3'

    filename: str = ''
    name: str = ''
    _revision: Optional[str] = None

    def __init__(self, name: str = 'main_template', revision: Optional[str] = None) -> None:
        self.name = name
        self._revision = revision
        self.filename = path.join(_DIRNAME, f'{name}.json')

    def at_revision(self, revision: str) -> '_Template':
        """The template for the same file, but at a different git revision."""

        return _Template(self.name, revision)

    @functools.cached_property
    def content(self) -> str:
        """The raw content of this template."""

        if self._revision:
            git_file = f'{self._revision}:{_get_git_dirname()}/{self.name}.json'
            return _run_git('show', git_file)
        with open(self.filename, encoding='utf-8') as file:
            return file.read()

    # TODO(cyrille): Type this a little.
    @functools.cached_property
    def json_content(self) -> '_TemplateJson':
        """The JSON representation of this template."""

        return typing.cast('_TemplateJson', json.loads(self.content))

    @staticmethod
    def hashed_content(content: str) -> str:
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    @functools.cached_property
    def _s3_filename(self) -> str:
        return f'{self.hashed_content(self.content)}_{self.name}.json'

    @functools.cached_property
    def s3_url(self) -> str:
        """The http URL for this template on s3."""

        http_url = f'https://{self._s3_bucket}.s3.{self._s3_region}.amazonaws.com/{self._s3_filename}'
        s3_url = f's3://{self._s3_bucket}/{self._s3_filename}'
        try:
            _run_aws('s3', 'ls', s3_url)
            # This template was already uploaded to S3. No need to upload it again.
            return http_url
        except exceptions.ClientError:
            _run_aws('s3', 'cp', self.filename, s3_url)
            return http_url

    def drop_from_s3(self) -> None:
        """Remove the template from s3 if it was uploaded there."""

        _run_aws('s3', 'rm', f's3://{self._s3_bucket}/{self._s3_filename}')

    def extract_task_inputs(self) -> Iterator[tuple[str, str, str, set[str]]]:
        """Get input fields from scheduled tasks."""

        for resource in self.json_content['Resources'].values():
            if resource['Type'] != 'AWS::Events::Rule':
                continue
            scheduled_task = resource['Properties']['Name']
            for target in resource['Properties']['Targets']:
                if 'Input' not in target:
                    continue
                target_id = target['Id']
                input_str = target['Input']
                if 'Fn::Sub' in input_str:
                    input_str = input_str['Fn::Sub']
                task_definition_ref = target['EcsParameters']['TaskDefinitionArn']['Ref']
                task_definition = self.json_content['Resources'][task_definition_ref]
                task_definition_names = {
                    defi['Name'] for defi in task_definition['Properties']['ContainerDefinitions']}
                yield scheduled_task, target_id, input_str, task_definition_names

    def template_parameter(self, arg: str) -> _TemplateParameter:
        """Parse a key/value parameter pair from a commandline arg."""

        if '=' not in arg:
            raise argparse.ArgumentError(None, f'Parameters must use "key=value", found "{arg}".')
        param = _TemplateParameter(*arg.split('=', 1))
        known_parameters = self.json_content['Parameters'].keys()
        if param.key not in known_parameters:
            raise argparse.ArgumentError(
                None, f'Unknown parameter "{param.key}", must be one of {known_parameters}')
        return param


class TemplateTestCase(unittest.TestCase):
    """Test properties of the template file."""

    template_name = 'main_template'

    def __init__(self, *args: Any) -> None:
        super().__init__(*args)
        self.maxDiff = 0

    def assertTemplatesEqual(
            self, template_1: str, template_2: str, name_1: str, name_2: str) -> None:
        try:
            self.assertEqual(template_1, template_2)
            return
        except AssertionError:
            pass
        diff = difflib.unified_diff(
            template_1.splitlines(keepends=True), template_2.splitlines(keepends=True),
            fromfile=name_1, tofile=name_2)
        self.fail('\n' + ''.join(diff))

    def setUp(self) -> None:
        self.template = _Template(self.template_name)

    def test_validate_aws(self) -> None:
        """The template is valid according to CloudFormation."""

        try:
            _run_aws('cloudformation', 'validate-template', '--template-url', self.template.s3_url)
        except exceptions.ClientError:
            # No need to keep an invalid template.
            self.template.drop_from_s3()
            raise

    def test_stable_json(self) -> None:
        """The JSON representation is stable through key-sorting and indentation."""

        self.assertTemplatesEqual(
            self.template.content.strip(), stringify(self.template.json_content),
            'string template', 'JSON template')

    def _recurse_substitution(self, at_path: Any, path: tuple[str, ...] = ()) -> None:
        if isinstance(at_path, list):
            for index, at_subpath in enumerate(at_path):
                self._recurse_substitution(at_subpath, path + (str(index),))
            return
        if isinstance(at_path, str):
            with self.subTest(
                    msg='Unsubstituted fields do not have substitution', path='.'.join(path)):
                self.assertNotRegex(at_path, _SUBSTITUTION_PATTERN)
            return
        if not isinstance(at_path, dict):
            return
        if len(at_path) == 1 and 'Fn::Sub' in at_path:
            substitution = at_path['Fn::Sub']
            with self.subTest(
                    msg='Substitution fields actually substitute something', path='.'.join(path)):
                if isinstance(substitution, list):
                    substitution = substitution[0]
                self.assertIsInstance(substitution, str)
                self.assertRegex(substitution, _SUBSTITUTION_PATTERN)
            return
        for key, at_subpath in at_path.items():
            self._recurse_substitution(at_subpath, path + (key,))

    def test_no_unsubstituted(self) -> None:
        """There are no fields which have a substitution pattern outside Fn::Sub."""

        self._recurse_substitution(self.template.json_content)

    def test_scheduled_tasks(self) -> None:
        """The scheduled tasks have a name and their input is well jsonified."""

        for scheduled_task, target_id, input_str, task_names in self.template.extract_task_inputs():

            with self.subTest(
                    msg='Input is well JSONified', scheduled_task=scheduled_task, target=target_id):
                input_json = json.loads(input_str)
                self.assertEqual(
                    # TODO(cyrille): Sort keys.
                    input_str, json.dumps(input_json, separators=(',', ':')))
                for override in input_json['containerOverrides']:
                    name = override['name']
                    with self.subTest(msg='Override is as expected', override=name):
                        self.assertIn(
                            name, task_names,
                            msg='Name is not the name of an overridden container.')
                        command = override['command']
                        self.assertIsInstance(
                            command, list,
                            msg='The override command should be a list of arguments, '
                            'not a shell command.')
                        self.assertEqual(
                            [arg for cmd in command for arg in cmd.split(' ')], command,
                            msg='The command contains spaces. '
                            'Please, make sure arguments are separate elements of the list.')
                        # TODO(cyrille): Make sure environment and secrets keys have the right form.


class JobflixTemplateTestCase(TemplateTestCase):
    """Test properties of the jobflix template file."""

    template_name = 'jobflix'


class NothingToDo(Exception):
    """Exception raised when an update has no impact on the deployed config."""


class _Stack:

    def __init__(self, template: _Template, deployment: _Deployment) -> None:
        self.template = template
        self.deployment = deployment

    @property
    def name(self) -> str:
        """The AWS::StackName value.

        We use the convention to suffix the main stack name with the name of the subtemplates.
        """

        if self.template.name == 'main_template':
            return self.deployment.stack_name
        return f'{self.deployment.stack_name}-{self.template.name}'

    def _call_cdf(self, *cmd: str) -> str:
        return _run_aws(
            'cloudformation', *cmd, '--region', self.deployment.region, '--stack-name', self.name)

    def _check_same_as_deployed(self, revision: str) -> None:
        git_sha = _run_git('rev-parse', revision)
        change_set_url = _Stack(self.template.at_revision(revision), self.deployment)\
            .deploy_if_changes(change_set_name=f'check-{git_sha}', dry_run=True)
        if change_set_url:
            raise AssertionError(
                f'Template at {revision} would make a different stack than the deployed one.\n'
                f'See change set: {change_set_url}')

    def check(self, revision: str, is_predeploy: bool = False) -> None:
        """Make sure the deployed template is consistent with the one at the given revision."""

        git_file = f'{revision}:{_get_git_dirname()}/{self.template.name}.json'
        revision_template = _run_git('show', git_file)
        deployed_template = stringify(
            json.loads(self._call_cdf('get-template'))['TemplateBody'])
        # TODO(cyrille): Move this to a proper TestCase.
        try:
            TemplateTestCase().assertTemplatesEqual(
                revision_template, deployed_template, git_file, 'deployed template')
        except AssertionError:
            if is_predeploy:
                # The deploy action will actually check that there is a stack difference.
                raise
            logging.warning(
                'Template is different from deployed one, checking it has no effect on the stack.')
            self._check_same_as_deployed(revision)

    @functools.cached_property
    def parameters(self) -> Mapping[str, str]:
        """The current parameters for the given stack."""

        return {
            param['ParameterKey']: param['ParameterValue']
            for param in json.loads(self._call_cdf('describe-stacks'))['Stacks'][0]['Parameters']}

    def _make_parameters(self, update_parameters: dict[str, str]) -> Iterator['_RequestParameter']:
        """Get parameters for the update request.

        Parameters may come from, in order of preference:
            - the update itself;
            - the currently deployed values;
            - the default value (when it exists);
        """

        needed_parameters = set(self.template.json_content['Parameters'])
        to_update = len(set(update_parameters) & needed_parameters)
        for parameter in needed_parameters:
            update = update_parameters.get(parameter)
            current = self.parameters.get(parameter)
            if update is not None and current != update:
                yield {'ParameterKey': parameter, 'ParameterValue': update}
                continue
            if update is not None:
                to_update -= 1
                logging.info('Updating "%s" with the same value as before. Ignoring', parameter)
            if current is not None:
                yield {'ParameterKey': parameter, 'UsePreviousValue': True}
        if update_parameters and not to_update:
            raise NothingToDo('All the parameters required for change are already up-to-date')

    def deploy(
            self, change_set_name: str, *,
            update_parameters: Optional[dict[str, str]] = None, dry_run: bool = True) \
            -> Optional[str]:
        """Create a change-set for the given deployment, and execute it if not in dry-run.

        If there are any updated parameters, it will re-use the current deployed template.
        Otherwise, it uses the template from the file system.
        """

        parameters = json.dumps(list(self._make_parameters(update_parameters or {})))
        # When there are updated parameters we re-use the current deployed template.
        use_previous_template = bool(update_parameters)

        def act_on_change_set(*args: str) -> str:
            return self._call_cdf(*args, '--change-set-name', change_set_name)

        def ensure_change_set_changes() -> None:
            try:
                act_on_change_set('wait', 'change-set-create-complete')
            except exceptions.ClientError as error:
                description = json.loads(act_on_change_set('describe-change-set'))
                reason = description['StatusReason']
                if "The submitted information didn't contain changes." in reason:
                    raise NothingToDo('No actual change in the template. Ignoring') from error
                logging.error(reason)
                raise
            description = json.loads(act_on_change_set('describe-change-set'))
            if not description['Changes']:
                act_on_change_set('delete-change-set')
                raise NothingToDo('No actual change in the template. Ignoring')

        if any(
                resource['Type'].startswith('AWS::IAM')
                for resource in self.template.json_content['Resources'].values()):
            args = ['--capabilities', 'CAPABILITY_IAM']
        else:
            args = []
        if use_previous_template:
            args.append('--use-previous-template')
        else:
            args.extend(['--template-url', self.template.s3_url])
        # TODO(cyrille): First check whether there's an ongoing update.
        change_set_info = json.loads(act_on_change_set(
            'create-change-set', '--parameters', parameters, *args))
        ensure_change_set_changes()
        change_set_url = self.deployment.get_change_set_console_url(
            stack_id=change_set_info['StackId'], change_set_id=change_set_info['Id'])
        if not dry_run:
            # TODO(cyrille): Handle failures gracefully (missing parameter).
            act_on_change_set('execute-change-set')
        return change_set_url

    def deploy_if_changes(self, change_set_name: str, *,
            update_parameters: Optional[dict[str, str]] = None, dry_run: bool = True) \
            -> Optional[str]:
        try:
            return self.deploy(
                change_set_name, update_parameters=update_parameters, dry_run=dry_run)
        except NothingToDo as error:
            logging.warning('Aborting the update', exc_info=error)
            return None

    def upload_new_template(self, *, change_set_name: str, dry_run: bool) -> Optional[str]:
        """Ensure the template is new, and deploy it for the given deployment.

        Returns the change set console URL, if any.
        """

        logging.info('Upload the template for %s', self.name)
        try:
            self.check('HEAD', is_predeploy=True)
            logging.info(
                'The template "%s" is consistent with the deployed version '
                'for "%s", nothing to deploy.', self.template.name, self.deployment)
            return None
        except AssertionError:
            pass
        return self.deploy_if_changes(change_set_name, dry_run=dry_run)

    def upload_new_params(
            self, change_set_name: str, dry_run: bool, update_parameters: dict[str, str]) \
            -> Optional[str]:
        """Ensure the template hasn't changed, and deploy the given parameters.

        Returns the change set console URL, if any.
        """

        logging.info('Upload the new parameters for %s', self.deployment.stack_name)
        try:
            self.check('HEAD', is_predeploy=True)
        except AssertionError as error:
            raise ValueError(
                'The template is not consistent with the deployed one, '
                'please update the template first.') from error
        return self.deploy_if_changes(
            change_set_name, dry_run=dry_run, update_parameters=update_parameters)

    def wait_for_update(self) -> None:
        """Wait for the deployment to be done."""

        logging.info('Deploying the changes for %s', self.name)
        wait = threading.Thread(target=self._call_cdf, args=('wait', 'stack-update-complete'))
        wait.start()
        while wait.is_alive():
            print('.', end='', flush=True)
            time.sleep(1)
        print('')
        logging.info('Template deployed for %s!', self.name)


def _check_change_set_args(args: '_Arg') -> '_Arg':
    if not args.change_set_name and not args.dry_run:
        # TODO(cyrille): Let argparse check this somehow.
        raise ValueError('Need a revision to tag the update. Please set --change-set-name.')
    if args.dry_run:
        logging.info(
            'This is only a dry run. '
            'No update will actually be done on the production stacks.')
    if not args.change_set_name:
        args.change_set_name = f'deploy-{int(time.time()):d}'
    return args


def upload(args: '_UploadArgs') -> None:
    """Check that the HEAD template is different from the deployed one and upload it."""

    stack_updates = {
        stack: change_set_url
        for d in args.deployments
        if (stack := d.get_stack()) and (change_set_url := stack.upload_new_template(
            change_set_name=args.change_set_name, dry_run=args.dry_run))}
    if not stack_updates:
        return
    if args.dry_run:
        print(json.dumps({d.name: url for d, url in stack_updates.items()}))
        return
    for stack in stack_updates:
        # TODO(cyrille): Run the wait actions concurrently
        stack.wait_for_update()


def check(args: '_CheckArgs') -> None:
    """Make sure the deployed templates are consistent with the ones at the given git revision."""

    errors: dict[str, AssertionError] = {}
    for deployment in args.deployments:
        stack = deployment.get_stack()
        try:
            stack.check(args.revision)
        except AssertionError as error:
            errors[stack.name] = error
    if errors:
        bad_stacks = ', '.join(errors.keys())
        all_errors = '\n'.join(str(e) for e in errors.values())
        raise AssertionError(
            'The following stacks are not consistent with '
            f'{args.revision}: {bad_stacks}.\n{all_errors}')


def set_parameters(args: '_ParamArgs') -> None:
    """Update stack parameters in a deployment."""

    dry_run = args.dry_run
    stack_updates = {
        stack: change_set_url
        for d in args.deployments
        if (stack := d.get_stack()) and (
            change_set_url := stack.upload_new_params(args.change_set_name, dry_run, {
                param: value for param, value in args.parameters}))}
    if not stack_updates:
        return
    if dry_run:
        print(json.dumps({d.deployment.stack_name: url for d, url in stack_updates.items()}))
        return
    for stack in stack_updates:
        stack.wait_for_update()


def _get_template_url(args: '_UrlArgs') -> None:
    print(_Template(args.template).s3_url)


# TODO(cyrille): Add a way to simply add a deployment's parameters to the policy.
def main(string_args: Optional[list[str]] = None) -> None:
    """Get the CLI arguments, and run the relevant tasks."""

    # TODO(cyrille): Add documentation to arguments.
    parser = argparse.ArgumentParser(description='Handle deployment for cloudformation stacks.')
    all_deployments = {
        _Deployment.from_name(d, warn_on_deprecated=False) for d in _get_deployments()}
    parser.add_argument(
        '--deployment', '-d', choices=all_deployments,
        dest='deployments', action='append', type=_Deployment.from_name)
    parser.add_argument('--no-dry-run', action='store_false', dest='dry_run')
    parser.add_argument('--change-set-name')
    actions = parser.add_subparsers(dest='action', required=True)

    upload_parser = actions.add_parser('upload', help='Upload the current template.')
    upload_parser.set_defaults(check_args=_check_change_set_args, apply_action=upload)

    check_parser = actions.add_parser(
        'check', help='Check the deployed template is consistent with the given git revision.')
    check_parser.add_argument('--revision', default='HEAD')
    check_parser.set_defaults(check_args=lambda args: args, apply_action=check)

    param_parser = actions.add_parser('parameter', help='Update a parameter in a live deployment.')
    param_parser.add_argument(
        'parameters', type=_Template().template_parameter,
        nargs='+', help='The parameters to update, and their values in the form key=value.')
    param_parser.set_defaults(check_args=_check_change_set_args, apply_action=set_parameters)

    template_url_parser = actions.add_parser('url', help='Get the S3 URL for the current template')
    template_url_parser.add_argument(
        'template', default='main_template', choices=('main_template', 'jobflix'),
        help='Choose the template you want an URL for.', nargs='?')
    template_url_parser.set_defaults(check_args=lambda args: args, apply_action=_get_template_url)

    args = parser.parse_args(string_args)
    if not args.deployments:
        args.deployments = list(all_deployments)
    args = args.check_args(args)

    template_tests = unittest.main(argv=[__file__], exit=False, buffer=True).result
    if not template_tests.wasSuccessful():
        sys.exit(1)

    args.apply_action(args)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
