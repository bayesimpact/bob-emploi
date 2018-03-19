"""Unit tests for the departements importer."""

from os import path
import unittest

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.data_analysis.importer import departements
from bob_emploi.data_analysis.lib import mongo

_TESTDATA_FOLDER = path.join(path.dirname(__file__), 'testdata')


class DepartementsImporterTestCase(unittest.TestCase):
    """Unit tests for the module."""

    def test_make_dicts(self):
        """Basic usage."""

        dicts = departements.make_dicts(
            path.join(_TESTDATA_FOLDER, 'geo/insee_france_departements.tsv'),
            path.join(_TESTDATA_FOLDER, 'geo/insee_france_oversee_collectivities.tsv'),
            path.join(_TESTDATA_FOLDER, 'geo/departement_prefix.tsv'))

        protos = dict(mongo.collection_to_proto_mapping(dicts, geo_pb2.Departement))

        self.assertEqual({'01', '69', '74'}, protos.keys())
        self.assertEqual('en ', protos['74'].prefix)
        self.assertEqual('Rhône', protos['69'].name)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
