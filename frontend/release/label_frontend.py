#!/usr/bin/env python3
"""Add a label to the frontend docker image, depending on what is inside of it.

Assumes the image is already built locally.
Requires PyYAML and docker-compose to be installed.
"""

import subprocess
import typing
from typing import Optional, TypedDict

import yaml

if typing.TYPE_CHECKING:
    _DockerComposeService = TypedDict('_DockerComposeService', {'image': str}, total=False)
    _DockerComposeConfig = TypedDict(
        '_DockerComposeConfig', {'services': dict[str, _DockerComposeService]}, total=False)


_LABEL_KEY = 'org.bayesimpact.deployments'
_DOCKER_SERVICE = 'frontend'


def _run_cmd(*cmd: str, **kwargs: Optional[str]) -> str:
    return subprocess.check_output(list(cmd), text=True, input=kwargs.get('input')).strip()


def _get_docker_image(service: str) -> Optional[str]:
    full_config = typing.cast(
        '_DockerComposeConfig', yaml.safe_load(_run_cmd('docker-compose', 'config')))
    return full_config.get('services', {}).get(service, {}).get('image')


def _get_existing_label(image: str, label_key: str) -> str:
    return _run_cmd(
        'docker', 'inspect', image, '-f', f'{{ index .Config.Labels "{label_key}"}}')


def _list_deployments(service: str) -> list[str]:
    all_deployment_files = _run_cmd(
        'docker-compose', 'run', '--no-deps', '--rm', service, 'find', '/usr/share/bob-emploi/html',
        '-mindepth', '1', '-maxdepth', '1', '-type', 'd').split('\n')
    return [file.rsplit('/', 1)[-1] for file in all_deployment_files]


def _label_image(image: str, label_key: str, label_value: str) -> None:
    _run_cmd(
        'docker', 'build', '-', '-t', image, '--label', f'{label_key}={label_value}',
        input=f'FROM {image}')


def main(service: str, label_key: str) -> None:
    """Label the docker image with its deployments, if it's not already labelled."""

    image = _get_docker_image(service)
    if not image:
        raise ValueError(f'Unable to find an image for service "{service}".')
    if label := _get_existing_label(image, label_key):
        print(f'Image is already tagged with "{label}", not neccessary to do it again.')
        return
    built_deployments = ','.join(_list_deployments(service))
    _label_image(image, label_key, built_deployments)


if __name__ == '__main__':
    main(_DOCKER_SERVICE, _LABEL_KEY)
