"""Tests the importer.deployments.usa module."""

import unittest

from bob_emploi.data_analysis.importer.test import importers_test_helper
from bob_emploi.data_analysis.importer.deployments import usa


class ImportersTest(importers_test_helper.ImportersTestBase):
    """Test the importers for Bob USA data."""

    importers = usa.IMPORTERS


if __name__ == '__main__':
    unittest.main()
