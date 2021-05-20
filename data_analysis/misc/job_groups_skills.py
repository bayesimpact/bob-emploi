"""A script to gather basic skills for each job group sorted by priority.

This scripts take as an input the ROME "liens_rome_referentiels" table
and skills associated to job offers provided by the cleaned_data lib.
It outputs a JSON file per job group with a list of skills.
"""

import os
from os import path
from typing import Optional
import pandas as pd


from bob_emploi.data_analysis.lib import cleaned_data

_ROME_VERSION = 'v346'
_BASIC_SKILL_RUBRIQUE_CODE = 6
_BASIC_ACTIVITY_RUBRIQUE_CODE = 7


def _merge_hard_skills(
        skills: pd.DataFrame, activities: pd.DataFrame,
        rome_crosswalks: pd.DataFrame) -> pd.DataFrame:
    """Make a hard skill dataframe."""

    skills.set_index('code_ogr', inplace=True)
    activities.set_index('code_ogr', inplace=True)

    skills_rome = rome_crosswalks.join(skills, how='inner', on='code_ogr', )
    activities_rome = rome_crosswalks.join(activities, how='inner', on='code_ogr')

    return skills_rome[[
        'code_rome', 'code_ogr', 'libelle_competence', 'code_ref_rubrique']] \
        .append(
            activities_rome[['code_rome', 'code_ogr', 'libelle_activite', 'code_ref_rubrique']]
            .rename(columns={'libelle_activite': 'libelle_competence'}))


def _get_skill_freq_in_offers(job_offers_skills: pd.DataFrame) -> pd.DataFrame:
    """Get the frequency of a skill among the job offers for this occupation """

    # Remove duplicated skills of each offers.
    job_offers_skills.drop_duplicates(['offer_num', 'code_ogr'], inplace=True)

    skills_occurences = job_offers_skills.groupby(
        'rome_profession_card_code').code_ogr.value_counts()
    num_offers_per_rome = job_offers_skills.groupby(
        'rome_profession_card_code').offer_num.nunique()
    return skills_occurences.div(num_offers_per_rome).rename('frequency')


def main(
        data_folder: str = 'data',
        rome_crosswalks_filename: Optional[str] = None,
        job_offers_filename: Optional[str] = None,
        skills_filename: Optional[str] = None,
        activities_filename: Optional[str] = None,
        out_dir: str = 'job_group_skills') -> None:
    """Get prioritized skills for each job group."""

    if not rome_crosswalks_filename:
        rome_crosswalks_filename = path.join(
            data_folder, f'rome/csv/unix_liens_rome_referentiels_{_ROME_VERSION}_utf8.csv')
    if not job_offers_filename:
        job_offers_filename = path.join(data_folder, 'job_offers/recent_job_offers.csv')
    if not skills_filename:
        skills_filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_competence_{_ROME_VERSION}_utf8.csv')
    if not activities_filename:
        activities_filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_activite_{_ROME_VERSION}_utf8.csv')

    out_dir_path = path.join(data_folder, out_dir)
    if not path.isdir(out_dir_path):
        os.mkdir(out_dir_path)

    job_offers_skills = cleaned_data.job_offers_skills(data_folder)
    rome_crosswalks = pd.read_csv(rome_crosswalks_filename)
    skills = pd.read_csv(skills_filename)
    activities = pd.read_csv(activities_filename)

    # Get the frequency of a skill among the job offers for this occupation.
    skills_freq_in_offers = _get_skill_freq_in_offers(job_offers_skills).reset_index().rename(
        columns={'rome_profession_card_code': 'code_rome'})

    # Keep only the basic and not the specific skills.
    hard_skills_rome = _merge_hard_skills(skills, activities, rome_crosswalks)
    basic_hard_skills_rome = hard_skills_rome.loc[
        (hard_skills_rome.code_ref_rubrique == _BASIC_SKILL_RUBRIQUE_CODE) |
        (hard_skills_rome.code_ref_rubrique == _BASIC_ACTIVITY_RUBRIQUE_CODE)]

    basic_hard_skills_rome.set_index(['code_ogr', 'code_rome'], inplace=True)

    # Add priorities.
    prioritized_hard_skills = basic_hard_skills_rome.join(
        skills_freq_in_offers.set_index(['code_ogr', 'code_rome']), how='left')\
        .fillna(0).reset_index()

    prioritized_hard_skills['isPriority'] = prioritized_hard_skills.frequency.gt(.5)

    clean_columns = prioritized_hard_skills.rename({
        'libelle_competence': 'name',
        'code_ogr': 'codeOgr',
    }, axis='columns').sort_values(['frequency'], ascending=False).drop([
        'code_ref_rubrique',
        'frequency',
    ], axis='columns')

    clean_columns.groupby('code_rome').apply(
        lambda df: df
        .drop('code_rome', axis='columns')
        .to_json(path.join(out_dir_path, f'skills_{df.name}.json'), orient='records'))


if __name__ == '__main__':
    main()
