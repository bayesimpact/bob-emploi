"""Importer for Tous Bénévoles' volunteering missions into MongoDB."""
import pandas as pd
import requests
import xmltodict

from bob_emploi.lib import mongo

# Sorted list of postcodes set by Tous Bénévoles for missions that are actualy
# available everywhere.
_EVERYWHERE_POSTCODES = '06000,13001,31000,33000,34000,35000,44000,59000,67000,69001,75001'


def get_missions_dicts():
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
    return country_wide_missions + [
        {'_id': departement_id, 'missions': missions}
        for departement_id, missions in departement_missions.iteritems()]


def _get_random_missions_picker(num_missions):
    def _pick_random_missions(missions):
        if len(missions) > num_missions:
            samples = missions.sample(num_missions)
        else:
            samples = missions
        return samples[['associationName', 'title', 'link', 'description']].to_dict('records')
    return _pick_random_missions


if __name__ == '__main__':
    mongo.importer_main(get_missions_dicts, 'volunteering_missions')  # pragma: no-cover
