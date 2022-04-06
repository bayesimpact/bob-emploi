"""Importer for local market information for a given area to MongoDB."""

import locale
import math
import os
import re
import typing
from typing import Any, Callable, Iterator

import pandas

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import mongo

locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')

_AREA_CODE_TO_AREA_TYPE = {
    'D': geo_pb2.DEPARTEMENT,
    'F': geo_pb2.COUNTRY,
}
# Sector names are of the form 'Métiers du sport et autour du sport'.
# This regex allows to split this to capture only 'du sport'.
_SECTOR_TRIMMING_REGEX = re.compile(r'Métiers | et |, |\(')
# Meaningful IDs derived by hand from rome_item_arborescence (v344).
_SECTOR_IDS = {
    '17003': 'environment',
    '17024': 'defense',
    '17025': 'heritage',
    '17026': 'economy-intelligence',
    '17027': 'research',
    '17028': 'sea',
    '17029': 'aeronautics',
    '17030': 'security',
    '17031': 'multimedia',
    '17032': 'humanitarian',
    '17033': 'nuclear',
    '17034': 'children',
    '17035': 'seasonal',
    '17036': 'personal-services',
    '17037': 'sport',
    '17038': 'engineering',
    '17039': 'no-qualif',
}
# TODO(cyrille): Consider using this for all sectors.
_SECTOR_RENAMING = {
    'defense': 'dans le secteur de la défense et de la sécurité publique',
    'security': 'dans le secteur de la sécurité publique et privée',
    'children': "dans le secteur de l'enfance",
    'seasonal': 'saisonniers, de vacances',
    'no-qualif': 'accessibles sans diplôme et sans expérience',
}


def _beautify_sector_name(sector: pandas.Series) -> str:
    qualification = _SECTOR_TRIMMING_REGEX.split(sector.at['libelle_item_arbo'])[1]
    qualification = _SECTOR_RENAMING.get(
        sector.at['sectorId'], f' dans le secteur {qualification}')
    return f'Des métiers {qualification} %inDepartement'


# TODO(cyrille): Slowly get rid of the FR-specific inputs.
def compute_areas(
    *, market_scores: pandas.DataFrame, sectors: pandas.DataFrame, min_score: int,
    include_all_sector_jobs: bool = False,
) -> Iterator[dict[str, Any]]:
    """Import departement level diagnosis data in MongoDB.

    Args:
        sectors: a dataframe with a `description` column, a `job_group` column
            and a `sectorId` column.
        market_scores: a dataframe with columns `score`, `area_type`, `job_group`, `area_id`,
            /(junior|senior)_(min|max)_salary/.
            `area_type` is a geo_pb2.AreaType value.
        min_score: The minimum score for a market to be considered relevant.
            The value is lowered by 1 for sectors.
        include_all_sector_jobs: If true, will include all jobs from the sectors list in each area.
    """

    local_scores = market_scores[market_scores.area_type == geo_pb2.DEPARTEMENT]
    # Best local market score jobs.
    best_local_scores = local_scores\
        .dropna(subset=['score'])\
        .sort_values('score', ascending=False)\
        .groupby('area_id').apply(_create_market_score_job_group_list(min_score=min_score))
    areas = best_local_scores.rename('bestLocalMarketScoreJobs')\
        .rename_axis('_id')\
        .reset_index().set_index('_id', drop=False)

    # Best relative score jobs.
    national_scores = market_scores[market_scores.area_type == geo_pb2.COUNTRY]\
        .groupby('job_group').first().score.dropna()
    market_scores['national_score'] = market_scores.job_group.map(national_scores)
    market_scores['local_relative_score'] = market_scores.score.\
        div(market_scores.national_score)
    local_scores = market_scores[market_scores.area_type == geo_pb2.DEPARTEMENT]
    best_local_relative_scores = local_scores\
        .dropna(subset=['local_relative_score'])\
        .sort_values('local_relative_score', ascending=False)\
        .groupby('area_id').apply(_create_market_score_job_group_list(min_score=min_score))
    areas['bestRelativeScoreJobs'] = best_local_relative_scores

    # Best salaries jobs.
    best_salaries_jobs = local_scores\
        .dropna(subset=['junior_min_salary'])\
        .sort_values('junior_min_salary', ascending=False)\
        .groupby('area_id').apply(_create_salaries_job_group_list)
    areas['bestSalariesJobs'] = best_salaries_jobs

    # Sectors.
    if include_all_sector_jobs:
        all_job_areas = pandas.merge(
            sectors.job_group.drop_duplicates(),
            local_scores.area_id.drop_duplicates(),
            how='cross')
        scores_for_sector = pandas.merge(
            local_scores, all_job_areas,
            on=('area_id', 'job_group'),
            how='outer').\
            fillna({'score': 0})
    else:
        scores_for_sector = local_scores
    sector_scores = scores_for_sector[scores_for_sector.score >= min_score - 1]\
        .merge(sectors, on='job_group')\
        .sort_values('score', ascending=False)\
        .dropna(subset=['area_id', 'sectorId', 'description', 'score'])\
        .groupby(['area_id', 'sectorId', 'description'])\
        .apply(_create_market_score_job_group_list(min_score=min_score - 1))\
        .rename('bestLocalMarketScoreJobs')\
        .reset_index()
    # TODO(cyrille): Upload description for airtable translation, keyed by sectorId.
    sectors_by_area = sector_scores.groupby('area_id').apply(
        lambda df: df.drop(columns=['area_id']).to_dict('records'))
    areas['sectors'] = sectors_by_area
    areas['sectors'] = areas.sectors.apply(lambda l: l if isinstance(l, list) else [])

    for record in typing.cast(list[dict[str, Any]], areas.to_dict(orient='records')):
        yield _drop_nan_properties(record)


