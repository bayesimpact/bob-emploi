"""Importer of US Counties data in MongoDB."""

from typing import Any

from bob_emploi.data_analysis.importer.deployments.usa import geonames_city_suggest
from bob_emploi.data_analysis.lib import geonames
from bob_emploi.data_analysis.lib import mongo


# New York City is composed of 5 counties (boroughs) but we might want to consider the city
# as a mega county aggregating data from its boroughs.
NEW_YORK_AGGREGATION = {
    '_id': geonames_city_suggest.NEW_YORK_AGG_COUNTY_ID,
    'name': 'New York City, New York',
    # TODO(cyrille): Move prefix handling in frontend translation.
    'prefix': 'in ',
}


def make_dicts(
        geonames_admin_dump_filename: str = 'data/usa/geonames_admin.txt',
        states_fips_codes_filename: str = 'data/usa/states.txt') -> list[dict[str, Any]]:
    """Import counties info in MongoDB.

    Args:
        geonames_admin_dump_filename: path to a TSV file containing the main
            information about counties from GeoNames.
        states_fips_codes_filename: path to a TSV file containing the
            information about states.
    Returns:
        A list of dict that maps the JSON representation of Departement protos.
    """

    county_names = {}
    states_by_code = geonames_city_suggest.prepare_state_codes(states_fips_codes_filename)
    if not states_by_code:
        raise ValueError(f'Missing a FIPS - ISO relation table in "{states_fips_codes_filename}"')
    for geoname in sorted(
            geonames.iterate_geonames(geonames_admin_dump_filename),
            key=lambda g: g['feature_code']):
        if geoname['feature_code'] == 'ADM2':
            county_id = f'{states_by_code[geoname["admin1_code"]].fips}{geoname["admin2_code"]}'
            county_names[county_id] = \
                f'{geoname["name"]}, {states_by_code[geoname["admin1_code"]].name}'
    counties = [{
        '_id': county_id,
        'name': county_name,
        # TODO(cyrille): Move prefix handling in frontend translation.
        'prefix': 'in ',
    } for county_id, county_name in county_names.items()]
    counties.append(NEW_YORK_AGGREGATION)
    return counties


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'departements')
