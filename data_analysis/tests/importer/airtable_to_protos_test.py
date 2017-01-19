"""Tests for the bob_emploi.importer.airtable_to_protos module."""
import unittest

from bob_emploi.importer import airtable_to_protos


class AirtableTestCase(unittest.TestCase):
    """Tests for the converter."""

    def setUp(self):
        super(AirtableTestCase, self).setUp()
        self.converter = airtable_to_protos.PROTO_CLASSES['Chantier']

    def test_convert_record(self):
        """Test the convert_record method."""
        record = self.converter.convert_record({
            'id': 'foobar',
            'fields': {
                'title': 'My real title',
                'short_description': 'The description',
                'actions': ['a', 'b', 'c'],
            },
        })

        self.assertEqual({
            '_id': 'foobar',
            'chantierId': 'foobar',
            'title': 'My real title',
            'shortDescription': 'The description',
        }, record)

    def test_no_useful_fields(self):
        """Converter fails when no fields from the proto are there."""
        self.assertRaises(
            KeyError, self.converter.convert_record,
            {'id': 'foobar', 'fields': {'foo': 'bar'}})

    def test_missing_required_fields(self):
        """Test that the converter fails when required fields are missing."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        self.assertRaises(
            KeyError, converter.convert_record,
            {'id': 'foobar', 'fields': {'title': 'Foo'}})

    def test_convert_all_required_fields(self):
        """Test that the converter succeeds when required fields are there."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        record = converter.convert_record(
            {'id': 'foobar', 'fields': {'chantiers': ['Foo']}})
        self.assertEqual({
            '_id': 'foobar',
            'actionTemplateId': 'foobar',
            'chantiers': ['Foo'],
        }, record)

    def test_validate_links(self):
        """Test that the converter accepts a valid link."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        converter.convert_record({'id': 'foobar', 'fields': {
            'chantiers': ['Foo'],
            'link': 'http://www.pole-emploi.fr',
        }})

    def test_raises_on_invalid_links(self):
        """Test that the converter breaks when a link is not correct."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        self.assertRaises(
            ValueError,
            converter.convert_record,
            {'id': 'foobar', 'fields': {
                'chantiers': ['Foo'],
                'link': 'www.pole-emploi.fr',
            }})

    def test_validate_filters(self):
        """Test that the converter accepts a valid filter."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        converter.convert_record({'id': 'foobar', 'fields': {
            'chantiers': ['Foo'],
            'filters': ['for-job-group(A12)'],
        }})

    def test_raises_on_invalid_filter(self):
        """Test that the converter breaks when a filter is not correct."""
        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        self.assertRaises(
            ValueError,
            converter.convert_record,
            {'id': 'foobar', 'fields': {
                'chantiers': ['Foo'],
                'filters': ['this is not a filter'],
            }})


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
