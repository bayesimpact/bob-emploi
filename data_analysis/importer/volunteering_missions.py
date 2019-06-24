"""Importer for Tous Bénévoles' volunteering missions into MongoDB."""

import typing

import pandas as pd
import requests
import xmltodict

from bob_emploi.data_analysis.lib import mongo

# Sorted list of postcodes set by Tous Bénévoles for missions that are actualy
# available everywhere.
_EVERYWHERE_POSTCODES = '06000,13001,31000,33000,34000,35000,44000,59000,67000,69001,75001'


# TODO(marielaure): Test the checks individually.
def check_coverage(missions: typing.List[typing.Dict[str, typing.Any]]) -> bool:
    """Report if the new data are not dropping too much the expected coverage.

    Expected values are defined based on the following notebook:
    https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/datasets/tous_benevoles.ipynb
    """

    missions_data = pd.DataFrame(missions)
    # We expect at least 20 départements to be covered.
    if missions_data['_id'].nunique() < 19:
        return False

    # We expect at least 25% of the départements to have at least 2 missions.
    if missions_data.groupby('_id').count().quantile(q=0.75) < 2:
        return False

    return True


def get_missions_dicts() -> typing.List[typing.Dict[str, typing.Any]]:
    """Download volunteering missions from Tous Bénévoles website and prepare them.

    Returns:
        For each city (by INSEE ID) and each département, a sample of maximum 5
        distinct missions.
    """

    xml = requests.get('http://www.tousbenevoles.org/linkedin_webservice/xml/linkedin.xml')
    xml.raise_for_status()
    dataset = xmltodict.parse(xml.text)
    missions = pd.DataFrame(dataset['jobs']['job'])

    # Clean up fields, see http://go/pe:notebooks/datasets/tous_benevoles.ipynb
    missions['title'] = missions.JobTitle.str.replace('^Bénévolat : ', '')
    missions['associationName'] = \
        missions.JobDescription.str.extract('^Mission proposée par ([^<]+)<br />', expand=False)
    missions['description'] = missions.JobDescription\
        .str.replace('^Mission proposée par ([^<]+)<br />', '')\
        .str.replace('^<b>Informations complémentaires</b>', '')\
        .str.replace('\n· *', '\n\n* ')\
        .str.strip()
    missions.rename(columns={'applyURL': 'link'}, inplace=True)
    missions['departement'] = missions.PostalCode.str[:2]
    missions.loc[missions.departement == '96', 'departement'] = missions.PostalCode.str[:3]

    # Add an utm_source=bob-emploi parameter to links.
    missions['link'] = (missions.link + '&utm_source=bob-emploi').\
        where(missions.link.str.contains(r'\?'), other=(
            missions.link + '?utm_source=bob-emploi'))

    # Identify missions available everywhere.
    all_post_codes = missions.groupby('JobId').PostalCode\
        .apply(lambda codes: ','.join(codes.sort_values()))
    missions['isAvailableEverywhere'] = missions.JobId.map(all_post_codes) == _EVERYWHERE_POSTCODES
    if sum(missions.isAvailableEverywhere):
        everywhere_missions = missions[missions.isAvailableEverywhere].drop_duplicates('JobId')
        country_wide_missions = [
            {'_id': '', 'missions': _get_random_missions_picker(5)(everywhere_missions)},
        ]
    else:
        country_wide_missions = []

    # TODO(pascal): Add some missions per city as well.

    departement_missions = missions[~missions.isAvailableEverywhere]\
        .groupby('departement').apply(_get_random_missions_picker(5))

    returned_missions = country_wide_missions + [
        {'_id': departement_id, 'missions': missions}
        for departement_id, missions in departement_missions.iteritems()]
    if not check_coverage(returned_missions):
        raise ValueError('The putative new data lacks coverage.')
    return returned_missions


def _get_random_missions_picker(num_missions: int) \
        -> typing.Callable[[pd.DataFrame], typing.List[typing.Dict[str, typing.Any]]]:
    def _pick_random_missions(missions: pd.DataFrame) -> typing.List[typing.Dict[str, typing.Any]]:
        if len(missions) > num_missions:
            samples = missions.sample(num_missions)
        else:
            samples = missions
        return typing.cast(
            typing.List[typing.Dict[str, typing.Any]],
            samples[['associationName', 'title', 'link', 'description']].to_dict('records'))
    return _pick_random_missions


if __name__ == '__main__':
    mongo.importer_main(get_missions_dicts, 'volunteering_missions')
