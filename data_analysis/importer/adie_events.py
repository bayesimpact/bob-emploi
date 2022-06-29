"""Importer for ADIE events.
"""

import json
import re
from typing import Any

from bob_emploi.data_analysis.lib import mongo

# Matches short dates, e.g. "23 février 2018", "1er juin 2019".
_DATE_REGEXP = re.compile(r'(?P<day>\d+)(?:er)? (?P<month>\w+) (?P<year>\d+)')

_FRENCH_MONTHS = {
    name: index + 1
    for index, name in enumerate((
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre'))
}


def adie_events2dicts(events_json: str) -> list[dict[str, Any]]:
    """Convert the scraped events of ADIE into our own Event format before Mongo import.

    Args:
        events_json: the JSON scraped from the ADIE events website.

    Returns:
        an iterable of dict with the JSON values of the Event proto.
    """

    with open(events_json, 'rt', encoding='utf-8') as events_file:
        events = json.load(events_file)
    events_to_import = {}

    for event in events:
        event_proto = _adie_event_to_proto(event)
        events_to_import[event_proto.get('_id')] = event_proto

    return list(events_to_import.values())


def _parse_date(date: str) -> str:
    match = _DATE_REGEXP.match(date)
    if not match:
        raise ValueError(f'Date "{date}" could not be parsed')
    day = int(match.group('day'))
    month = _FRENCH_MONTHS[match.group('month')]
    year = int(match.group('year'))
    return f'{year:04d}-{month:02d}-{day:02d}'


def _adie_event_to_proto(props: dict[str, Any]) -> dict[str, Any]:
    props['cityName'] = props['ville'].title()
    return {
        '_id': props['rdvGroupeId'],
        'cityName': props['cityName'],
        'description':
            '***Ça parle de quoi ?***\n\n'
            '{sousTitre}\n\n'
            '***Ça se passe où ?***\n\n'
            '{nomSite}\n'
            '{adresse1}, {adresse2}, {codePostal} {cityName}\n\n'
            '***Quand ?***\n\n'
            'le {date}\n'.format(**props),
        'latitude': props['latitude'],
        'longitude': props['longitude'],
        'timingText': f'le {" ".join(props["date"].split(" ")[1:3])}',
        'startDate': _parse_date(_drop_first_word(props['date'])),
        'title': props['titre'],
    }


def _drop_first_word(text: str) -> str:
    return ' '.join(text.split(' ')[1:])


if __name__ == '__main__':
    mongo.importer_main(adie_events2dicts, 'adie_events')
