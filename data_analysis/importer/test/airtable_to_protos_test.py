"""Tests for the bob_emploi.importer.airtable_to_protos module."""

import os
import typing
from typing import Any, Dict, List, Mapping, Optional, Sequence
import unittest
from unittest import mock

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.i18n import translation
from bob_emploi.frontend.api import network_pb2

# TODO(cyrille): Split in several files and drop the following rule disabling.
# pylint: disable=too-many-lines


class BrokenConverter(airtable_to_protos.ProtoAirtableConverter):
    """A converter with broken function, for testing purposes."""

    def _record2dict(
            self, unused_airtable_record: airtable.Record[Mapping[str, Any]]) -> Dict[str, Any]:
        return {'_id': '', 'missing_field': ''}


# TODO(cyrille): Do test on all declarative statetements instead of all converters.
class _ConverterTestCase(airtablemock.TestCase):
    """Base class for tests for the converter."""

    _base_name = 'FAKE_BASE'

    converter_id = ''

    must_check_translations = False

    def setUp(self) -> None:
        super().setUp()
        self._base = airtablemock.Airtable(self._base_name, 'apikey42')
        self._table = self.converter_id
        airtablemock.create_empty_table(self._base_name, self._table)
        translation._TRANSLATION_TABLE = []  # pylint: disable=protected-access
        airtablemock.create_empty_table('appkEc8N0Bw4Uok43', 'tblQL7A5EgRJWhQFo')
        if self.must_check_translations:
            self._translation_base = airtablemock.Airtable('appkEc8N0Bw4Uok43', 'apikey42')
        else:
            patcher = mock.patch(
                translation.__name__ + '.fetch_missing_translation_locales')
            mock_translate = patcher.start()
            mock_translate.return_value = {}
            self.addCleanup(patcher.stop)

    def add_record(self, record: Dict[str, Any]) -> str:
        """Adds a record in the table to be imported.

        Returns its created ID.
        """

        return typing.cast(str, self._base.create(self._table, record)['id'])

    def add_translation(self, string: str, translations: Dict[str, str]) -> None:
        """Adds a translation to the translations table. """

        self.assertTrue(
            self.must_check_translations,
            msg='This test case will never check translations. '
            'Set its class attribute must_check_translations if you need it.')

        self._translation_base.create('tblQL7A5EgRJWhQFo', dict(translations, string=string))

    @mock.patch.dict(os.environ, {'AIRTABLE_API_KEY': 'apikey42'})
    def airtable2dicts(
            self, *, should_drop_id_and_order: bool = True,
            table: Optional[str] = None, alt_table: Optional[str] = None,
            collection_name: str = 'my_collection') -> List[Dict[str, Any]]:
        """Converts records from the table to dicts."""

        raw = airtable_to_protos.airtable2dicts(
            collection_name=collection_name, base_id=self._base_name,
            table=table or self._table, proto=self.converter_id,
            alt_table=alt_table)
        if should_drop_id_and_order:
            for imported in raw:
                del imported['_id']
                del imported['_order']
        return raw


