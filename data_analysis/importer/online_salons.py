"""Module to upload the pole-emploi online salons to MongoDB."""

import collections
import datetime
import json
import logging
import os
import re
import typing

from algoliasearch import search_client

from bob_emploi.data_analysis.importer import airtable_to_protos
from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import online_salon_pb2

_ALGOLIA_INDEX: typing.List[search_client.SearchClient] = []

_ALGOLIA_FIELD_TO_AREA_TYPE = {
    'cityId': 'CITY',
    'departementId': 'DEPARTEMENT',
    'departementName': 'DEPARTEMENT',
    'name': 'CITY',
    'regionId': 'REGION',
    'regionName': 'REGION',
}

_CITY_FIELDS_TO_KEEP = {
    'cityId', 'name',
    'departementId', 'departementName', 'departementPrefix',
    'regionId', 'regionName',
}

_AREA_TYPE_TO_LOCATION_ID_FIELD = {
    geo_pb2.CITY: 'cityId',
    geo_pb2.DEPARTEMENT: 'departementId',
    geo_pb2.REGION: 'regionId',
}

# A cached dict of French regions with their prefix, keyed by ID.
_REGIONS: typing.List[typing.Dict[str, typing.Dict[str, str]]] = []

_FIELD_RENAMER = {
    'nombreOffres': 'offer_count',
    'titre': 'title',
    'urlSalonEnLigne': 'url',
}

_FIELDS_TO_DROP = (
    'dateDebut',
    'dateDebutCandidature',
    'dateFin',
    'dateFinCandidature',
    'description',
    'localisation',
    'salonEnCours',
)


def clear_algolia_index() -> None:
    """Reset algolia client."""

    _ALGOLIA_INDEX.clear()


def _get_region(region_id: str, default: typing.Dict[str, str]) -> typing.Dict[str, str]:
    if not _REGIONS:
        _REGIONS.append(cleaned_data.french_regions().to_dict(orient='index'))
    return _REGIONS[0].get(region_id, default)


def fetch_location(city: typing.Dict[str, str], is_exact: bool = False) \
        -> typing.Dict[str, typing.Any]:
    """Get a location using a search in Algolia.

    The input city should be of the form {city_field: search_value}, with exactly one given field.
    e.g.: {'departementId': '42'} or {'name': 'Saint-Etienne'}
    If is_exact, ensures the specified city field has the right value."""

    if not city or len(city) > 1:
        raise ValueError('The required city must have exactly one field.')
    search_key, search_value = city.popitem()
    if not search_value:
        return {}
    if not _ALGOLIA_INDEX:
        _ALGOLIA_INDEX.append(search_client.SearchClient.create(
            os.getenv('ALGOLIA_APP_ID', 'K6ACI9BKKT'),
            os.getenv('ALGOLIA_API_KEY', 'da4db0bf437e37d6d49cefcb8768c67a')).init_index('cities'))
    algolia_results = _ALGOLIA_INDEX[0].search(search_value, {'queryType': 'prefixNone'})
    location: typing.Dict[str, typing.Any] = {}
    for result in algolia_results.get('hits', []):
        highlight_results = result.get('_highlightResult', {})
        fields_to_check = [search_key] if is_exact else highlight_results.keys()
        for key in fields_to_check:
            try:
                if search_value == result[key] or highlight_results[key].get('fullyHighlighted'):
                    location['areaType'] = _ALGOLIA_FIELD_TO_AREA_TYPE[key]
                    location['city'] = {
                        k: v for k, v in result.items() if k in _CITY_FIELDS_TO_KEEP}
                    break
            # key is not in result or highlight_results, let's try the next one.
            except KeyError:
                continue
        if 'city' in location:
            break
    # Add region prefix for display
    if 'areaType' in location and location['areaType'] == 'REGION':
        location['city']['regionPrefix'] = _get_region(location['city']['regionId'], {}) \
            .get('prefix', '')
    return location


def _get_city(localisation: str) -> typing.List[typing.Dict[str, typing.Any]]:
    location = fetch_location({'name': localisation})
    return [location] if location else []


