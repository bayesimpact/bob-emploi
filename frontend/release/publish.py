#!/usr/bin/env python3
"""Publish the relevant frontend images to docker hub.

Assumes the images are built using docker-compose.
"""

import functools
import subprocess
import sys
import typing
from typing import Optional, Sequence, TypedDict

import yaml

if typing.TYPE_CHECKING:
    _DockerComposeService = TypedDict('_DockerComposeService', {'image': str}, total=False)
    _DockerComposeConfig = TypedDict(
        '_DockerComposeConfig', {'services': dict[str, _DockerComposeService]}, total=False)

_PROJECT = 'bob-emploi'


def _run_cmd(*cmd: str) -> str:
    return subprocess.check_output(list(cmd), text=True).strip()


@functools.cache
def _get_dc_config() -> '_DockerComposeConfig':
    return typing.cast(
        '_DockerComposeConfig', yaml.safe_load(_run_cmd('docker-compose', 'config')))


def _get_docker_image(service: str) -> Optional[str]:
    return _get_dc_config().get('services', {}).get(service, {}).get('image')


def push(service: str, tag: str) -> None:
    """Push the given docker-compose service."""

    image = _get_docker_image(service)
    if not image:
        raise ValueError(f'Missing an image for service "{service}".')
    remote_image = f'{image.split(":")[0]}:{tag}'
    _run_cmd('docker', 'tag', image, remote_image)
    _run_cmd('docker', 'push', remote_image)


def main(tags: Sequence[str]) -> None:
    """Push all the relevant images with the given tag."""

    for tag in tags:
        push('frontend', tag)
        push('frontend-flask', tag)


if __name__ == '__main__':
    main(sys.argv[1:])
