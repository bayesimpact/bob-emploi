"""Unit tests for the i18n.collect_strings module."""

import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import collect_strings


class CollecStringsTest(airtablemock.TestCase):
    """Unit tests for the main function."""

    def test_main(self):
        """Test collection of strings in various tables and fields."""

        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'explanations (for client)': 'my explanation',
            'title': 'First Advice',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'Second Advice',
        })
        bob_advice_base.create('diagnostic_sentences', {
            'sentence_template': 'A sentence template',
        })
        collect_strings.main('apikey')

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['A sentence template', 'First Advice', 'Second Advice', 'my explanation'],
            sorted(t.get('fields', {}).get('string') for t in translations))

    def test_duplicates(self):
        """Avoid creating duplicate rows for the same translation."""

        airtable.Airtable('appkEc8N0Bw4Uok43', '').create('translations', {
            'string': 'Already translated',
        })
        bob_advice_base = airtable.Airtable('appXmyc7yYj0pOcae', '')
        bob_advice_base.create('advice_modules', {
            'advice_id': 'first-advice',
            'title': 'Already translated',
            'explanations': 'New translation',
        })
        bob_advice_base.create('advice_modules', {
            'advice_id': 'second-advice',
            'title': 'New translation',
        })
        collect_strings.main('apikey')

        translations = \
            list(airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations'))
        self.assertEqual(
            ['Already translated', 'New translation'],
            sorted(t.get('fields', {}).get('string') for t in translations))


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
