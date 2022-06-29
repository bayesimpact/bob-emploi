#!/usr/bin/env python3
"""Deploy new versions of Scheduled Tasks.

To get all available rules, run:
  deploy_scheduled_tasks.py list
To get the latest version from AWS locally, run:
  deploy_scheduled_tasks.py download
To deploy a local version of a rule to AWS, run:
  deploy_scheduled_tasks.py upload <rule_name>
To run a rule on AWS, run:
  deploy_scheduled_tasks.py run <rule_name>
To synchronize the saved rules with those currently in AWS, run:
  deploy_scheduled_tasks.py clean
To delete a rule from AWS, run:
  deploy_scheduled_tasks.py delere <rule_name>
It uses awscli (usually installed by pip)."""

import argparse
import functools
import glob
import json
import logging
import os
from os import path
import subprocess
import sys
import typing
from typing import Any, IO, Iterator, Optional, Sequence, TypedDict, Union

_RELEASE_FOLDER = path.dirname(__file__)

_CLOUDFORMATION_TEMPLATE = path.join(_RELEASE_FOLDER, 'cloudformation', 'main_template.json')
_STACK_DEPLOYMENTS = path.join(_RELEASE_FOLDER, 'stack_deployments.json')
_FOLDER_INDEX = 'index.json'


if typing.TYPE_CHECKING:
    class _DeploymentDict(TypedDict, total=False):
        deployment: str
        deprecatedFor: str
        region: str
        stackId: str

    _EnvOverride = TypedDict('_EnvOverride', {'name': str, 'value': str})
    _Override = TypedDict('_Override', {'environment': list[_EnvOverride]}, total=False)
    _TargetInput = TypedDict('_TargetInput', {'containerOverrides': list[_Override]})
    _EcsParameters = TypedDict('_EcsParameters', {
        'LaunchType': str,
        'NetworkConfiguration': str,
        'TaskDefinitionArn': str,
    })
    _RuleTarget = TypedDict('_RuleTarget', {
        'Arn': str,
        'EcsParameters': _EcsParameters,
        'Id': str,
        'Input': Union[str, _TargetInput],
    }, total=False)
    _RuleProperties = TypedDict('_RuleProperties', {'Targets': list[_RuleTarget]})
    _AwsvpcConfiguration = TypedDict('_AwsvpcConfiguration', {
        'AssignPublicIp': str,
        'SecurityGroups': list[str],
        'Subnets': list[str],
    })
    _NetworkConfiguration = TypedDict('_NetworkConfiguration', {
        'awsvpcConfiguration': _AwsvpcConfiguration,
    })

    _AWSSub = TypedDict('_AWSSub', {'Fn::Sub': str})
    _RuleIndex = TypedDict('_RuleIndex', {'Arn': str, 'Name': Union[str, _AWSSub]}, total=False)

    _RuleResourceProperties = TypedDict('_RuleResourceProperties', {'Name': str})
    _TemplateResource = TypedDict('_TemplateResource', {
        'Properties': _RuleResourceProperties,
        'Type': str,
    })
    _TemplateJson = TypedDict('_TemplateJson', {'Resources': dict[str, _TemplateResource]})


def _run(*cmd: str) -> str:
    return subprocess.check_output(list(cmd), text=True).strip()


def _dump(input_dict: Any, file: IO[str]) -> None:
    json.dump(input_dict, file, indent=2, sort_keys=True)
    file.write('\n')


@functools.cache
def _get_deployments() -> dict[str, '_DeploymentDict']:
    with open(_STACK_DEPLOYMENTS, encoding='utf-8') as file:
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
    @functools.cache
    def get_all() -> set['_Deployment']:
        return {
            _Deployment(dep['deployment'], dep['region'], dep['stackId'])
            for dep in _get_deployments().values()
            if 'deprecatedFor' not in dep}

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


def _unpack_input_and_redact_env_vars(rule: '_RuleProperties', should_redact: bool) \
        -> '_RuleProperties':
    """Unpack the 'Input' vars that are stored as JSON strings in AWS.

    WARNING: Modifies and returns the 'rule' parameter.
    Also redact environment variables.
    """

    for target in rule.get('Targets', []):
        # The target's inputs are JSON stringified inside the JSON, so we extract
        # it.
        if 'Input' not in target:
            continue
        if isinstance(target['Input'], str):
            target['Input'] = typing.cast('_TargetInput', json.loads(target['Input']))
        if isinstance(target['Input'], str):
            continue
        if should_redact:
            # Redact all env vars.
            for container in target['Input'].get('containerOverrides', []):
                for env in container.get('environment', []):
                    if env['value']:
                        env['value'] = 'REDACTED'
    return rule