def get_market_scores(imt_folder: str, pcs_rome_crosswalk: str) -> pandas.DataFrame:
    """Make a market score dataframe for as expected by compute_areas."""

    market_score_csv = os.path.join(imt_folder, 'market_score.csv')
    market_stats = pandas.read_csv(market_score_csv, dtype={'AREA_CODE': 'str'})

    # Converting to int from np.int32 so that json serialization does not choke.
    market_stats['score'] = pandas.to_numeric(market_stats.TENSION_RATIO)
    market_stats.loc[market_stats.score == 0, 'score'] = -1
    market_stats['area_id'] = market_stats.AREA_CODE
    market_stats['area_type'] = market_stats.AREA_TYPE_CODE.map(_AREA_CODE_TO_AREA_TYPE)
    market_stats['job_group'] = market_stats.ROME_PROFESSION_CARD_CODE
    market_stats = market_stats[['area_type', 'area_id', 'job_group', 'score']]

    market_salaries_csv = os.path.join(imt_folder, 'salaries.csv')
    market_salaries = cleaned_data.imt_salaries(
        filename=market_salaries_csv,
        pcs_crosswalk_filename=pcs_rome_crosswalk)\
        .reset_index().rename({
            'departement_id': 'area_id',
            'rome_id': 'job_group',
        }, axis='columns')

    market_stats = pandas.merge(market_stats, market_salaries, how='left')

    return market_stats


def _create_market_score_job_group_list(*, min_score: int) \
        -> Callable[[pandas.DataFrame], list[dict[str, Any]]]:

    def _create(job_groups: pandas.DataFrame) -> list[dict[str, Any]]:
        good_hiring_job_groups = job_groups[job_groups.score >= min_score]
        return _create_job_group_list(good_hiring_job_groups, lambda job_group: {'imt': {
            'yearlyAvgOffersPer10Candidates': job_group.score,
        }})
    return _create


def _create_salaries_job_group_list(job_groups: pandas.DataFrame, min_salary: int = 2200) \
        -> list[dict[str, Any]]:
    good_pay_job_groups = job_groups[job_groups.junior_min_salary >= min_salary]
    return _create_job_group_list(good_pay_job_groups, lambda job_group: {'imt': {
        'juniorSalary': _get_single_salary_detail(
            job_group.junior_min_salary,
            job_group.junior_max_salary),
        'seniorSalary': _get_single_salary_detail(
            job_group.senior_min_salary,
            job_group.senior_max_salary),
    }})


def _create_job_group_list(
        job_groups: pandas.DataFrame,
        get_local_stats: Callable[[Any], dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            'jobGroup': {'romeId': job_group.job_group},
            'localStats': get_local_stats(job_group),
        }
        for job_group in job_groups.head(50).itertuples(index=False)
    ]


def _isnan(value: Any) -> bool:
    """Check whether a Python value is numpy's NaN."""

    return isinstance(value, float) and math.isnan(value)


def _get_single_salary_detail(min_salary: float, max_salary: float) -> dict[str, Any]:
    if _isnan(min_salary) and _isnan(max_salary):
        return {}
    from_salary = locale.format_string('%d', min_salary, grouping=True)
    to_salary = locale.format_string('%d', max_salary, grouping=True)
    short_text = f'De {from_salary}\xa0€ à {to_salary}\xa0€'
    return {
        'unit': job_pb2.SalaryUnit.Name(job_pb2.MONTHLY_GROSS_SALARY),
        'shortText': short_text,
        'minSalary': min_salary,
        'maxSalary': max_salary
    }


def _drop_nan_properties(properties: dict[str, Any]) -> dict[str, Any]:
    nan_properties = {
        prop for prop, value in properties.items()
        if _isnan(value)
    }
    for prop in nan_properties:
        del properties[prop]
    return properties


def _get_rome_sectors(rome_item_arborescence: str) -> pandas.DataFrame:
    sector_jobs = pandas.read_csv(rome_item_arborescence, dtype='str')[[
        'code_ogr', 'code_pere', 'code_noeud', 'libelle_item_arbo',
    ]]
    sectors = sector_jobs[sector_jobs.code_pere == 'Racine AR'].set_index('code_noeud')
    sector_jobs = sector_jobs[sector_jobs.code_pere.isin(sectors.index)][[
        'code_pere', 'code_noeud']]
    sector_jobs = sector_jobs.join(sectors, on='code_pere', rsuffix='_sector')
    sectors = sector_jobs.rename(columns={
        'code_noeud': 'job_group',
    })
    sectors['sectorId'] = sectors.code_ogr.map(_SECTOR_IDS)
    sectors['description'] = sectors.apply(_beautify_sector_name, axis=1)
    return sectors[['job_group', 'sectorId', 'description']]


def csv2dicts(
        *, imt_folder: str, pcs_rome_crosswalk: str, rome_item_arborescence: str) \
        -> Iterator[dict[str, Any]]:
    """Export data for the main app."""

    locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')

    yield from compute_areas(
        market_scores=get_market_scores(imt_folder, pcs_rome_crosswalk),
        sectors=_get_rome_sectors(rome_item_arborescence),
        min_score=7)


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'best_jobs_in_area', count_estimate=102)
