"""Importer for ADIE events.
"""

import re
import typing

import js2py
from scrapy import selector

from bob_emploi.data_analysis.lib import mongo

# Matches short dates, e.g. "23 février", "1er juin".
_DATE_REGEXP = re.compile(r'(?P<day>\d+)(?:er)? (?P<month>\w+)')

_FRENCH_MONTHS = {
    name: index + 1
    for index, name in enumerate((
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre'))
}


def adie_events2dicts(events_html: str) -> typing.List[typing.Dict[str, typing.Any]]:
    """Convert the events page of ADIE into our own Event format before Mongo import.

    Args:
        events_html: the HTML content of the ADIE events page.

    Returns:
        an iterable of dict with the JSON values of the Event proto.
    """

    with open(events_html, 'rt') as events_file:
        page_text = events_file.read()
    page_selector = selector.Selector(text=page_text)

    # Parse the markers with coordinates.
    map_div = page_selector.xpath('//div[@class="acf-map"]')
    markers = [
        {
            'data-lat': d.xpath('@data-lat').extract_first(),
            'data-lng': d.xpath('@data-lng').extract_first(),
        }
        for d in map_div.xpath('div[@class="marker"]')
    ]

    # Parse the other attributes.
    events_script = page_selector.xpath(
        '//script[contains(., "var evenements = []")]/text()').extract_first()
    if not events_script:
        raise ValueError(
            f'"{events_html}" does not contain the javascript to create events:\n{page_text}')

    if 'evenement = []' not in events_script:
        raise ValueError('The [] bug is fixed, please drop the replace code')
    events_script = events_script.replace('evenement = []', 'evenement = {}')
    events = js2py.eval_js(events_script + ';evenements')

    # Join coordinates and other attributes.
    return [_adie_event_to_proto(dict(a, **b)) for a, b in zip(markers, events)]


def _parse_date(date: str) -> str:
    match = _DATE_REGEXP.match(date)
    if not match:
        raise ValueError(f'Date "{date}" could not be parsed')
    day = int(match.group('day'))
    month = _FRENCH_MONTHS[match.group('month')]
    return f'2018-{month:02d}-{day:02d}'


def _adie_event_to_proto(props: typing.Dict[str, typing.Any]) -> typing.Dict[str, typing.Any]:
    timing_text = _drop_first_word(props['date_ev_festival'])
    return {
        '_id': f"2018-06_{props['index_ev_festival']}",
        'cityName': props['ville_ev_festival'],
        'description':
            '***Ça parle de quoi ?***\n\n'
            '{description_ev_festival}\n\n'
            '***Ça se passe où ?***\n\n'
            '{lieu_ev_festival}  \n'
            '{adresse_ev_festival}\n\n'
            '***Quand ?***\n\n'
            'le {date_ev_festival}  \n'
            '{heure_ev_festival}'.format(**props),
        'latitude': props['data-lat'],
        'longitude': props['data-lng'],
        'timingText': f'le {timing_text}',
        'startDate': _parse_date(_drop_first_word(props['date_ev_festival'])),
        'title': props['nom_ev_festival'],
    }


def _drop_first_word(text: str) -> str:
    return ' '.join(text.split(' ')[1:])


if __name__ == '__main__':
    mongo.importer_main(adie_events2dicts, 'adie_events')