def _inject_env_vars_and_pack_input(rule_json: '_RuleProperties') -> '_RuleProperties':
    """Inject env variables then pack the 'Input' vars that are stored as JSON strings in AWS."""

    # Deep clone.
    rule_json = json.loads(json.dumps(rule_json))
    for target in rule_json['Targets']:
        if 'Input' not in target:
            continue
        if isinstance(target['Input'], str):
            continue
        # Add env vars back.
        for container in target['Input'].get('containerOverrides', []):
            for env in container.get('environment', []):
                if env['value'] == 'REDACTED':
                    name = env['name']
                    try:
                        env['value'] = os.environ[name]
                    except KeyError:
                        logging.error(
                            'Set the production env var for "%s". You can run this script '
                            'with download <rule_name> to see its current value in prod.', name)
                        raise
        # The target's inputs need to be JSON stringified inside the JSON, so we encode it.
        target['Input'] = json.dumps(target['Input'])
    return rule_json


def _clean_names(name: Union[str, '_AWSSub'], *, region: str) -> Iterator[str]:
    if isinstance(name, str):
        yield name
        return
    for deployment in _Deployment.get_all():
        if deployment.region == region:
            yield name['Fn::Sub'].replace('${AWS::StackName}', deployment.stack_name)


def download_index_file(folder: str, deployment: _Deployment) -> None:
    """Update the given index file."""

    with open(_CLOUDFORMATION_TEMPLATE, encoding='utf-8') as template_file:
        template: '_TemplateJson' = json.load(template_file)
    stack_rules = {
        name
        for r in template['Resources'].values()
        if r['Type'] == 'AWS::Events::Rule'
        if 'ScheduleExpression' in r['Properties']
        for name in _clean_names(r['Properties']['Name'], region=deployment.region)}
    all_rules = json.loads(_run('aws', 'events', 'list-rules'))['Rules']
    kept_rules = [
        rule for rule in all_rules
        # TODO(cyrille): Account for cdf substitutions.
        if rule['Name'] not in stack_rules
        if 'Zappa' not in rule.get('RoleArn', '')]
    with open(path.join(folder, _FOLDER_INDEX), 'w', encoding='utf-8') as file:
        _dump({'Rules': kept_rules}, file)
    _list_rules.cache_clear()


def _has_rule(folder: str, rule: str) -> bool:
    target_rules = {
        file.removesuffix('.json').removeprefix(f'{folder}/')
        for file in glob.iglob(f'{folder}/*.json')}
    common_rules = set(_list_rules(folder)) & target_rules
    return rule in common_rules


def download_and_unpack_rule(rule: str, *, should_redact: bool) -> '_RuleProperties':
    """Download rule from AWS and unpack it."""

    rule_json: _RuleProperties = json.loads(
        _run('aws', 'events', 'list-targets-by-rule', '--rule', rule))
    return _unpack_input_and_redact_env_vars(rule_json, should_redact)


@functools.cache
def _list_rules(folder: str) -> dict[str, '_RuleIndex']:
    with open(path.join(folder, _FOLDER_INDEX), encoding='utf-8') as index_file:
        return {r['Name']: r for r in json.load(index_file)['Rules']}


@functools.cache
def _get_rule_json(folder: str, rule: str) -> '_RuleProperties':
    with open(path.join(folder, f'{rule}.json'), encoding='utf-8') as rule_file:
        return typing.cast('_RuleProperties', json.load(rule_file))


def _download_rule(
        *, folder: str, rule: Optional[str], deployment: _Deployment, **unused_kwargs: Any) -> None:
    if rule:
        rules = {rule}
        should_save = False
    else:
        download_index_file(folder, deployment)
        rules = set(_list_rules(folder))
        should_save = True
    for name in rules:
        json_rule = download_and_unpack_rule(name, should_redact=should_save)
        if should_save:
            with open(path.join(folder, f'{name}.json'), 'w', encoding='utf-8') as rule_file:
                _dump(json_rule, rule_file)
            continue
        _dump(json_rule, sys.stdout)


def _upload_rule(folder: str, rule: str, **unused_kwargs: Any) -> None:
    input_json = _list_rules(folder)[rule]
    del input_json['Arn']
    _run('aws', 'events', 'put-rule', '--name', rule, '--cli-input-json', json.dumps(input_json))
    rule_json = _inject_env_vars_and_pack_input(_get_rule_json(folder, rule))
    targets = json.dumps(dict(rule_json, Rule=rule))
    _run('aws', 'events', 'put-targets', '--cli-input-json', targets)


