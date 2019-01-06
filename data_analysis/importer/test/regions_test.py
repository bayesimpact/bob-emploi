"""Unit tests for the regions importer."""

from os import path
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.data_analysis.importer import regions
from bob_emploi.data_analysis.lib import mongo

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


class RegionsImporterTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def test_make_dicts(self):
        """Basic usage."""

        dicts = regions.make_dicts(
            path.join(_TESTDATA_FOLDER, 'geo/insee_france_regions.tsv'),
            path.join(_TESTDATA_FOLDER, 'geo/region_prefix.tsv'))

        protos = dict(mongo.collection_to_proto_mapping(dicts, geo_pb2.Region))

        self.assertEqual({'84'}, protos.keys())
        self.assertEqual('en ', protos['84'].prefix)
        self.assertEqual('Auvergne-Rhône-Alpes', protos['84'].name)


if __name__ == '__main__':
    unittest.main()
