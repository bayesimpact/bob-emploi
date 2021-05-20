"""Tests the importer.deployments.uk module."""

import unittest

from bob_emploi.data_analysis.importer.test import importers_test_helper
from bob_emploi.data_analysis.importer.deployments import uk


class ImportersTest(importers_test_helper.ImportersTestBase):
    """Test the importers for Bob UK data."""

    importers = uk.IMPORTERS


if __name__ == '__main__':
    unittest.main()