def _lower_first_letter_keys(value: dict[str, Any]) -> dict[str, Any]:
    return {
        k[:1].lower() + k[1:]: _lower_first_letter_keys(v) if isinstance(v, dict) else v
        for k, v in value.items()
    }


def _make_network_configuration(config: '_NetworkConfiguration') -> str:
    return json.dumps(_lower_first_letter_keys(config))


def _run_rule(folder: str, rule: str, **unused_kwargs: Any) -> None:
    rule_json = _inject_env_vars_and_pack_input(_get_rule_json(folder, rule))
    for target in rule_json['Targets']:
        _run(
            'aws', 'ecs', 'run-task',
            '--cluster', target['Arn'],
            '--task-definition', target['EcsParameters']['TaskDefinitionArn'],
            '--launch-type', target['EcsParameters']['LaunchType'],
            '--network-configuration',
            _make_network_configuration(target['EcsParameters']['NetworkConfiguration']),
            '--overrides', target['Input'])


def _delete_rule(folder: str, rule: str, deployment: _Deployment) -> None:
    task_ids = {t['Id'] for t in _get_rule_json(folder, rule)['Targets']}
    answer = input(f'Are you sure you want to delete {rule} [yN]?')
    if not answer.lower().startswith('y'):
        logging.info('Cancelled deletion for %s.', rule)
        return
    _run('aws', 'events', 'remove-targets', '--rule', rule, '--ids', *task_ids)
    _run('aws', 'events', 'delete-rule', '--name', rule)
    download_index_file(folder, deployment)


def _clean(*, folder: str, deployment: _Deployment, **unused_kwargs: Any) -> None:
    download_index_file(folder, deployment)
    for file in glob.iglob(f'{folder}/*.json'):
        rule = file.removeprefix(f'{folder}/')
        if rule == _FOLDER_INDEX:
            continue
        rule = rule.removesuffix('.json')
        if not _has_rule(folder, rule):
            os.remove(file)


class _Action(typing.Protocol):
    def __call__(self, *, folder: str, rule: Optional[str], action: str, deployment: _Deployment) \
            -> None:
        ...


class _RuleAction(typing.Protocol):
    def __call__(self, *, folder: str, rule: str, deployment: _Deployment) -> None:
        ...


def _ensure_rule(rule_action: _RuleAction) -> _Action:
    def act(*, folder: str, rule: Optional[str], action: str, deployment: _Deployment) -> None:
        if not rule:
            raise ValueError(f'Need a rule name to {action}.')
        rule_action(folder=folder, rule=rule, deployment=deployment)
    return act


_ACTIONS: dict[str, _Action] = {
    'clean': _clean,
    'delete': _ensure_rule(_delete_rule),
    'download': _download_rule,
    'list': lambda folder, **kw: print('\n'.join(_list_rules(folder))),
    'run': _ensure_rule(_run_rule),
    'upload': _ensure_rule(_upload_rule),
}


class _InitArguments(typing.Protocol):
    deployment: _Deployment
    action: str


class _DeploymentArguments(typing.Protocol):
    rule: Optional[str]


def main() -> None:
    """Parse arguments, and run the relevant action."""

    # First args parsing.
    parser = argparse.ArgumentParser(description='Deploy new versions of Scheduled Tasks.')
    parser.add_argument(
        '--deployment', '-d', default=_Deployment.from_name('fr'), type=_Deployment.from_name,
        choices={_Deployment.from_name(d, warn_on_deprecated=False) for d in _get_deployments()})
    parser.add_argument('action', choices=_ACTIONS.keys())
    parsed: tuple[_InitArguments, Sequence[str]] = parser.parse_known_args()
    init_args, other_args = parsed
    deployment = init_args.deployment
    folder = path.join(_RELEASE_FOLDER, 'scheduled-tasks', str(deployment))
    available_rules = set(_list_rules(folder)) & {
        file.removesuffix('.json').removeprefix(f'{folder}/')
        for file in glob.iglob(f'{folder}/*.json')}

    # Extra args parsing now that we know where the rules are.
    parser = argparse.ArgumentParser(description='Deploy new versions of Scheduled Tasks.')
    parser.add_argument('rule', choices=available_rules, nargs='?')
    args: _DeploymentArguments = parser.parse_args(other_args)

    # Run the action.
    logging.info('Running script for deployment "%s"', deployment)
    os.environ['AWS_DEFAULT_REGION'] = deployment.region
    _ACTIONS[init_args.action](
        folder=folder, rule=args.rule, action=init_args.action, deployment=deployment)


if __name__ == '__main__':
    main()
