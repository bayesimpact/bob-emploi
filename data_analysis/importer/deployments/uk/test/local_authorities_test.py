"""Test for the importer for local authority names."""

from os import path
import unittest

from bob_emploi.data_analysis.importer.deployments.uk import local_authorities
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import geo_pb2


class LocalAuthoritiesTestCase(unittest.TestCase):
    """Test suite for the local authority importer."""

    testdata_wards = path.join(path.dirname(__file__), 'testdata/wards.csv')

    def test_basic(self) -> None:
        """Basic usage."""

        found_las = dict(mongo.collection_to_proto_mapping(
            local_authorities.csv2dicts(self.testdata_wards), geo_pb2.Departement))

        self.assertEqual(5, len(found_las), msg=found_las.keys())
        # Point check.
        barking = found_las['E09000002']
        self.assertEqual('Barking and Dagenham', barking.name, msg=barking)
        self.assertEqual('in ', barking.prefix, msg=barking)


if __name__ == '__main__':
    unittest.main()
