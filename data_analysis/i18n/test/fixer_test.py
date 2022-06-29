"""Unit tests for the fixer module."""

from typing import Mapping
import unittest

from airtable import airtable
import airtablemock

from bob_emploi.data_analysis.i18n import fixer


class DownloadTranslationsTests(airtablemock.TestCase):
    """Unit tests for downloading translations."""

    def _get_all_translations(self) -> Mapping[str, Mapping[str, str]]:

        return {
            record['fields']['string']: {
                lang: value
                for lang, value in record['fields'].items()
                if lang != 'string'
            }
            for record in airtable.Airtable('appkEc8N0Bw4Uok43', '').iterate('translations')
        }

    def test_no_fix_needed(self) -> None:
        """No fix needed."""

        base = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        base.create('translations', {
            'en': 'A string translated in English',
            'fr': 'A string translated in French',
            'string': 'A string to translate',
        })

        fixer.main([
            '--api-key', 'my-own-api-key',
            '--accept-all',
        ])

        self.assertEqual({
            'A string to translate': {
                'en': 'A string translated in English',
                'fr': 'A string translated in French',
            },
        }, self._get_all_translations())

    def test_remove_trailing_whitespace(self) -> None:
        """Remove trailing whitespaces."""

        base = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        base.create('translations', {
            'en': 'A string translated in English ',
            'fr': ' A string translated in French',
            'other': ' not a translation ',
            'string': 'A string to translate',
        })

        fixer.main([
            '--api-key', 'my-own-api-key',
            '--accept-all',
        ])

        self.assertEqual({
            'A string to translate': {
                'en': 'A string translated in English',
                'fr': 'A string translated in French',
                'other': ' not a translation ',
            },
        }, self._get_all_translations())

    def test_non_breakable_space(self) -> None:
        """Fix non-breakable spaces in French."""

        base = airtable.Airtable('appkEc8N0Bw4Uok43', '')
        base.create('translations', {
            'en': 'A string translated in English : right!',
            'fr': ' A string translated in French : right!',
            'string': 'A string to translate',
        })

        fixer.main([
            '--api-key', 'my-own-api-key',
            '--accept-all',
        ])

        self.assertEqual({
            'A string to translate': {
                'en': 'A string translated in English : right!',
                'fr': 'A string translated in French\xa0: right!',
            },
        }, self._get_all_translations())


if __name__ == '__main__':
    unittest.main()
