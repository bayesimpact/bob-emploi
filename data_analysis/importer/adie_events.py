"""Importer for WorkUp events.

See http://go/pe:notebooks/datasets/workup_events.ipynb for analysis on the
WorkUp dataset.
"""

import js2py
from scrapy import selector

from bob_emploi.data_analysis.lib import mongo


def adie_events2dicts(events_html):
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
            '"{}" does not contain the javascript to create events:\n{}'
            .format(events_html, page_text))

    if 'evenement = []' not in events_script:
        raise ValueError('The [] bug is fixed, please drop the replace code')
    events_script = events_script.replace('evenement = []', 'evenement = {}')
    events = js2py.eval_js(events_script + ';evenements')

    # Join coordinates and other attributes.
    return [_adie_event_to_proto(dict(a, **b)) for a, b in zip(markers, events)]


def _adie_event_to_proto(props):
    return {
        '_id': '2018-02_{}'.format(props['index_ev_festival']),
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
        # TODO(pascal): Parse the date as well if this repeats after February 2018
        'timingText': 'le {}'.format(_drop_first_word(props['date_ev_festival'])),
        'title': props['nom_ev_festival'],
    }


def _drop_first_word(text):
    return ' '.join(text.split(' ')[1:])


if __name__ == '__main__':
    mongo.importer_main(adie_events2dicts, 'adie_events')  # pragma: no-cover