class BrokenConverterTestCase(_ConverterTestCase):
    """Test a broken converter."""

    converter_id = 'broken'

    def setUp(self) -> None:
        airtable_to_protos.PROTO_CLASSES['broken'] = BrokenConverter(
            network_pb2.ContactLeadTemplate, None, [])
        super().setUp()

    def test_broken_converter(self) -> None:
        """A broken converter should fail."""

        self.add_record({})
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class AdviceModuleConverterTestCase(_ConverterTestCase):
    """Tests for the Advice Module converter."""

    converter_id = 'AdviceModule'

    def test_missing_required_fields(self) -> None:
        """Test that the converter fails when required fields are missing."""

        self.add_record({'title': 'Foo', 'advice_id': 'bla'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_convert_all_required_fields(self) -> None:
        """Test that the converter succeeds when required fields are there."""

        airtable_id = self.add_record({
            'advice_id': 'Foo',
            'trigger_scoring_model': 'constant(2)',
        })
        self.assertEqual([{
            'airtableId': airtable_id,
            'adviceId': 'Foo',
            'triggerScoringModel': 'constant(2)',
        }], self.airtable2dicts())

    def test_validate_scoring_model(self) -> None:
        """Test that the converter breaks when a trigger scoring model is not correct."""

        self.add_record({
            'advice_id': 'Foo',
            'trigger_scoring_model': 'not-implemented-yet',
        })
        self.assertRaises(ValueError, self.airtable2dicts)

    def test_advice_modules_categories(self) -> None:
        """Convert an advice module with its categories."""

        airtable_id = self.add_record({
            'advice_id': 'Foo',
            'trigger_scoring_model': 'constant(2)',
            'categories': ['hidden market', 'keep motivation'],
        })
        self.assertEqual([{
            'airtableId': airtable_id,
            'adviceId': 'Foo',
            'triggerScoringModel': 'constant(2)',
            'categories': ['hidden market', 'keep motivation']
        }], self.airtable2dicts())

    def test_airtable2dicts(self) -> None:
        """Basic usage of airtable2dicts."""

        self.add_record({
            'advice_id': 'my-advice',
            'trigger_scoring_model': 'constant(2)',
        })
        self.add_record({
            'advice_id': 'my-second-advice',
            'trigger_scoring_model': 'constant(3)',
        })

        protos = self.airtable2dicts()
        self.assertEqual(
            ['my-advice', 'my-second-advice'], sorted(m['adviceId'] for m in protos))

    def test_airtable2dicts_extrafields(self) -> None:
        """Basic usage of airtable2dicts."""

        id_1 = self.add_record({
            'advice_id': 'my-advice',
            'trigger_scoring_model': 'constant(2)',
        })
        id_2 = self.add_record({
            'advice_id': 'my-second-advice',
            'trigger_scoring_model': 'constant(3)',
        })

        protos = self.airtable2dicts(should_drop_id_and_order=False)
        self.assertEqual([id_1, id_2], [m['_id'] for m in protos])
        self.assertEqual([0, 1], [m['_order'] for m in protos])


class ActionTemplateConverterTestCase(_ConverterTestCase):
    """Tests for the Action Template converter."""

    converter_id = 'ActionTemplate'

    def test_curly_quote(self) -> None:
        """Test that we forbid curly quotes."""

        self.add_record({'title': 'Don’t do that'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_double_double_quotes(self) -> None:
        """Test that we forbid consecutive double quotes."""

        self.add_record({'title': 'Quotations should be in ""single double-quotes""'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_curly_quote_in_unused_field(self) -> None:
        """Test that we alllow curly quotes in fields that are not imported."""

        self.add_record({
            'title': 'The used title',
            'unused_title': 'Don’t do that',
        })
        self.assertTrue(self.airtable2dicts())

    def test_trailing_blank(self) -> None:
        """Test that we forbid strings with a trailing blank space."""

        self.add_record({'title': "Don't do that either "})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_trailing_inline_blank(self) -> None:
        """Test that we forbid strings with a trailing blank before a new line."""

        self.add_record({'title': "Don't do that either \nEven if it's tempting"})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_double_newline_allowed(self) -> None:
        """Test that we allow strings with double newlines."""

        self.add_record({'title': "It's makes it easier\n\nto create paragraphs."})
        self.assertTrue(self.airtable2dicts())

    def test_breakable_space(self) -> None:
        """Test that we forbid a breakable space before a French double punctuation mark."""

        self.add_record({'title': "'Voulez vous vraiment mettre une espace sécable ?"})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_no_useful_fields(self) -> None:
        """Converter fails when no fields from the proto are there."""

        self.add_record({'foo': 'bar'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    @mock.patch('logging.error')
    def test_several_errors(self, mock_logging: mock.MagicMock) -> None:
        """Test that an import error is issued for each incorrect record."""

        self.add_record({
            'title': ' This field has whitespace in front',
        })
        self.add_record({
            'title': 'This field has whitespace in back ',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()
        self.assertEqual(2, mock_logging.call_count, msg=mock_logging.call_args_list)

    def test_validate_links(self) -> None:
        """Test that the converter accepts a valid link."""

        self.add_record({'link': 'http://www.pole-emploi.fr'})
        self.assertTrue(self.airtable2dicts())

    def test_raises_on_invalid_links(self) -> None:
        """Test that the converter breaks when a link is not correct."""

        self.add_record({'link': 'www.pole-emploi.fr'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_raises_on_invalid_link_spaces(self) -> None:
        """Test that the converter breaks when a link has spaces."""

        self.add_record({'link': 'https://www.pole-emploi.fr (French PES)'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_link_field_template(self) -> None:
        """Test that the link field can be a templated URL."""

        self.add_record({
            'title': 'The title',
            'link': 'https://www.google.fr/?q=%cityName'
        })
        json_values = self.airtable2dicts()
        self.assertTrue(json_values)
        json_value = json_values.pop()
        self.assertFalse(json_values)
        self.assertEqual('https://www.google.fr/?q=%cityName', json_value.get('link'))

    def test_link_field_template_not_found(self) -> None:
        """Test that the link field is checked for unknown variables."""

        self.add_record({
            'title': 'The title',
            'link': 'https://www.google.fr/?q=%notAVariable'
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_image_url(self) -> None:
        """Test that the converter retrieves images' URL."""

        airtable_id = self.add_record({
            'image': [
                {'url': 'http://example.com/first.png', 'type': 'image/png'},
                {'url': 'http://example.com/second.jpg', 'type': 'image/jpeg'},
            ],
        })
        self.assertEqual([{
            'actionTemplateId': airtable_id,
            'imageUrl': 'http://example.com/first.png',
        }], self.airtable2dicts())

    def test_validate_filters(self) -> None:
        """Test that the converter accepts a valid filter."""

        self.add_record({'filters': ['for-job-group(A12)']})
        self.assertTrue(self.airtable2dicts())

    def test_raises_on_invalid_filter(self) -> None:
        """Test that the converter breaks when a filter is not correct."""

        self.add_record({'filters': ['this is not a filter']})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_curly_quote_in_list_field(self) -> None:
        """Test that we forbid curly quotes in lists of strings."""

        self.add_record({'filters': ['Don’t do that']})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_trimmable_space_in_list_field(self) -> None:
        """Test that we forbid spaces at start or end of strings in lists."""

        self.add_record({'chantiers': [" Don't do that", 'Or that ']})
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class JobBoardConverterTestCase(_ConverterTestCase):
    """Tests for the Job Board converter."""

    converter_id = 'JobBoard'

    def test_job_board(self) -> None:
        """Convert a job board."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
        })
        self.assertEqual([{
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
        }], self.airtable2dicts())

    def test_job_board_filters(self) -> None:
        """Convert a job board and add filters."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'for-departement': '49',
            'for-job-group': 'A12,B',
        })
        self.assertEqual([{
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'filters': ['for-departement(49)', 'for-job-group(A12,B)'],
        }], self.airtable2dicts())

    @mock.patch.dict(os.environ, {'BOB_DEPLOYMENT': 'usa'})
    def test_usa_job_board_filters(self) -> None:
        """Convert a job board and add filters."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'usa:for-departement': '4003',
            'for-job-group': 'A12,B',
            'usa:for-job-group': '11,12',
        })
        self.assertEqual([{
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'filters': ['for-departement(4003)', 'for-job-group(11,12)'],
        }], self.airtable2dicts())

    def test_job_board_encoded_url(self) -> None:
        """Make sure encoded special chars are not taken for missing template vars."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche?lieux=%cityId&redirect=%2F',
        })
        self.assertEqual([{
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche?lieux=%cityId&redirect=%2F',
        }], self.airtable2dicts())

    def test_job_board_missing_templalte(self) -> None:
        """Make sure encoded special chars are not taken for missing template vars."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche?lieux=%location',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_multiple_filters(self) -> None:
        """Do not accept redundant filters."""

        self.add_record({
            'title': 'Pôle emploi',
            'link': 'https://candidat.pole-emploi.fr/offres/recherche',
            'for-departement': '49',
            'filters': ['for-departement(49)'],
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


@mock.patch(translation.__name__ + '.LOCALES_TO_CHECK', frozenset({'fr@tu', 'en'}))
class TranslatableContactLeadConverterTestCase(_ConverterTestCase):
    """Tests for the contact leads converter translations."""

    converter_id = 'ContactLead'

    must_check_translations = True

    @mock.patch('logging.warning')
    def test_logs_warning(self, mock_logging: mock.MagicMock) -> None:
        """Test that the converter warns to import translations at conversion."""

        self.add_record({
            'email_template': '',
            'name': 'Name',
        })
        self.add_translation('Name', {'fr@tu': 'Nom', 'en': 'Name'})
        self.airtable2dicts()
        self.assertTrue(
            any('import translations' in call[0][0] for call in mock_logging.call_args_list),
            msg=mock_logging.call_args_list)

    def test_raises_on_missing_translation(self) -> None:
        """Test that the converter breaks when a translation is missing."""

        self.add_record({
            'email_template': 'Hé, tu te souviens de moi\u00a0?',
            'name': 'English name without translation',
        })
        self.assertRaises(ValueError, self.airtable2dicts)

    def test_ok_on_present_translation(self) -> None:
        """Test that the converter passes when all needed translations are present."""

        self.add_record({
            'email_template': 'Hé, tu te souviens de moi\u00a0?',
            'name': 'English name',
        })
        self.add_translation('English name', {'fr@tu': 'Nom anglais', 'en': 'English name'})
        self.add_translation('Hé, tu te souviens de moi\u00a0?', {
            'fr@tu': 'Hé, tu te souviens de moi\u00a0?',
            'en': 'Hey, do you remember me?',
        })
        contact_leads = self.airtable2dicts()
        self.assertEqual(1, len(contact_leads))
        contact_lead = contact_leads[0]
        # Translation should not have modified the JSON.
        self.assertEqual({
            'emailTemplate': 'Hé, tu te souviens de moi\u00a0?',
            'name': 'English name',
        }, contact_lead)

    def test_translation_is_checked(self) -> None:
        """Test that the converter fails if translation does not satisfy some checks."""

        self.add_record({
            'email_template': 'Hé, tu te souviens de moi\u00a0?',
            'name': 'English name',
        })
        self.add_translation('English name', {'fr@tu': 'Nom anglais', 'en': 'English name'})
        self.add_translation('Hé, tu te souviens de moi\u00a0?', {
            # %souviens is not a valid template var.
            'fr@tu': 'Hé, tu te %souviens de moi\u00a0?',
            'en': 'Hey, do you remember me?',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_en_translation_checks(self) -> None:
        """Test that the converter fails if English version does not satisfy some en checks."""

        self.add_record({
            'email_template': 'Hé, tu te souviens de moi\u00a0?',
            'name': 'English name',
        })
        self.add_translation('English name', {'fr@tu': 'Nom anglais', 'en': 'English name'})
        self.add_translation('Hé, tu te souviens de moi\u00a0?', {
            'fr@tu': 'Hé, tu te souviens de moi\u00a0?',
            'en': 'Hey, do you remember me\u00A0?',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class ContactLeadConverterTestCase(_ConverterTestCase):
    """Tests for the contact leads converter."""

    converter_id = 'ContactLead'

    def test_missing_templates_contact_lead(self) -> None:
        """Test that the converter for contact lead fails with missing template variables."""

        self.add_record({
            'name': 'Le maire %ofCity',
            'filters': ['for-experienced(6)'],
            'email_template': 'Hi Mr.Mayor! Do you know any %helpful people?',
            'card_content': 'Look at %bob advice!',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_filter_for_template_contact_lead(self) -> None:
        """Test that the converter for contact lead fails with template variable needing a filter.
        """

        self.add_record({
            'name': 'Le maire %ofCity',
            'filters': ['for-experienced(6)'],
            'email_template': "I've been searching for %jobSearchLengthMonthsAtCreation months",
            'card_content': 'Look at this advice!',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_contact_lead_converter(self) -> None:
        """Convert a Contact Lead template."""

        self.add_record({
            'name': 'Le maire %ofCity',
            'filters': ['for-experienced(6)'],
            'email_template': 'Hi Mr.Mayor!',
        })
        self.assertEqual([{
            'name': 'Le maire %ofCity',
            'filters': ['for-experienced(6)'],
            'emailTemplate': 'Hi Mr.Mayor!',
        }], self.airtable2dicts())


class DynamicAdviceConverterTestCase(_ConverterTestCase):
    """Tests for the dynamic advice converter."""

    converter_id = 'DynamicAdvice'

    def test_dynamic_advice_converter(self) -> None:
        """Convert a dynamic advice config."""

        self.add_record({
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'être malin-e',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'fr:for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
            'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
        })
        self.assertEqual([{
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'shortTitle': 'Astuces de boulangers',
            'diagnosticTopics': ['MARKET_DIAGNOSTIC'],
            'goal': 'être malin-e',
            'cardText': 'Allez à la boulangerie la veille',
            'filters': ['not-for-job(12006)', 'for-job-group(D1102)'],
            'expandedCardHeader': 'Il *faut*',
            'expandedCardItems': ['Se présenter', 'Très tôt'],
            'expandedCardItemsFeminine': ['Se représenter', 'Très tôt'],
        }], self.airtable2dicts())

    def test_dynamic_advice_converter_wrong_format(self) -> None:
        """Convert a dynamic advice config with wrong items list format."""

        self.add_record({
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'goal': 'être malin-e',
            'fr:for-job-group': 'D1102',
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': '* Se présenter\ntrès tôt',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_dynamic_advice_goal_sentence_enforce_format(self) -> None:
        """Convert a dynamic advice config with goal sentence with wrong format."""

        self.add_record({
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'être malin-e.',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'fr:for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
            'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_dynamic_advice_goal_sentence_enforce_format_two(self) -> None:
        """Convert a dynamic advice config with goal sentence with wrong format two."""

        self.add_record({
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'Manger du pain',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'fr:for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
            'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    @mock.patch('logging.error')
    def test_dynamic_advice_several_errors(self, mock_logging: mock.MagicMock) -> None:
        """Convert a dynamic advice config with errors on several card items."""

        self.add_record({
            'id': 'baker',
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'manger du pain',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'fr:for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter :\n* Très tôt !',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn('expanded_card_items.0', error_message)
        self.assertIn('expanded_card_items.1', error_message)


class TestimonialConverterTestCase(_ConverterTestCase):
    """Tests for the testimonial converter."""

    converter_id = 'Testimonial'

    def test_entrepreneur_testimonial_converter(self) -> None:
        """Convert a entrepreneur's testimonial."""

        self.add_record({
            'author_name': 'Céline',
            'author_job_name': 'Ostéopathe',
            'description': 'Il fallait se lancer.',
            'filters': ['not-for-job(12006)'],
            'preferred_job_group_ids': 'D1102, D1403,D2305',
            'link': 'www.gothere.org',
            'image_link': 'www.this-image.org',
        })
        self.assertEqual([{
            'authorName': 'Céline',
            'authorJobName': 'Ostéopathe',
            'description': 'Il fallait se lancer.',
            'filters': ['not-for-job(12006)'],
            'preferredJobGroupIds': ['D1102', 'D1403', 'D2305'],
            'link': 'www.gothere.org',
            'imageLink': 'www.this-image.org',
        }], self.airtable2dicts())


class DiagnosticResponsesConverterTestCase(_ConverterTestCase):
    """Tests for the diagnostic responses converter."""

    converter_id = 'DiagnosticResponse'

    def test_correct_record(self) -> None:
        """A diagnostic response is correctly converted."""

        self.add_record({
            'response_id': 'bravo:enhance-methods-to-interview',
            'bob_main_challenge_id': 'bravo',
            'self_main_challenge_id': 'enhance-methods-to-interview',
            'text': 'My response is that everything is cool.',
        })

        self.assertEqual(1, len(self.airtable2dicts()))

    def test_missing_field(self) -> None:
        """A diagnostic response needs all the fields."""

        self.add_record({
            'response_id': 'bravo:enhance-methods-to-interview',
            'bob_main_challenge_id': 'bravo',
            'self_main_challenge_id': 'enhance-methods-to-interview',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()


class DiagnosticOverallConverterTestCase(_ConverterTestCase):
    """Tests for the diagnostic overall converter."""

    converter_id = 'DiagnosticTemplate'

    def test_correct_record(self) -> None:
        """A diagnostic overall is correctly converted."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is **why** you got this score.',
        })

        self.assertEqual(1, len(self.airtable2dicts()))

    def test_missing_score(self) -> None:
        """A diagnostic overall needs a score."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_order(self) -> None:
        """A diagnostic overall needs an order."""

        self.add_record({
            'category_id': ['bravo'],
            'text_template': 'This is why you got this score.',
            'score': 50,
            'sentence_template': 'Hello world',
        })

        with self.assertRaises((KeyError, ValueError)):
            self.airtable2dicts()

    def test_missing_sentence(self) -> None:
        """A diagnostic overall needs a sentence."""

        self.add_record({
            'category_id': ['bravo'],
            'text_template': 'This is why you got this score.',
            'order': 0,
            'score': 50,
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_description(self) -> None:
        """A diagnostic overall needs a description."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'score': 50,
            'sentence_template': 'Hello world',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_bad_markup_language(self) -> None:
        """A diagnostic overall text needs proper markup language."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is **why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_bad_unicode_linebreak(self) -> None:
        """A diagnostic overall text cannot have a unicode linebreak char."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is \u2028why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_wrong_order(self) -> None:
        """Diagnostic overalls need to be sorted by order."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Less important hello world',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'score': 50,
            'sentence_template': 'Hello world',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_wrong_order_because_of_filters(self) -> None:
        """More precise filters shouldn't be found just after more general ones."""

        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search', 'for-long-term-mom'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will never be reached because active search are already caught',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_same_filters_twice(self) -> None:
        """It's useless to have the same filters twice."""

        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will never be reached because active search are already caught',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_same_filters_twice_apart(self) -> None:
        """It's useless to have the same filters twice, even non-consecutive."""

        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'category_id': ['bravo'],
            'filters': ['constant(3)'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Has nothing to do with active-search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'category_id': ['bravo'],
            'filters': ['for-active-search'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will never be reached because active search are already caught',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_wrong_order_because_of_previous_filters(self) -> None:
        """More precise filters shouldn't be found after more general ones."""

        self.add_record({
            'category_id': ['bravo'],
            'text_template': 'This is why you got this score.',
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
        })
        self.add_record({
            'category_id': ['bravo'],
            'text_template': 'This is why you got this score.',
            'filters': ['for-employed'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will catch all employed people',
        })
        self.add_record({
            'category_id': ['bravo'],
            'text_template': 'This is why you got this score.',
            'filters': ['for-active-search', 'for-long-term-mom'],
            'order': 3,
            'score': 50,
            'sentence_template': 'Will never be reached because active search are already caught',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_order_thanks_to_category(self) -> None:
        """Sorting use category ID first."""

        self.add_record({
            'text_template': 'This is why you got this score.',
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'category_id': ['bravo'],
        })
        self.add_record({
            'text_template': 'This is why you got this score.',
            'filters': ['for-employed'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will catch all employed people',
            'category_id': ['bravo'],
        })
        self.add_record({
            'text_template': 'This is why you got this score.',
            'filters': ['for-active-search', 'for-long-term-mom'],
            'order': 3,
            'score': 50,
            'sentence_template': 'Will be reached because user in stuck-market disregard others',
            'category_id': ['stuck-market'],
        })

        self.airtable2dicts()

    def test_category_id_as_array(self) -> None:
        """When containing a category ID in an array (because of how lookup works on Airtable)."""

        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is why you got this score.',
            'category_id': ['stuck-market'],
        })

        dicts = self.airtable2dicts()
        self.assertEqual(1, len(dicts), msg=dicts)
        self.assertEqual('stuck-market', dicts[0].get('categoryId'))

    def test_variable(self) -> None:
        """A diagnostic overall using a job group template."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world %inDomain',
            'score': 50,
            'text_template': 'This is why you got this score.',
        })

        self.assertEqual(1, len(self.airtable2dicts()))

    def test_paragraph(self) -> None:
        """A diagnostic supports paragraphs in text_template."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is **why** you got this score.\n\nAnd you should be happy.',
        })

        self.assertEqual(1, len(self.airtable2dicts()))

    @mock.patch('logging.error')
    def test_fake_paragraph(self, mock_logging: mock.MagicMock) -> None:
        """A diagnostic enforces real paragraphs in text_template, not simple line breaks."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is **why** you got this score.\nAnd you should be happy.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn('line break', error_message)
        self.assertIn('you got this score.\nAnd you should ', error_message)

    @mock.patch('logging.error')
    def test_blank_error_message(self, mock_logging: mock.MagicMock) -> None:
        """A diagnostic overall with a trailing blank at the end of an internal line."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is why \n\nyou got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn(
            'Extra spaces at the beginning or end in the field "text_template"', error_message)
        self.assertIn('This is why** **\\n\\nyou got this score.', error_message)

    @mock.patch('logging.error')
    def test_nbsp_error_message(self, mock_logging: mock.MagicMock) -> None:
        """A diagnostic overall using &nbsp;."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is&nbsp;why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn(
            '&nbsp; are not allowed in the field "text_template"', error_message)
        self.assertIn('This is**&nbsp;**why you got this score.', error_message)

    @mock.patch('logging.error')
    def test_single_liner_error_message(self, mock_logging: mock.MagicMock) -> None:
        """A diagnostic overall with a line break in the sentence template."""

        self.add_record({
            'category_id': ['bravo'],
            'order': 0,
            'sentence_template': 'Hello\n\nworld',
            'score': 50,
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn('a single line', error_message)
        self.assertIn('Hello\n\nworld', error_message)


class DiagnosticMainChallengeConverterTestCase(_ConverterTestCase):
    """Tests for the DiagnosticMainChallenge converter."""

    converter_id = 'DiagnosticMainChallenge'

    def test_order_needed(self) -> None:
        """Cannot import a category without an order."""

        self.add_record({'category_id': 'stuck-market'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_id_needed(self) -> None:
        """Cannot import a category without its ID."""

        self.add_record({'order': 1})
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_description_needed(self) -> None:
        """Cannot import a category without its description."""

        self.add_record({
            'category_id': 'stuck-market',
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_can_import_with_order_and_id(self) -> None:
        """Can import with only an order and an ID."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'I have a bad market',
            'order': 1,
        })
        self.assertTrue(self.airtable2dicts())

    def test_filters_are_models(self) -> None:
        """Cannot import if a filter is unknown."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'I have a bad market',
            'filters': ['unknown-scoring-model'],
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_sorted_by_order(self) -> None:
        """Import categories if they're ordered."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'I have a bad market',
            'filters': ['not-for-unstressed-market(10/7)'],
            'order': 1,
        })
        self.add_record({
            'category_id': 'bad-network',
            'description': 'I have a bad market',
            'filters': ['for-network(1)'],
            'order': 2,
        })
        self.assertEqual(2, len(self.airtable2dicts()))

    def test_unsorted_by_order(self) -> None:
        """Cannot import categories if they're not ordered."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'I have a bad market',
            'filters': ['not-for-unstressed-market(10/7)'],
            'order': 2,
        })
        self.add_record({
            'description': 'I have a bad market',
            'category_id': 'bad-profile',
            'filters': ['for-network(1)'],
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_unsorted_by_filters(self) -> None:
        """Cannot import categories if some earlier one completely covers a later one."""

        self.add_record({
            'description': 'I have a bad market',
            'category_id': 'stuck-market',
            'filters': [],
            'order': 1,
        })
        self.add_record({
            'description': 'I have a bad market',
            'category_id': 'bad-profile',
            'filters': ['for-network(1)'],
            'order': 2,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_description_should_not_be_punctuated(self) -> None:
        """Stop import if a description ends with a dot."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'I have a bad market.',
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_description_should_have_uppercase(self) -> None:
        """Stop import if a description does not start with an uppercase letter."""

        self.add_record({
            'category_id': 'stuck-market',
            'description': 'my market is bad',
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_achievement_should_not_be_punctuated(self) -> None:
        """Stop import if an achievement ends with a dot."""

        self.add_record({
            'category_id': 'missing-diploma',
            'achievement_text': 'Good diploma.',
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_achievement_should_have_uppercase(self) -> None:
        """Stop import if an achievement text does not start with an uppercase letter."""

        self.add_record({
            'category_id': 'stuck-market',
            'achievement_text': 'bad market',
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class StrategyAdviceTemplateConverterTestCase(_ConverterTestCase):
    """Test for the strategy advice templates, which convert an array to a single element."""

    converter_id = 'StrategyAdviceTemplate'

    def test_basic(self) -> None:
        """Should work in a basic case."""

        self.add_record({
            'advice_id': ['commute'],
            'header_template': 'Voici comment commuter.',
            'strategy_id': ['rec0123456789'],
        })
        self.assertEqual([{
            'adviceId': 'commute',
            'headerTemplate': 'Voici comment commuter.',
            'strategyId': 'rec0123456789',
        }], self.airtable2dicts())

    @mock.patch('logging.error')
    def test_dupes(self, mock_logging: mock.MagicMock) -> None:
        """Should warn when two records have the same strategy/advice."""

        self.add_record({
            'advice_id': ['commute'],
            'header_template': 'Voici comment commuter.',
            'strategy_id': ['rec0123456789'],
        })
        self.add_record({
            'advice_id': ['commute'],
            'header_template': 'Voici comment commuter différement.',
            'strategy_id': ['rec0123456789'],
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()
        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn('There are duplicate records', error_message)


class MailingCampaignConverterTestCase(_ConverterTestCase):
    """Tests for the campaign converter."""

    converter_id = 'Campaign'

    must_check_translations = True

    def test_missing_campaign(self) -> None:
        """A missing campaign should not be importable."""

        self.add_record({
            'campaign_id': 'unknown-campaign',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    @mock.patch(airtable_to_protos.checker.mailjet_templates.__name__ + '.MAP', new={
        'french-campaign': {'mailjetTemplate': 279688, 'name': 'french-campaign'},
    })
    def test_fr_campaign(self) -> None:
        """An existing campaign can be imported in French."""

        self.add_record({
            'campaign_id': 'french-campaign',
        })
        self.assertEqual(1, len(self.airtable2dicts()))

    @mock.patch(airtable_to_protos.checker.mailjet_templates.__name__ + '.MAP', new={
        'french-campaign': {'mailjetTemplate': 279688, 'name': 'french-campaign'},
    })
    @mock.patch(
        airtable_to_protos.checker.translation.__name__ + '.LOCALES_TO_CHECK',
        new=frozenset(['en']))
    def test_missing_english_campaign(self) -> None:
        """A campaign without relevant translation should not be importable."""

        self.add_record({
            'campaign_id': 'french-campaign',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    @mock.patch(airtable_to_protos.checker.mailjet_templates.__name__ + '.MAP', new={
        'my-campaign': {'mailjetTemplate': 279688, 'name': 'my-campaign', 'i18n': {'en': 1234}},
    })
    @mock.patch(
        airtable_to_protos.checker.translation.__name__ + '.LOCALES_TO_CHECK',
        new=frozenset(['en']))
    def test_en_campaign(self) -> None:
        """A translated campaign can be imported."""

        self.add_record({
            'campaign_id': 'my-campaign',
        })
        self.assertEqual(1, len(self.airtable2dicts()))

    @mock.patch(airtable_to_protos.checker.mailjet_templates.__name__ + '.MAP', new={
        'french-campaign': {'mailjetTemplate': 279688, 'name': 'french-campaign'},
    })
    def test_favor_strategy_scoring_model(self) -> None:
        """The favor-strategy scoring model is used."""

        self.add_record({
            'campaign_id': 'french-campaign',
            'favor-strategy': ['other-leads', 'other-leads-covid'],
        })
        dicts = self.airtable2dicts()
        self.assertEqual(1, len(dicts))
        self.assertIn('scoringModel', dicts[0])
        self.assertEqual('favor-strategy(other-leads,other-leads-covid)', dicts[0]['scoringModel'])

    @mock.patch(airtable_to_protos.checker.mailjet_templates.__name__ + '.MAP', new={
        'french-campaign': {'mailjetTemplate': 279688, 'name': 'french-campaign'},
    })
    def test_favor_strategy_conflicts(self) -> None:
        """The favor-strategy conflicts with the scoring model."""

        self.add_record({
            'campaign_id': 'french-campaign',
            'favor-strategy': ['other-leads', 'other-leads-covid'],
            'scoring_model': 'constant(2)',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class _VariousUniqueKeysConverter(airtable_to_protos.ProtoAirtableConverter):

    def __init__(self) -> None:
        super().__init__(network_pb2.ContactLeadTemplate)

    def unique_keys(self, proto_record: Mapping[str, Any]) -> Sequence[Any]:
        """Function to return keys that should be unique among other records."""

        # Return each letter as a unique key. Note that it can only work if the record all have
        # names with the same number of letters.
        return tuple((letter,) for letter in proto_record.get('name', ''))


@mock.patch.dict(
    airtable_to_protos.PROTO_CLASSES, {'various_unique_keys': _VariousUniqueKeysConverter()})
class VariousUniqueKeysConverterTest(_ConverterTestCase):
    """Test a converter that have various number of unique keys."""

    converter_id = 'various_unique_keys'

    @mock.patch('logging.error')
    def test_various_unique_keys(self, mock_logging: mock.MagicMock) -> None:
        """Checks that if the converter changes the number of keys it returns, tests fail."""

        self.add_record({'name': '1'})
        self.add_record({'name': 'four'})
        with self.assertRaises(ValueError):
            self.airtable2dicts()
        mock_logging.assert_called_once()
        error_message = mock_logging.call_args[0][0] % mock_logging.call_args[0][1:]
        self.assertIn('does not have the same number of unique keys', error_message)


class AirtableToProtosTests(_ConverterTestCase):
    """Test the main function of airtable_to_protos script."""

    converter_id = 'AdviceModule'

    must_check_translations = True

    def setUp(self) -> None:
        super().setUp()
        airtable_id = self.add_record({
            'advice_id': 'Foo',
            'trigger_scoring_model': 'constant(2)',
        })
        self._expected_records = [{
            'airtableId': airtable_id,
            'adviceId': 'Foo',
            'triggerScoringModel': 'constant(2)',
        }]

    def test_alt_table(self) -> None:
        """Test that we fallback to the alt_table."""

        self.assertEqual(
            self._expected_records,
            self.airtable2dicts(table='other-table-name', alt_table=self._table))

    def test_alt_table_fails(self) -> None:
        """Test that we properly fail if both talbe and alt_table are missing."""

        with self.assertRaises(Exception):
            self.airtable2dicts(table='other-table-name', alt_table='other-table-name')

    def test_alt_table_only_as_fallback(self) -> None:
        """Test that the main table has priority over the alt_table."""

        self._base.create('alternative table', {
            'advice_id': 'No show',
            'trigger_scoring_model': 'constant(2)',
        })

        self.assertEqual(self._expected_records, self.airtable2dicts(alt_table='alternative table'))

    def test_i18n_translate_key_is_missing(self) -> None:
        """Test that the import fails if a required keyed translation is missing."""

        self.add_record({
            'advice_id': 'my-custom-advice',
            'trigger_scoring_model': 'constant(2)',
            'title': 'French version of the title',
        })

        self.add_translation('French version of the title', {
            'en': 'English version of the title',
            'fr@tu': 'Fr tutoiement version of the title',
        })

        self.add_translation('myCollection:my-custom-advice:title', {})

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_i18n_translate_with_key(self) -> None:
        """Test that the import works if the key is translated."""

        self.add_record({
            'advice_id': 'my-custom-advice',
            'trigger_scoring_model': 'constant(2)',
            'title': 'French version of the title',
        })

        self.add_translation('myCollection:my-custom-advice:title', {
            'en': 'English version of the title',
            'fr@tu': 'Fr tutoiement version of the title\u00a0: cool',
        })

        self.airtable2dicts()

    def test_i18n_translate_with_key_is_checked(self) -> None:
        """Test that the import works if the key is translated."""

        self.add_record({
            'advice_id': 'my-custom-advice',
            'trigger_scoring_model': 'constant(2)',
            'title': 'French version of the title',
        })

        self.add_translation('myCollection:my-custom-advice:title', {
            'en': 'English version of the title',
            'fr@tu': 'Fr tutoiement version of the title : without the proper spacing before :',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


if __name__ == '__main__':
    unittest.main()
