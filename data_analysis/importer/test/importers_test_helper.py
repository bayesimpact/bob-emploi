"""Helper module to test importers."""

import os
import subprocess
import unittest

from typing import Dict, Set

from bob_emploi.data_analysis.importer import importers as importers_module


_IMPORTER_FOLDER = os.path.dirname(importers_module.__file__)


class ImportersTestBase(unittest.TestCase):
    """Test all the importers scripts."""

    # The importers to tests.
    importers: Dict[str, importers_module.Importer] = {}

    # The keys of the importers that should not be tested.
    collections_to_skip: Set[str] = set()

    def setUp(self) -> None:
        if self.__class__ != ImportersTestBase:
            self.assertTrue(self.importers, 'No importers defined')

    def test_script_args(self) -> None:
        """Test that all script exists and that they have the corresponding args."""

        if not self.importers:
            return

        for collection, importer in self.importers.items():
            if not importer.script or collection in self.collections_to_skip:
                continue
            completed = subprocess.run(
                [
                    'python', os.path.join(_IMPORTER_FOLDER, f'{importer.script}.py'),
                    '--check-args',
                ] +
                [
                    arg
                    for key, value in (importer.args or {}).items()
                    for arg in (f'--{key}', value)
                ],
                stderr=subprocess.PIPE, check=False, text=True)
            self.assertFalse(
                completed.returncode,
                msg=f'Error for importer {collection}:\n{completed.stderr}')
