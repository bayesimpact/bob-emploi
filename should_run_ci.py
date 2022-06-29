#!/usr/bin/env python3
"""Determine which parts of CI can be skipped."""

import argparse
import logging
from os import path
import shutil
import subprocess
import sys
import typing
from typing import Literal, Iterable, Iterator, NoReturn, Optional, TypedDict, Union

import requests


def _bazel_query_files(*args: str) -> set[str]:
    return {
        file.replace(':', '/').lstrip('/')
        for file in _run('bazel', 'query', *args).split('\n')
        if file}


class _Skip(typing.NamedTuple):
    # The Bazel target in //.circleci for which we want to track changes.
    bazel_target: str
    # The file to create when we can skip changes for this.
    sentinel: str
    # The folder to check for changes, when there's no Bazel.
    fallback_folders: tuple[str, ...]

    def has_changes_for(self, diff: set[str], with_bazel: bool = True) -> bool:
        """Whether the target has changed sources.

        Falls back to checking the folder if Bazel is not available.
        """

        # TODO(cyrille): Handle when diff has deleted files.
        logging.info('Checking %s target for diffed files...', self.bazel_target)
        has_bazel_succeeded = False
        if with_bazel and shutil.which('bazel'):
            try:
                required_srcs = _bazel_query_files(
                    f'kind("source file", deps(//.circleci:{self.bazel_target})) '
                    f'intersect set({" ".join(diff)})',
                ) | _bazel_query_files(
                    f'buildfiles(deps(//.circleci:{self.bazel_target})) '
                    f'intersect set({" ".join(diff)})',
                )
                has_bazel_succeeded = True
            except subprocess.CalledProcessError:
                # TODO(pascal): Log to sentry.
                logging.exception('Bazel failed, falling back to folder comparison')
                ...
        if not has_bazel_succeeded:
            required_srcs = {
                file for file in diff
                if any(file.startswith(folder) for folder in self.fallback_folders)}
        if not required_srcs:
            return False
        logging.info(
            'Found the following source changes for target %s:\n\t%s',
            self.bazel_target, '\n\t'.join(required_srcs))
        return True

    def skip(self) -> None:
        """Create the sentinel file."""

        logging.info('No changes found for %s, skipping.', self.bazel_target)
        _touch(self.sentinel)


_T = typing.TypeVar('_T')


# Stub for the paginated results from CircleCI.
class _PaginateRaw(typing.Generic[_T]):
    def __getitem__(self, key: Literal['items']) -> list[_T]:
        ...

    @typing.overload
    def get(self, key: Literal['items'], default: list[_T]) -> list[_T]:
        ...

    @typing.overload
    def get(self, key: Literal['next_page_token'], default: Optional[str] = None) -> Optional[str]:
        ...

    def get(
            self, key: Literal['items', 'next_page_token'],
            default: Union[None, str, list[_T]] = None) -> Union[None, str, list[_T]]:
        ...


class _PaginatedQuery(typing.Generic[_T]):
    def __init__(self, query: str, token: str, page_token: Optional[str] = None) -> None:
        self._query = query
        self._token = token
        self._page_token = page_token

    def __iter__(self) -> Iterator[_T]:
        current_page: _PaginateRaw[_T] = requests.get(
            self._query,
            params={} if self._page_token is None else {'page-token': self._page_token},
            headers={'Circle-Token': self._token}).json()
        if not current_page.get('items', []):
            return
        yield from current_page['items']
        if new_page_token := current_page.get('next_page_token'):
            yield from _PaginatedQuery(self._query, self._token, new_page_token)


# See https://circleci.com/docs/api/v2/#operation/listPipelinesForProject.
_PIPELINE_QUERY = 'https://circleci.com/api/v2/project/{project_slug}/pipeline'
_Vcs = TypedDict('_Vcs', {'revision': str})
_Pipeline = TypedDict('_Pipeline', {'id': str, 'vcs': _Vcs})
# See https://circleci.com/docs/api/v2/#operation/listWorkflowsByPipelineId.
_WORKFLOW_QUERY = 'https://circleci.com/api/v2/pipeline/{pipeline_id}/workflow'
_Workflow = TypedDict('_Workflow', {'status': Literal['success']})

_SKIP_CONFIG: dict[str, _Skip] = {
    'frontend': _Skip(
        bazel_target='build-test-publish-frontend',
        sentinel='skip-frontend',
        fallback_folders=('frontend',),
    ),
    'frontend-client': _Skip(
        bazel_target='build-test-publish-frontend-client',
        sentinel='skip-frontend-client',
        fallback_folders=('frontend',),
    ),
    'frontend-server': _Skip(
        bazel_target='build-test-publish-frontend-server',
        sentinel='skip-frontend-server',
        fallback_folders=('frontend',),
    ),
    'data-analysis': _Skip(
        bazel_target='build-test-data-analysis-prepare',
        sentinel='skip-data-analysis',
        fallback_folders=('data_analysis', 'frontend/api'),
    ),
    'mailjet': _Skip(
        bazel_target='test-mailjet',
        sentinel='skip-mailjet',
        fallback_folders=('frontend/server/mail/templates',),
    ),
    'analytics': _Skip(
        bazel_target='test-analytics',
        sentinel='skip-analytics',
        fallback_folders=('analytics',),
    ),
    'monitoring': _Skip(
        bazel_target='monitoring',
        sentinel='skip-monitoring',
        fallback_folders=('frontend/monitoring', 'data_analysis/monitoring'),
    ),
}


