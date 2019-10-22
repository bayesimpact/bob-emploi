"""Script to upload Belgian job suggestions to Algolia.

# TODO(cyrille): Refacto with other Algolia suggests.
It relies on environment variables to be set correctly:
    ALGOLIA_APP_ID: the Algolia App to update
    ALGOLIA_JOB_INDEX: the index to update in this App
    ALGOLIA_API_KEY: an API key that has enough permissions to edit the index.

The script takes two arguments:
 - a path to the data folder to fetch ROME jobs.
 - a path to the JSON file containing the definition of jobs from www.competent.be,
"""

import logging
import json
import os
import re
import sys
import time
import typing
from typing import Iterable, List, Pattern, Tuple

from algoliasearch import exceptions
from algoliasearch import search_client
import pandas

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import rome_genderization

if typing.TYPE_CHECKING:
    import typing_extensions

    class _JobSuggest(typing_extensions.TypedDict, total=False):
        codeOgr: str
        extendedRomeId: str
        jobGroupNameFr: str
        jobGroupNameNl: str
        jobNameFr: str
        jobNameNl: str
        jobNameFeminineFr: str
        jobNameFeminineNl: str
        jobNameMasculineFr: str
        jobNameMasculineNl: str
        objectID: str
        romeId: str

# Regular expression to match unaccented capital E in French text that should
# be capitalized. It has been computed empirically by testing on the full ROME.
# It matches the E in "Etat", "Ecrivain", "Evolution", "Energie", "Enigme" but
# not in "Entreprise", "Ethnologue", "Emoji", "Enivrer" nor "Euro".
_UNACCENTED_E_REGEXP = (
    r'E(?=('
    '([bcdfghjklpqrstvz]|[cpt][hlr])[aeiouyéèêë]|'
    'n([eouyéèêë]|i[^v]|a[^m])|'
    'm([aeiuyéèêë]|o[^j])))')

# Many jobs in the dataset have (h/f) or (m/w) suffix (with some misspells), to avoid genderization.
# Eg, this would catch '(h /f' or 'm/w  ) ' at end onf string.
_BIGENDER_SUFFIX_REGEX = re.compile(r'\s*\(?\s*([mh])\s*/\s*([vf])\s*\)?\s*$', re.IGNORECASE)

# See data_analysis/notebooks/scraped_data/belgium_competent_jobs.ipynb.
_TRANSLATION_PAIRING = {
    '51907-216': '51907-129',
    '51906-151': '51906-150',
    '51905-152': '51905-6',
}

# TODO(cyrille): Change names in scraper.
_RENAME_COLUMN_NAMES = {
    'appellationRome': 'jobGroupName',
    'codeRome': 'romeId',
    'codeRomeExtended': 'extendedRomeId',
    'libelleAppellation': 'jobName',
}


def json_to_dicts(data_folder: str, json_appellation: str) -> List['_JobSuggest']:
    """Transform the incoming JSON list to an Algolia-ready list of job suggestions."""

    # Read appellations from JSON.
    appellations = pandas.read_json(json_appellation).rename(columns=_RENAME_COLUMN_NAMES)

    # Add missing accents.
    _add_accents(appellations, ('jobGroupName', 'jobName'))

    # Clean non-genderized tags.
    _drop_regex(appellations, 'jobName', _BIGENDER_SUFFIX_REGEX)
    # Genderize names.
    _genderize(appellations, 'jobName', suffixes=('Masculine', 'Feminine'))

    # Join Dutch and French names.
    appellations['codeCompetent'] = appellations['codeCompetent']. \
        apply(lambda code: code.split('-', 1)[1])
    appellations['codeCompetent'].replace(_TRANSLATION_PAIRING, inplace=True)
    translated = appellations[appellations.lang == 'fr'].merge(
        appellations[appellations.lang == 'nl'],
        on=['codeCompetent', 'romeId', 'extendedRomeId'], suffixes=('Fr', 'Nl'))
    translated.drop(columns=['langFr', 'langNl'], inplace=True)

    # Set Competent code as object ID.
    translated.rename(columns={'codeCompetent': 'objectID'}, inplace=True)

    # Join with ROME jobs, when available.
    rome_jobs = cleaned_data.rome_jobs(data_folder).reset_index()
    _genderize(rome_jobs, 'name')
    rome_jobs = rome_jobs[['code_ogr', 'name_masculin']]
    rome_jobs.rename(columns={
        'code_ogr': 'codeOgr',
        'name_masculin': 'jobNameMasculineFr',
    }, inplace=True)
    suggestions = translated.merge(rome_jobs, how='left', on='jobNameMasculineFr')

    # Convert from pandas.DataFrame to Python list of dicts.
    records = suggestions.to_dict(orient='records')
    return [
        typing.cast('_JobSuggest', {k: v for k, v in record.items() if not pandas.isnull(v)})
        for record in records
    ]


def upload(data_folder: str, json_appellation: str) -> None:
    """Upload jobs suggestions to Algolia."""

    suggestions = json_to_dicts(data_folder, json_appellation)
    client = search_client.SearchClient.create(
        os.getenv('ALGOLIA_APP_ID'), os.getenv('ALGOLIA_API_KEY'))
    index_name = os.getenv('ALGOLIA_JOB_INDEX', 'jobs')
    # TODO(cyrille): Optimize index for localized search.
    job_index = client.init_index(index_name)
    tmp_index_name = '%s_%x' % (index_name, round(time.time()))
    tmp_job_index = client.init_index(tmp_index_name)

    try:
        tmp_job_index.set_settings(job_index.get_settings())
        tmp_job_index.save_objects(suggestions, {
            'autoGenerateObjectIDIfNotExist': True,
        })

        # OK we're ready finally replace the index.
        if not os.getenv('DRY_RUN'):
            client.move_index(tmp_index_name, index_name)
    except exceptions.AlgoliaException:
        tmp_job_index.delete()
        logging.error(json.dumps(suggestions[:10], indent=2))
        raise


def _drop_regex(data_frame: pandas.DataFrame, field: str, regex: Pattern[str]) -> None:
    data_frame[field] = data_frame[field].apply(lambda r: regex.sub('', typing.cast(str, r)))


def _genderize(
        data_frame: pandas.DataFrame, field: str,
        suffixes: Tuple[str, str] = ('_masculin', '_feminin')) -> None:
    """Update a pandas DataFrame by genderizing one if its column.

    Args:
        data_frame: the DataFrame to update.
        field: the name of the column to genderize.
        suffixes: the suffixes of the new column to create.
    """

    masculine, feminine = rome_genderization.genderize(data_frame[field])
    data_frame[field + suffixes[0]] = masculine
    data_frame[field + suffixes[1]] = feminine


def _add_accents(data_frame: pandas.DataFrame, fields: Iterable[str]) -> None:
    """Add an accent on capitalized letters if needed.

    Most of the capitalized letters have no accent even if the French word
    would require one. This function fixes this by using heuristics.
    """

    for field in fields:
        data_frame[field] = data_frame[field].str.replace(
            _UNACCENTED_E_REGEXP, 'É')


if __name__ == '__main__':
    upload(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
