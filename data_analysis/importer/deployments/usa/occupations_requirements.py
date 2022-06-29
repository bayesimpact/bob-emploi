"""Importer for occuptions requirements.

This script gathers information from O*NET on occupations and uploads to MongoDB some
requirements per job group.

You can run it with:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/deployments/usa/occupations_requirements.py \
        --soc_job_requirements_csv 'data/usa/onet_22_3/Education_Training_and_Experience.txt'
"""

import typing
from typing import Any

import pandas as pd

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import mongo

ONET_VERSION = '22_3'


# Mapping of degrees requirement categories to proto degrees.
_DIPLOMA_TO_DEGREE = {
    1: job_pb2.NO_DEGREE,
    2: job_pb2.BAC_BACPRO,
    3: job_pb2.BTS_DUT_DEUG,
    4: job_pb2.BAC_BACPRO,
    5: job_pb2.BTS_DUT_DEUG,
    6: job_pb2.LICENCE_MAITRISE,
    7: job_pb2.LICENCE_MAITRISE,
    8: job_pb2.DEA_DESS_MASTER_PHD,
    9: job_pb2.DEA_DESS_MASTER_PHD,
    10: job_pb2.DEA_DESS_MASTER_PHD,
    11: job_pb2.DEA_DESS_MASTER_PHD,
    12: job_pb2.DEA_DESS_MASTER_PHD,
}

_DEGREE_TO_DIPLOMA = {
    job_pb2.NO_DEGREE: 'No high school diploma / GED',
    job_pb2.BAC_BACPRO: 'High school diploma / GED',
    job_pb2.BTS_DUT_DEUG: "Credential / Certification or Associate's degree",
    job_pb2.LICENCE_MAITRISE: "Bachelor's degree",
    job_pb2.DEA_DESS_MASTER_PHD: "Master's degree, PhD, or higher",
}


def _get_education_requirements(requirements: pd.DataFrame) -> list[dict[str, Any]]:

    requirements['degree'] = requirements.Category.replace(_DIPLOMA_TO_DEGREE)
    requirements.degree.fillna(job_pb2.UNKNOWN_DEGREE)
    requirements['percentRequired'] = requirements.degree.map(
        requirements.groupby('degree')['Data Value'].sum().round())
    requirements['name'] = requirements.degree.replace(_DEGREE_TO_DIPLOMA)
    requirements['diploma'] = requirements.degree.apply(
        lambda deg: {'level': job_pb2.DegreeLevel.Name(
            typing.cast('job_pb2.DegreeLevel.V', int(deg)))})

    return typing.cast(
        list[dict[str, Any]],
        requirements.drop_duplicates('degree')[['diploma', 'name', 'percentRequired']]
        .sort_values('percentRequired', ascending=False).to_dict(orient='records'))


def _average_education_requirements(requirements: pd.DataFrame) -> pd.DataFrame:

    averaged_requirements = requirements[requirements['O*NET-SOC Code'].str[-3:] == '.00']
    if averaged_requirements.empty:
        averaged_requirements = requirements.groupby(['2018 SOC Code', 'Element ID', 'Category'])\
            .mean().reset_index()

    return averaged_requirements


def csv2dicts(
        soc_job_requirements_csv: str =
        f'data/usa/onet_{ONET_VERSION}/Education_Training_and_Experience.txt',
        soc_crosswalk_csv: str = 'data/usa/soc/2010_to_2018_SOC_Crosswalk.csv') \
        -> list[dict[str, Any]]:
    """Import the education requirement from O*NET grouped by Job Group in MongoDB.

    Args:
        soc_job_requirements_csv: Path of the csv containing the education requirements data.
        soc_crosswalk_csv: Path of the csv containing the crosswalk between SOC 2010 and 2018
        versions.
    Returns:
        Requirements as a JobRequirements JSON-proto compatible dict.
    """

    job_requirements = pd.read_table(soc_job_requirements_csv)
    soc_crosswalk_2010_2018 = pd.read_csv(soc_crosswalk_csv, delimiter=',')
    job_requirements_2018 = job_requirements.join(
        soc_crosswalk_2010_2018.set_index('O*NET-SOC 2010 Code')[['2018 SOC Code']],
        on='O*NET-SOC Code')
    # We keep detailed occupation (ending with .00), however for occupation groups where we have
    # only detailed data, we average the data for sub occupations.
    average_education_requirements = job_requirements_2018.groupby('2018 SOC Code')\
        .apply(_average_education_requirements)\
        .reset_index(drop=True)
    # We keep only required levels of education (2.D.1) that have already been observed.
    education_requirements = average_education_requirements[
        (average_education_requirements['Element ID'] == '2.D.1') &
        (average_education_requirements['Data Value'] > 0)]
    soc_education_requirements = education_requirements.groupby('2018 SOC Code').apply(
        _get_education_requirements).rename('diplomas').reset_index()
    soc_education_requirements['_id'] = soc_education_requirements['2018 SOC Code']

    return typing.cast(
        list[dict[str, Any]],
        soc_education_requirements[['_id', 'diplomas']].to_dict(orient='records'))


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'job_requirements')
