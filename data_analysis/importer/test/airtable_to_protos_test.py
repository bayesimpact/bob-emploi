"""Tests for the bob_emploi.importer.airtable_to_protos module."""

import os
import unittest

import airtablemock
import mock

from bob_emploi.data_analysis.importer import airtable_to_protos


class ConverterTestCase(unittest.TestCase):
    """Tests for the converter."""

    def setUp(self):
        super(ConverterTestCase, self).setUp()
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

    def test_curly_quote(self):
        """Test that we forbid curly quotes."""

        with self.assertRaises(ValueError):
            self.converter.convert_record({
                'id': 'foobar',
                'fields': {
                    'title': 'Don’t do that',
                },
            })

    def test_trailing_blank(self):
        """Test that we forbid strings with a trailing blank space."""

        with self.assertRaises(ValueError):
            self.converter.convert_record({
                'id': 'foobar',
                'fields': {
                    'title': "Don't do that either ",
                },
            })

    def test_no_useful_fields(self):
        """Converter fails when no fields from the proto are there."""

        self.assertRaises(
            KeyError, self.converter.convert_record,
            {'id': 'foobar', 'fields': {'foo': 'bar'}})

    def test_missing_required_fields(self):
        """Test that the converter fails when required fields are missing."""

        converter = airtable_to_protos.PROTO_CLASSES['AdviceModule']
        self.assertRaises(
            KeyError, converter.convert_record,
            {'id': 'foobar', 'fields': {'title': 'Foo', 'advice_id': 'bla'}})

    def test_convert_all_required_fields(self):
        """Test that the converter succeeds when required fields are there."""

        converter = airtable_to_protos.PROTO_CLASSES['AdviceModule']
        record = converter.convert_record(
            {'id': 'foobar', 'fields': {
                'advice_id': 'Foo',
                'trigger_scoring_model': 'constant(2)',
            }})
        self.assertEqual({
            '_id': 'foobar',
            'airtableId': 'foobar',
            'adviceId': 'Foo',
            'triggerScoringModel': 'constant(2)',
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

    def test_image_url(self):
        """Test that the converter retrieves images' URL."""

        converter = airtable_to_protos.PROTO_CLASSES['ActionTemplate']
        record = converter.convert_record({'id': 'foobar', 'fields': {
            'image': [
                {'url': 'http://example.com/first.png', 'type': 'image/png'},
                {'url': 'http://example.com/second.jpg', 'type': 'image/jpeg'},
            ],
        }})
        self.assertEqual({
            '_id': 'foobar',
            'actionTemplateId': 'foobar',
            'imageUrl': 'http://example.com/first.png',
        }, record)

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

    def test_validate_scoring_model(self):
        """Test that the converter breaks when a trigger scoring model is not correct."""

        converter = airtable_to_protos.PROTO_CLASSES['AdviceModule']
        self.assertRaises(
            ValueError,
            converter.convert_record,
            {'id': 'foobar', 'fields': {
                'advice_id': 'Foo',
                'trigger_scoring_model': 'not-implemented-yet',
            }})

    def test_advice_modules_categories(self):
        """Convert an advice module with its categories."""

        converter = airtable_to_protos.PROTO_CLASSES['AdviceModule']
        record = converter.convert_record(
            {'id': 'foobar', 'fields': {
                'advice_id': 'Foo',
                'trigger_scoring_model': 'constant(2)',
                'categories': ['hidden market', 'keep motivation'],
            }})
        self.assertEqual({
            '_id': 'foobar',
            'airtableId': 'foobar',
            'adviceId': 'Foo',
            'triggerScoringModel': 'constant(2)',
            'categories': ['hidden market', 'keep motivation']
        }, record)

    def test_job_board(self):
        """Convert a job board."""

        converter = airtable_to_protos.PROTO_CLASSES['JobBoard']
        jobboard = converter.convert_record({
            'id': 'foobar',
            'fields': {
                'title': 'Pôle emploi',
                'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            },
        })
        self.assertEqual(jobboard, {
            '_id': 'foobar',
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
        })

    def test_job_board_filters(self):
        """Convert a job board and add filters."""

        converter = airtable_to_protos.PROTO_CLASSES['JobBoard']
        jobboard = converter.convert_record({
            'id': 'foobar',
            'fields': {
                'title': 'Pôle emploi',
                'link': 'https://candidat.pole-emploi.fr/offres/recherche',
                'for-departement': '49',
                'for-job-group': 'A12,B',
            },
        })
        self.assertEqual(jobboard, {
            '_id': 'foobar',
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'filters': ['for-departement(49)', 'for-job-group(A12,B)'],
        })

    def test_missing_templates_contact_lead(self):
        """Test that the converter for contact lead fails with missing template variables."""

        converter = airtable_to_protos.PROTO_CLASSES['ContactLead']
        self.assertRaises(
            ValueError,
            converter.convert_record,
            {'id': 'foobar', 'fields': {
                'name': 'Le maire %ofCity',
                'filters': ['for-experienced(6)'],
                'email_template': 'Hi Mr.Mayor! Do you know any %helpful people?',
                'card_content': 'Look at %bob advice!',
            }})

    def test_contact_lead_converter(self):
        """Convert a Contact Lead template."""

        converter = airtable_to_protos.PROTO_CLASSES['ContactLead']
        dynamic_advice = converter.convert_record({
            'id': 'foobar',
            'fields': {
                'name': 'Le maire %ofCity',
                'filters': ['for-experienced(6)'],
                'email_template': 'Hi Mr.Mayor!',
            },
        })
        self.assertEqual(dynamic_advice, {
            '_id': 'foobar',
            'name': 'Le maire %ofCity',
            'filters': ['for-experienced(6)'],
            'emailTemplate': 'Hi Mr.Mayor!',
        })

    def test_dynamic_advice_converter(self):
        """Convert a dynamic advice config."""

        converter = airtable_to_protos.PROTO_CLASSES['DynamicAdvice']
        dynamic_advice = converter.convert_record({
            'id': 'foobar',
            'fields': {
                'title': 'Présentez-vous au chef boulanger',
                'for-job-group': 'D1102',
                'filters': ['not-for-job(12006)'],
                'card_text': 'Allez à la boulangerie la veille',
                'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
                'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
            },
        })
        self.assertEqual(dynamic_advice, {
            '_id': 'foobar',
            'title': 'Présentez-vous au chef boulanger',
            'cardText': 'Allez à la boulangerie la veille',
            'filters': ['not-for-job(12006)', 'for-job-group(D1102)'],
            'expandedCardHeader': 'Il *faut*',
            'expandedCardItems': ['Se présenter', 'Très tôt'],
            'expandedCardItemsFeminine': ['Se représenter', 'Très tôt'],
        })

    def test_dynamic_advice_converter_wrong_format(self):
        """Convert a dynamic advice config with wrong items list format."""

        converter = airtable_to_protos.PROTO_CLASSES['DynamicAdvice']
        with self.assertRaises(ValueError):
            converter.convert_record({
                'id': 'foobar',
                'fields': {
                    'title': 'Présentez-vous au chef boulanger',
                    'for-job-group': 'D1102',
                    'card_text': 'Allez à la boulangerie la veille',
                    'expanded_card_items': '* Se présenter\ntrès tôt',
                },
            })

    def test_diagnostic_sentence_missing_template_var(self):
        """Convert a diagnostic sentence with a missing template var."""

        converter = airtable_to_protos.PROTO_CLASSES['DiagnosticSentenceTemplate']
        with self.assertRaises(ValueError):
            converter.convert_record({
                'id': 'foo bar',
                'fields': {
                    'sentence_template': 'I have an %unknownVar',
                    'filters': ['for-job-group(A12)'],
                    'order': 2,
                },
            })


@airtablemock.patch(airtable_to_protos.__name__ + '.airtable')
@mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'apikey42'})
class Airtable2DictsTestCase(unittest.TestCase):
    """Unit tests for the importer."""

    def test_airtable2dicts(self):
        """Basic usage of airtable2dicts."""

        base = airtablemock.Airtable('base123', 'apikey42')
        base.create('table456', {
            'advice_id': 'my-advice',
            'trigger_scoring_model': 'constant(2)',
        })
        base.create('table456', {
            'advice_id': 'my-second-advice',
            'trigger_scoring_model': 'constant(3)',
        })

        protos = airtable_to_protos.airtable2dicts('base123', 'table456', 'AdviceModule')
        self.assertEqual(
            ['my-advice', 'my-second-advice'], sorted(m['adviceId'] for m in protos))

    def test_airtable2dicts_sorted_diagnostic_sentence(self):
        """Use of airtable2dicts when records need to be sorted."""

        base = airtablemock.Airtable('base456', 'apikey42')
        base.create('diagnostic_template', {
            'sentence_template': 'first %inCity',
            'order': 1,
        })
        base.create('diagnostic_template', {
            'sentence_template': 'fifth',
            'order': 2,
        })
        base.create('diagnostic_template', {
            'sentence_template': 'second',
            'order': 1,
        })
        base.create('diagnostic_template', {
            'sentence_template': 'fourth',
            'filters': ['for-job-group(A12)'],
            'order': 2,
            'priority': 2,
        })
        base.create('diagnostic_template', {
            'sentence_template': 'third',
            'filters': ['for-job-group(A12)'],
            'order': 2,
            'priority': 4,
        })

        with self.assertRaises(ValueError):
            airtable_to_protos.airtable2dicts(
                'base456', 'diagnostic_template', 'DiagnosticSentenceTemplate')

    def test_airtable2dicts_sorted_diagnostic_submetrics_sentence(self):
        """Use of airtable2dicts when records need to be sorted."""

        base = airtablemock.Airtable('base456', 'apikey42')
        base.create('diagnostic_submetrics_template', {
            'positive_sentence_template': 'first',
            'submetric': 'JOB_SEARCH_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
            'negative_sentence_template': ''
        })
        base.create('diagnostic_submetrics_template', {
            'positive_sentence_template': 'third',
            'submetric': 'MARKET_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
            'negative_sentence_template': ''
        })
        base.create('diagnostic_submetrics_template', {
            'positive_sentence_template': 'second',
            'submetric': 'JOB_SEARCH_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
            'negative_sentence_template': ''
        })

        with self.assertRaises(ValueError):
            airtable_to_protos.airtable2dicts(
                'base456', 'diagnostic_submetrics_template', 'DiagnosticSubmetricsSentenceTemplate')


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
