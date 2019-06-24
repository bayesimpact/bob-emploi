"""Importer for WorkUp events.

See http://go/pe:notebooks/datasets/workup_events.ipynb for analysis on the
WorkUp dataset.
"""

import json
import math
import typing

import pandas as pd

from bob_emploi.data_analysis.lib import mongo

# Buffer distance to add to département bounds: if the event is inside the
# buffered box, we recommend it for users in this département.
_BUFFER_KILOMETER = 30
# Buffer to add on latitude to roughly match the distance above.
# 6371 is the Earth radius in Km.
_LAT_BUFFER = math.degrees(_BUFFER_KILOMETER / 6371)
# Buffer to add on longitude to roughly match the distance above.
# 45° is the average latitude in France.
_LNG_BUFFER = math.degrees(_BUFFER_KILOMETER / 6371 / math.cos(math.radians(45)))

# URL of an event page.
_WORKUP_EVENT_URL = 'https://www.workuper.com/events/{}'


def events2dicts(events_json: str, departement_bounds_csv: typing.Union[str, typing.TextIO]) \
        -> typing.List[typing.Dict[str, typing.Any]]:
    """Convert the events JSON to our own format before mongo import.

    Args:
        events_json: the JSON file from WorkUp.
        departement_bounds_csv: path to a CSV file containing the bounding
            boxes of French départements.
    Returns:
        an iterable of dict with the JSON values of the Event proto.
    """

    departements = pd.read_csv(departement_bounds_csv, dtype={'departement_id': str})
    with open(events_json, 'r') as events_file:
        events = json.load(events_file)
    return [
        _workup_to_proto(e, departements)
        for e in events if _is_valid_event(e)]


def _is_valid_event(event: typing.Dict[str, typing.Any]) -> bool:
    # Display only Free events.
    if event['price']:
        return False

    # Do not display events that are only to create a new company as we do not
    # cover that case yet.
    if not isinstance(event['category'], list):
        raise ValueError('category field should be a list:\n{}'.format(event))
    if event['category'] == ['Créer sa boite']:
        return False

    return True


def _workup_to_proto(event: typing.Dict[str, typing.Any], departements: pd.DataFrame) \
        -> typing.Dict[str, typing.Any]:
    geo_filters: typing.List[str]
    if event.get('address', '').strip().lower() in ('en ligne', 'internet'):
        geo_filters = []
    else:
        close_departements = departements[
            (departements.max_latitude + _LAT_BUFFER >= event['latitude']) &
            (departements.min_latitude - _LAT_BUFFER <= event['latitude']) &
            (departements.max_longitude + _LNG_BUFFER >= event['longitude']) &
            (departements.min_longitude - _LNG_BUFFER <= event['longitude'])]
        if close_departements.empty:
            raise ValueError('Event is next to no French départements:\n{}'.format(event))
        geo_filters = [
            'for-departement({})'.format(','.join(sorted(close_departements.departement_id)))]

    # TODO(pascal): Add better filters for reorientation.
    return {
        '_id': event['id'],
        'filters': geo_filters,
        'link': _WORKUP_EVENT_URL.format(event['slug']),
        'organiser': event['organiser'],
        'startDate': event['date'],
        'title': event['title'],
    }


if __name__ == '__main__':
    mongo.importer_main(events2dicts, 'events')
