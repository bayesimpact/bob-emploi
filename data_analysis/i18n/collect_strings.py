"""Collect the strings to translate.

docker-compose run --rm -e AIRTABLE_API_KEY="$AIRTABLE_API_KEY" data-analysis-prepare \
    python bob_emploi/data_analysis/i18n/collect_strings.py
"""

import os

from airtable import airtable

_I18N_BASE_ID = 'appkEc8N0Bw4Uok43'
_BOB_ADVICE_BASE_ID = 'appXmyc7yYj0pOcae'
_ROME_BASE_ID = 'appMRMtWV61Kibt37'


class StringCollector(object):
    """A helper to collect string to translate."""

    def __init__(self, api_key):
        self._i18n_base = airtable.Airtable(_I18N_BASE_ID, api_key)
        self._existing_translations = {
            record['fields'].get('string')
            for record in self._i18n_base.iterate('translations')
        }
        self._api_key = api_key
        self.bases = {}

    def _get_base(self, base_id):
        if base_id not in self.bases:
            self.bases[base_id] = airtable.Airtable(base_id, self._api_key)
        return self.bases[base_id]

    def collect_string(self, text, origin, origin_id):
        """Collect a string to translate."""

        if text in self._existing_translations:
            # TODO(pascal): Keep track of all places where it is used.
            return
        record = {
            'origin': origin,
            'origin_id': origin_id,
            'string': text,
        }
        self._i18n_base.create('translations', record)
        self._existing_translations.add(text)

    def collect_from_table(self, base_id, table, fields, id_field=None):
        """Collect strings to translate from an Airtable.

        Args:
            base_id: the airtable id of the base.
            table: the name of the table.
            fields: a set of fields which contain strings to translate.
            id_field: name of the field to use as ID (otherwise just use the recxxxx).
        """

        base = self._get_base(base_id)
        for record in base.iterate(table):
            for field in fields:
                text = record['fields'].get(field)
                if not text:
                    continue
                origin_id = record['id']
                if id_field:
                    origin_id = record['fields'].get(id_field) or origin_id
                self.collect_string(text, '{}:{}'.format(table, field), origin_id)


def main(api_key):
    """Collect all the strings in Airtable to translate."""

    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')

    collector = StringCollector(api_key)
    collector.collect_from_table(_BOB_ADVICE_BASE_ID, 'advice_modules', (
        'explanations (for client)',
        'goal',
        'title',
        'title_3_stars',
        'title_2_stars',
        'title_1_star',
        'user_gain_details',
    ), 'advice_id')
    collector.collect_from_table(_BOB_ADVICE_BASE_ID, 'email_templates', (
        'reason',
        'title',
    ))
    collector.collect_from_table(_ROME_BASE_ID, 'Event Types', (
        'event_location_prefix',
        'event_location',
    ))
    collector.collect_from_table(_BOB_ADVICE_BASE_ID, 'diagnostic_sentences', (
        'sentence_template',
    ))
    collector.collect_from_table(_BOB_ADVICE_BASE_ID, 'diagnostic_submetrics_sentences', (
        'positive_sentence_template',
        'negative_sentence_template',
    ))


if __name__ == '__main__':
    main(os.getenv('AIRTABLE_API_KEY'))