def _isodate_from_string(date_string: str, is_end_of_day: bool = False) -> str:
    date = datetime.datetime.strptime(date_string, '%d/%m/%Y')
    if is_end_of_day:
        date += datetime.timedelta(days=1)
    return date.isoformat() + 'Z'


class _OnlineSalonRule(object):

    def __init__(self, rule: online_salon_pb2.SalonFilterRule) -> None:
        self._regexp = re.compile(rule.regexp, re.IGNORECASE)
        self._rule = rule
        self._has_job_group = bool(rule.job_group_ids)
        self._has_location = bool(rule.location_kind and rule.location_ids)
        if rule.location_kind and rule.location_kind not in _AREA_TYPE_TO_LOCATION_ID_FIELD:
            raise ValueError('Cannot make a rule on {} level'.format(geo_pb2.AreaType.Name(
                rule.location_kind)))

    def generate_info(self, salon: typing.Dict[str, str]) \
            -> typing.Dict[str, typing.List[typing.Any]]:
        """Takes a salon dict and outputs all the locations and/or job groups this rule can extract.
        """

        added_fields: typing.Dict[str, typing.List[typing.Any]] = collections.defaultdict(list)
        for field in self._rule.fields:
            if field not in salon:
                continue
            for match in re.finditer(self._regexp, salon[field]):
                if self._has_job_group:
                    added_fields['jobGroupIds'] += [
                        match.expand(job_group_id) for job_group_id in self._rule.job_group_ids]
                if self._rule.filters:
                    added_fields['filters'] += self._rule.filters
                if not self._has_location:
                    continue
                added_fields['locations'] += [fetch_location({
                    _AREA_TYPE_TO_LOCATION_ID_FIELD[self._rule.location_kind]:
                    match.expand(location_id)
                }, is_exact=True) for location_id in self._rule.location_ids]
        return added_fields


def _aggregate_rule_results(
        salon: typing.Dict[str, typing.Any], rules: typing.List[_OnlineSalonRule]) \
        -> typing.Dict[str, typing.Any]:
    """Find all matching rules for salon, and add their info to it."""

    for rule in rules:
        for key, values in rule.generate_info(salon).items():
            if not values:
                continue
            if key not in salon:
                salon[key] = []
            salon[key].extend(values)
    return salon


def json2dicts(events_file_name: str) -> typing.List[typing.Dict[str, typing.Any]]:
    """Convert salons from pole-emploi API to json compatible with
    online_salon_pb2.OnlineSalon proto.
    """

    # Rules are defined here: https://airtable.com/tbl6eAgUh8JGoiYnp/viwO0TJnWjTPexmsS
    rules = [_OnlineSalonRule(rule) for _, rule in mongo.collection_to_proto_mapping(
        airtable_to_protos.airtable2dicts(
            'appXmyc7yYj0pOcae', 'tbl6eAgUh8JGoiYnp', 'SalonFilterRule', view='Ready to Import'),
        online_salon_pb2.SalonFilterRule)]

    with open(events_file_name) as json_data:
        salons = typing.cast(typing.List[typing.Dict[str, typing.Any]], json.load(json_data))

    for salon in salons:
        salon['start_date'] = _isodate_from_string(salon['dateDebut'])
        salon['application_start_date'] = _isodate_from_string(salon['dateDebutCandidature'])
        salon['application_end_date'] = _isodate_from_string(
            salon['dateFinCandidature'], is_end_of_day=True)
        salon['locations'] = _get_city(typing.cast(str, salon.get('localisation', '')))
        salon = _aggregate_rule_results(salon, rules)
        if not salon['locations']:
            logging.warning('Missing locations on salon\n%s', salon)
        # TODO(cyrille): Add test for not missing case.
        if not salon.get('jobGroupIds'):
            logging.warning('Missing job groups on salon\n%s', salon)
        for old, new in _FIELD_RENAMER.items():
            try:
                salon[new] = salon.pop(old)
            except KeyError:
                continue
        for field in _FIELDS_TO_DROP:
            salon.pop(field, None)
    return salons


if __name__ == '__main__':
    mongo.importer_main(json2dicts, 'online_salons')
