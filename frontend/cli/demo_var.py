#!/usr/bin/env python3
"""Get an environment variable from a demo on the demo server."""

# TODO(cyrille): Test this file.

import argparse
import json
import os
import subprocess
import sys
from typing import Optional

_ROOT_DIR_NAME = os.getenv('BOB_ROOT_FOLDER') or \
    subprocess.check_output(('git', 'rev-parse', '--show-toplevel'), text=True).strip()


def _get_deployments() -> set[str]:
    with open(os.path.join(_ROOT_DIR_NAME, 'frontend/release/stack_deployments.json')) as json_file:
        deployments = json.load(json_file)
    return {dep['deployment'] for dep in deployments if 'deprecatedFor' not in dep}


def main(string_args: Optional[list[str]] = None) -> None:
    """Call the frontend-demo-runner on the demo server with the given arguments."""

    parser = argparse.ArgumentParser(description='Get variable values from a Bob demo.')
    parser.add_argument(
        '--server', '-s', action='store_true',
        help='Whether the variable is from the client or the server')
    demo = parser.add_mutually_exclusive_group()
    demo.add_argument('--nightly', '-n', choices={}, help='Choose a nightly demo for a deployment.')
    demo.add_argument('--branch', '-b', default='main', help='Choose a branch demo.')
    parser.add_argument('variable', nargs='+')
    args = parser.parse_args(string_args)
    demo_name = f'{args.nightly}-nightly' if args.nightly else f'branch-{args.branch}'
    docker_cmd = ['python', 'demos.py', 'bob-demo.bayes.org', '--demo', demo_name]
    if args.server:
        docker_cmd.extend(('--service', 'bob-server'))
    docker_cmd.extend(args.variable)
    docker_cmd_str = "' '".join(docker_cmd)
    server_cmd = \
        f"cd /etc/fdr && docker-compose exec -T frontend-demo-runner '{docker_cmd_str}'"

    try:
        print(subprocess.check_output([
            'ssh', 'bob-demo.bayes.org', f'bash --login -c "{server_cmd}"'], text=True).strip())
    except subprocess.CalledProcessError:
        sys.exit(1)


if __name__ == '__main__':
    main()
