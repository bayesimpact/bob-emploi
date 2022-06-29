#!/usr/bin/env python3
"""Get an ECS environment value from a task definition.

The task definition is taken from stdin, so that you can run like:
    aws ecs describe-task-definition ... | python ecs_var_from_json.py my-container my-env-variable
"""

import json
import subprocess
import sys
from typing import Optional, TypedDict


class _Env(TypedDict):
    name: str
    value: str


class _Secret(TypedDict):
    name: str
    valueFrom: str


class _Container(TypedDict, total=False):
    environment: list[_Env]
    name: str
    secrets: list[_Secret]


class _Task(TypedDict):
    containerDefinitions: list[_Container]


class _TaskDef(TypedDict):
    taskDefinition: _Task


def get_secret(arn: str) -> str:
    """Get secret from a secret manager.

    Assumes awscli is configured within the right region, and with credentials.
    """

    key: Optional[str] = None
    if arn.endswith('::'):
        arn, key = arn.removesuffix('::').rsplit(':', 1)
    secret: str = json.loads(subprocess.check_output(
        ('aws', 'secretsmanager', 'get-secret-value', '--secret-id', arn)))['SecretString']
    if key:
        secret = json.loads(secret)[key]
    return secret



def get_env_var(container_name: str, name: str, task_def: _TaskDef) -> Optional[str]:
    """Get an environment value if it exists."""

    container = next((
        c for c in task_def['taskDefinition']['containerDefinitions']
        if c['name'] == container_name), None)
    if not container:
        return None
    from_env = next((
        env['value'] for env in container.get('environment', [])
        if env['name'] == name), None)
    if from_env is not None:
        return from_env
    return next((
        get_secret(s['valueFrom']) for s in container.get('secrets', [])
        if s['name'] == name), None)


def _print_if_exists(value: Optional[str]) -> None:
    if value is not None:
        print(value)

if __name__ == '__main__':
    _print_if_exists(get_env_var(sys.argv[1], sys.argv[2], json.load(sys.stdin)))
