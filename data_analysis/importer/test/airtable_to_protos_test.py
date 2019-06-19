"""Tests for the bob_emploi.importer.airtable_to_protos module."""

import typing
import unittest
from unittest import mock

import airtablemock

from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.i18n import translation
from bob_emploi.frontend.api import network_pb2

# TODO(cyrille): Split in several files and drop the following rule disabling.
# pylint: disable=too-many-lines


class BrokenConverter(airtable_to_protos.ProtoAirtableConverter):
    """A converter with broken function, for testing purposes."""

    def _record2dict(self, unused_airtable_record: typing.Dict[str, typing.Any]) \
            -> typing.Dict[str, typing.Any]:
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

    def add_record(self, record: typing.Dict[str, typing.Any]) -> str:
        """Adds a record in the table to be imported.

        Returns its created ID.
        """

        return typing.cast(str, self._base.create(self._table, record)['id'])

    def add_translation(self, string: str, translations: typing.Dict[str, str]) -> None:
        """Adds a translation to the translations table. """

        self.assertTrue(
            self.must_check_translations,
            msg='This test case will never check translations. '
            'Set its class attribute must_check_translations if you need it.')

        self._translation_base.create('tblQL7A5EgRJWhQFo', dict(translations, string=string))

    @mock.patch(airtable_to_protos.__name__ + '._AIRTABLE_API_KEY', new='apikey42')
    def airtable2dicts(self, should_drop_id: bool = True) \
            -> typing.List[typing.Dict[str, typing.Any]]:
        """Converts records from the table to dicts."""

        raw = airtable_to_protos.airtable2dicts(self._base_name, self._table, self.converter_id)
        if should_drop_id:
            for imported in raw:
                del imported['_id']
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

    @mock.patch(airtable_to_protos.logging.__name__ + '.error')
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
        self.add_translation('Name', {'fr_FR@tu': 'Nom'})
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
        self.add_translation('English name', {'fr_FR@tu': 'Nom anglais'})
        self.add_translation(
            'Hé, tu te souviens de moi\u00a0?', {'fr_FR@tu': 'Hé, tu te souviens de moi\u00a0?'})
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
        self.add_translation('English name', {'fr_FR@tu': 'Nom anglais'})
        self.add_translation(
            'Hé, tu te souviens de moi\u00a0?', {'fr_FR@tu': 'Hé, %tu te souviens de moi\u00a0?'})
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
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'être malin-e',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
            'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
        })
        self.assertEqual([{
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
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'goal': 'être malin-e',
            'for-job-group': 'D1102',
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': '* Se présenter\ntrès tôt',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_dynamic_advice_goal_sentence_enforce_format(self) -> None:
        """Convert a dynamic advice config with goal sentence with wrong format."""

        self.add_record({
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'être malin-e.',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'for-job-group': 'D1102',
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
            'title': 'Présentez-vous au chef boulanger',
            'short_title': 'Astuces de boulangers',
            'goal': 'Manger du pain',
            'diagnostic_topics': ['MARKET_DIAGNOSTIC'],
            'for-job-group': 'D1102',
            'filters': ['not-for-job(12006)'],
            'card_text': 'Allez à la boulangerie la veille',
            'expanded_card_items': 'Il *faut*\n* Se présenter\n* Très tôt',
            'expanded_card_items_feminine': '* Se représenter\n* Très tôt',
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()


class DiagnosticSentenceTemplateConverterTestCase(_ConverterTestCase):
    """Tests for the diagnosic sentence template converter."""

    converter_id = 'DiagnosticSentenceTemplate'

    def test_diagnostic_sentence_missing_template_var(self) -> None:
        """Convert a diagnostic sentence with a missing template var."""

        self.add_record({
            'sentence_template': 'I have an %unknownVar',
            'filters': ['for-job-group(A12)'],
            'order': 2,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_airtable2dicts_sorted_diagnostic_sentence(self) -> None:
        """Use of airtable2dicts when records need to be sorted."""

        self.add_record({
            'sentence_template': 'first %inCity',
            'order': 1,
        })
        self.add_record({
            'sentence_template': 'fifth',
            'order': 2,
        })
        self.add_record({
            'sentence_template': 'second',
            'order': 1,
        })
        self.add_record({
            'sentence_template': 'fourth',
            'filters': ['for-job-group(A12)'],
            'order': 2,
            'priority': 2,
        })
        self.add_record({
            'sentence_template': 'third',
            'filters': ['for-job-group(A12)'],
            'order': 2,
            'priority': 4,
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()


class DiagnosticSubmetricScorerConverterTestCase(_ConverterTestCase):
    """Tests for the diagnosic scorer sentence template converter."""

    converter_id = 'DiagnosticSubmetricScorer'

    def test_diagnostic_submetric_sentence(self) -> None:
        """Convert a diagnostic submetric sentence."""

        self.add_record({
            'name': 'Too few Applications',
            'submetric': 'JOB_SEARCH_DIAGNOSTIC',
            'weight': .2,
            'trigger_scoring_model': 'constant(3)',
        })
        self.airtable2dicts()

    def test_airtable2dicts_sorted_diagnostic_submetrics_sentence(self) -> None:
        """Use of airtable2dicts when records need to be sorted."""

        self.add_record({
            'submetric': 'JOB_SEARCH_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
        })
        self.add_record({
            'submetric': 'MARKET_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
        })
        self.add_record({
            'submetric': 'JOB_SEARCH_DIAGNOSTIC',
            'name': 'foo',
            'weight': 1,
            'trigger_scoring_model': 'constant(2)',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()


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


class DiagnosticSubmetricSentenceConverterTestCase(_ConverterTestCase):
    """Tests for the diagnostic submetric sentence converter."""

    converter_id = 'DiagnosticSubmetricSentenceTemplate'

    def test_airtable2dicts_unsorted_diagnostic_submetric_sentences(self) -> None:
        """Use of airtable2dicts for diagnostic submetric sentences which need to be sorted."""

        self.add_record({
            'sentence_template': 'fourth',
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 1,
        })
        self.add_record({
            'sentence_template': 'third',
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 2,
        })
        self.add_record({
            'sentence_template': 'second',
            'filters': ['constant(3)'],
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 2,
        })
        self.add_record({
            'sentence_template': 'first',
            'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            'priority': 1,
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_filters_unsorted(self) -> None:
        """A record with less filters shouldn't be before one with more filters, even with a lesser
        priority."""

        self.add_record({
            'sentence_template': 'second',
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 3,
        })
        self.add_record({
            'sentence_template': 'first',
            'filters': ['constant(3)'],
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 2,
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_airtable2dicts_sorted_diagnostic_submetric_sentences(self) -> None:
        """Use of airtable2dicts for diagnostic submetric sentences which are already sorted."""

        self.add_record({
            'sentence_template': 'first',
            'topic': 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
            'priority': 1,
        })
        self.add_record({
            'sentence_template': 'second',
            'filters': ['constant(3)', 'for-active-search'],
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 1,
        })
        self.add_record({
            'sentence_template': 'third',
            'filters': ['constant(3)'],
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 2,
        })
        self.add_record({
            'filters': ['constant(2)'],
            'sentence_template': 'fourth',
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 1,
        })
        self.add_record({
            'sentence_template': 'fifth',
            'topic': 'MARKET_DIAGNOSTIC',
            'priority': 1,
        })

        dicts = self.airtable2dicts()
        self.assertEqual(
            ['first', 'second', 'third', 'fourth', 'fifth'], [r['sentenceTemplate'] for r in dicts])


class DiagnosticOverallConverterTestCase(_ConverterTestCase):
    """Tests for the diagnostic overall converter."""

    converter_id = 'DiagnosticTemplate'

    def test_correct_record(self) -> None:
        """A diagnostic overall is correctly converted."""

        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
            'score': 50,
            'text_template': 'This is why you got this score.',
        })

        self.assertEqual(1, len(self.airtable2dicts()))

    def test_missing_score(self) -> None:
        """A diagnostic overall needs a score."""

        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
            'text_template': 'This is why you got this score.',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_order(self) -> None:
        """A diagnostic overall needs an order."""

        self.add_record({
            'text_template': 'This is why you got this score.',
            'score': 50,
            'sentence_template': 'Hello world',
        })

        with self.assertRaises((KeyError, ValueError)):
            self.airtable2dicts()

    def test_missing_sentence(self) -> None:
        """A diagnostic overall needs a sentence."""

        self.add_record({
            'text_template': 'This is why you got this score.',
            'order': 0,
            'score': 50,
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_description(self) -> None:
        """A diagnostic overall needs a description."""

        self.add_record({
            'order': 0,
            'score': 50,
            'sentence_template': 'Hello world',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_wrong_order(self) -> None:
        """Diagnostic overalls need to be sorted by order."""

        self.add_record({
            'order': 1,
            'score': 50,
            'sentence_template': 'Less important hello world',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
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
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
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
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
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
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
            'filters': ['constant(3)'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Has nothing to do with active-search',
            'text_template': 'This is why you got this score.',
        })
        self.add_record({
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
            'text_template': 'This is why you got this score.',
            'filters': ['for-active-search'],
            'order': 1,
            'score': 50,
            'sentence_template': 'Will catch all active search',
        })
        self.add_record({
            'text_template': 'This is why you got this score.',
            'filters': ['for-employed'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will catch all employed people',
        })
        self.add_record({
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
        })
        self.add_record({
            'text_template': 'This is why you got this score.',
            'filters': ['for-employed'],
            'order': 2,
            'score': 50,
            'sentence_template': 'Will catch all employed people',
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


class DiagnosticObservationConverterTestCase(_ConverterTestCase):
    """Tests for the diagnostic observation converter."""

    converter_id = 'DiagnosticObservation'

    def test_missing_topic(self) -> None:
        """A diagnostic observation needs a submetric topic."""

        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_missing_order(self) -> None:
        """A diagnostic observation needs an order."""

        self.add_record({
            'sentence_template': 'Hello world',
            'topic': 'PROFILE_DIAGNOSTIC',
        })

        with self.assertRaises((KeyError, ValueError)):
            self.airtable2dicts()

    def test_missing_sentence(self) -> None:
        """A diagnostic observation needs a sentence."""

        self.add_record({
            'order': 0,
            'topic': 'PROFILE_DIAGNOSTIC',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_wrong_order(self) -> None:
        """Diagnostic observations need to be sorted by order in a given topic."""

        self.add_record({
            'order': 1,
            'sentence_template': 'Less important hello world',
            'topic': 'PROFILE_DIAGNOSTIC',
        })
        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
            'topic': 'PROFILE_DIAGNOSTIC',
        })

        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_order_between_topics(self) -> None:
        """Diagnostic observations order does not matter between topics."""

        self.add_record({
            'order': 1,
            'sentence_template': 'Less important hello world',
            'topic': 'PROFILE_DIAGNOSTIC',
        })
        self.add_record({
            'order': 0,
            'sentence_template': 'Hello world',
            'topic': 'PROJECT_DIAGNOSTIC',
        })

        self.assertEqual(2, len(self.airtable2dicts()))

    def test_import_attention(self) -> None:
        """Diagnostic observations can have an 'isAttentionNeeded' flag."""

        self.add_record({
            'is_attention_needed': True,
            'order': 1,
            'sentence_template': 'Less important hello world',
            'topic': 'PROFILE_DIAGNOSTIC',
        })

        converted_record = self.airtable2dicts()[0]
        self.assertTrue(converted_record.get('isAttentionNeeded'))


class DiagnosticCategoryConverterTestCase(_ConverterTestCase):
    """Tests for the DiagnosticCategory converter."""

    converter_id = 'DiagnosticCategory'

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

    def test_can_import_with_order_and_id(self) -> None:
        """Can import with only an order and an ID."""

        self.add_record({
            'category_id': 'stuck-market',
            'order': 1,
        })
        self.assertTrue(self.airtable2dicts())

    def test_filters_are_models(self) -> None:
        """Cannot import if a filter is unknown."""

        self.add_record({
            'category_id': 'stuck-market',
            'filters': ['unknown-scoring-model'],
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_sorted_by_order(self) -> None:
        """Import categories if they're ordered."""

        self.add_record({
            'category_id': 'stuck-market',
            'filters': ['not-for-unstressed-market(10/7)'],
            'order': 1,
        })
        self.add_record({
            'category_id': 'bad-network',
            'filters': ['for-network(1)'],
            'order': 2,
        })
        self.assertEqual(2, len(self.airtable2dicts()))

    def test_unsorted_by_order(self) -> None:
        """Cannot import categories if they're not ordered."""

        self.add_record({
            'category_id': 'stuck-market',
            'filters': ['not-for-unstressed-market(10/7)'],
            'order': 2,
        })
        self.add_record({
            'category_id': 'bad-profile',
            'filters': ['for-network(1)'],
            'order': 1,
        })
        with self.assertRaises(ValueError):
            self.airtable2dicts()

    def test_unsorted_by_filters(self) -> None:
        """Cannot import categories if some earlier one completely covers a later one."""

        self.add_record({
            'category_id': 'stuck-market',
            'filters': [],
            'order': 1,
        })
        self.add_record({
            'category_id': 'bad-profile',
            'filters': ['for-network(1)'],
            'order': 2,
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


if __name__ == '__main__':
    unittest.main()
