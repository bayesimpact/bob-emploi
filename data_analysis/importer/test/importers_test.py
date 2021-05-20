"""Tests the importer.importers module."""

import unittest

from bob_emploi.data_analysis.importer import importers as fr
from bob_emploi.data_analysis.importer.test import importers_test_helper


class ImportersTest(importers_test_helper.ImportersTestBase):
    """Test the importers for Bob FR data."""

    importers = fr.IMPORTERS


if __name__ == '__main__':
    unittest.main()