def _run(*args: str, check_error: bool = False) -> str:
    return subprocess.check_output(
        args, text=True, stderr=subprocess.PIPE if check_error else None).strip()


def _dont_run_ci() -> NoReturn:
    if shutil.which('circleci-agent'):
        _run('circleci-agent', 'step', 'halt')
    sys.exit()


def _touch(file: str) -> None:
    open(file, 'a', encoding='utf-8').close()


def _is_ancestor(ancestor: str, descendant: str) -> bool:
    try:
        _run('git', 'merge-base', '--is-ancestor', ancestor, descendant, check_error=True)
        return True
    except subprocess.CalledProcessError:
        return False


def _get_best_merge_base(this_sha1: str) -> str:
    """Find the most recent commit that was in default branch (considered as green)."""

    merge_base = _run('git', 'merge-base', this_sha1, 'origin/HEAD')
    if merge_base == this_sha1:
        # This sha is in origin/HEAD, let's compare to its parent.
        return f'{merge_base}^'
    return merge_base


def _get_last_green(this_sha1: str, project_slug: Optional[str], token: Optional[str]) -> str:
    """Determine a base on which we assume everything was properly built."""

    if not token or not project_slug:
        return _get_best_merge_base(this_sha1)
    pipelines: _PaginatedQuery[_Pipeline] = \
        _PaginatedQuery(_PIPELINE_QUERY.format(project_slug=project_slug), token)
    for pipeline in pipelines:
        sha1 = pipeline['vcs']['revision']
        if sha1 == this_sha1 or not _is_ancestor(sha1, this_sha1):
            continue
        workflows: _PaginatedQuery[_Workflow] = \
            _PaginatedQuery(_WORKFLOW_QUERY.format(pipeline_id=pipeline['id']), token)
        if all(workflow['status'] == 'success' for workflow in workflows):
            return sha1
    logging.error('No green ancestor found, falling back to merge-base.')
    return _get_best_merge_base(this_sha1)


def _check_is_at_tip(sha: str, branch: str) -> None:
    try:
        remote_ref = _run('git', 'config', f'branch.{branch}.merge')
    except subprocess.CalledProcessError:
        # Assume the remote branch has the same name as the local one.
        remote_ref = branch
    try:
        last_sha = _run(
            'git', 'ls-remote', '-q', '--exit-code', '--heads', 'origin', remote_ref,
        ).split('\t', 1)[0]
    except subprocess.CalledProcessError as error:
        logging.warning("The branch does not exist anymore. Don't run CI.", exc_info=error)
        _dont_run_ci()
    if last_sha != sha:
        logging.warning("The branch is not up-to-date. Don't run CI.")
        _dont_run_ci()


class _Arguments(typing.Protocol):
    branch: Optional[str]
    force: Optional[str]
    ref: str
    repo: str
    skip_only: Iterable[str]
    tag: Optional[str]
    token: Optional[str]
    use_bazel: bool


def find_diff_files(sha: str, repo: Optional[str], token: Optional[str]) -> set[str]:
    """Get the files that changed since last green CI."""

    last_green = _get_last_green(sha, f'gh/{repo}' if repo else None, token)
    logging.info('Considering %s as last successful build.', last_green)
    return {
        file
        for file in _run('git', 'diff', '--name-only', last_green, sha).split('\n')
        # TODO(cyrille): Do something with deleted files.
        if path.exists(file)
        if path.basename(file) != '__init__.py' or path.getsize(file)}


def main() -> None:
    """Parse input arguments, and check what should be skipped, according to diff."""

    all_skips = set(_SKIP_CONFIG)
    parser = argparse.ArgumentParser(description='Check which parts of the CI should be skipped.')
    parser.add_argument('ref', help="A valid reference to the commit we're testing")
    parser.add_argument('branch', help="The branch we're testing, if any", nargs='?')
    parser.add_argument('tag', help="The tag we're testing, if any", nargs='?')
    parser.add_argument('--repo', help='The full name of the github repository.')
    parser.add_argument('--token', help='A token to use Circle API.')
    parser.add_argument(
        '--skip-only', choices=all_skips, help='The targets we want to test for.', action='append')
    parser.add_argument('--force', help='The targets we want to force (i.e. never skip)')
    parser.add_argument(
        '--no-bazel', action='store_false', dest='use_bazel',
        help='Whether you do not want to use Bazel for diff checking.')
    args: _Arguments = parser.parse_args()
    if args.tag or args.branch == 'main':
        logging.info('Do not skip any part of CI for "%s"', args.tag or args.branch)
        return

    if args.force:
        targets_forced = {target.strip() for target in args.force.split(',')}
        for target in targets_forced:
            if target not in _SKIP_CONFIG:
                raise argparse.ArgumentError('force', f'Unknown target: {target}')
    else:
        targets_forced = set()

    if not args.skip_only:
        args.skip_only = all_skips
    sha = _run('git', 'rev-parse', args.ref)
    if args.branch:
        _check_is_at_tip(sha, args.branch)
    diff_files = find_diff_files(sha, args.repo, args.token)
    to_skip = {
        skip
        for skip in args.skip_only
        if not _SKIP_CONFIG[skip].has_changes_for(diff_files, with_bazel=args.use_bazel)}
    if args.branch and args.branch.endswith('fix-persist'):
        logging.info('Testing the CI runs well when frontend is skipped.')
        to_skip |= {'frontend', 'frontend-client', 'frontend-server'}
    for skip in to_skip:
        if skip not in targets_forced:
            # TODO(cyrille): Replace with generating a circleCI config.
            _SKIP_CONFIG[skip].skip()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
