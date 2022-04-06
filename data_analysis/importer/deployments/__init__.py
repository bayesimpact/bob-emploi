"""Access to existing deployments defining specific importers.

Each python module in this folder should have a `IMPORTERS` dict at top level.
"""

import importlib
import pkgutil
import os
import typing
from typing import Iterable

from bob_emploi.data_analysis.importer import importers

_DEPLOYMENTS_FOLDER = os.path.dirname(os.path.realpath(__file__))


class DeploymentModule:
    """The interface the plugins should expose."""

    IMPORTERS: dict[str, importers.Importer]


def list_all_deployments() -> Iterable[str]:
    """List existing deployments."""

    yield 'fr'

    for package in pkgutil.iter_modules([_DEPLOYMENTS_FOLDER]):
        yield package.name


def get_importers(deployment_name: str) -> dict[str, importers.Importer]:
    """Get the importers for a given deployment."""

    if deployment_name == 'fr':
        return importers.IMPORTERS

    module = typing.cast(
        DeploymentModule,
        importlib.import_module(f'.{deployment_name}', __package__))
    return module.IMPORTERS
