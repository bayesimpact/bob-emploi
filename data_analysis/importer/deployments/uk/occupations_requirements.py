"""Importer for occupations requirements.

This script gathers information from SOC on occupations and uploads to MongoDB some
requirements per job group.

You can run it with:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/deployments/uk/occupations_requirements.py \
        --soc_job_requirements_csv 'data/uk/diplomas.txt'
"""

import typing
from typing import Any, Mapping

import pandas as pd

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data


# Mapping of degrees requirement levels to proto degrees.
_DIPLOMA_TO_DEGREE: Mapping[str, 'job_pb2.DegreeLevel.V'] = {
    'nqf3-less': job_pb2.NO_DEGREE,
    'nqf3': job_pb2.BAC_BACPRO,
    'nqf4': job_pb2.BTS_DUT_DEUG,
    'nqf6': job_pb2.LICENCE_MAITRISE,
    'phd': job_pb2.DEA_DESS_MASTER_PHD,
}

# https://en.wikipedia.org/wiki/National_Vocational_Qualification
_DEGREE_TO_DIPLOMA: Mapping['job_pb2.DegreeLevel.V', str] = {
    job_pb2.NO_DEGREE: 'No high school diploma',
    job_pb2.BAC_BACPRO: 'GCSE or equivalent',
    job_pb2.BTS_DUT_DEUG: "Credential / Certification or Associate's degree",
    job_pb2.LICENCE_MAITRISE: "Bachelor's degree",
    job_pb2.DEA_DESS_MASTER_PHD: "Master's degree, PhD, or higher",
}


def _get_education_requirements(level: str) -> Any:

    degree = _DIPLOMA_TO_DEGREE.get(level) or job_pb2.DegreeLevel.Value(level)

    return [{
        'diploma': {
            'level': job_pb2.DegreeLevel.Name(degree),
        },
        'name': _DEGREE_TO_DIPLOMA[degree],
        'percentRequired': 90,
    }]


def csv2dicts(
        soc_job_requirements_csv: str = 'data/uk/diplomas.txt',
        soc_descriptions_js: str = 'data/uk/soc/socDB.js') -> list[dict[str, Any]]:
    """Import the education requirement from SOC grouped by Job Group in MongoDB.

    Args:
        soc_job_requirements_csv: Path of the csv containing the education requirements data.
    Returns:
        Requirements as a JobRequirements JSON-proto compatible dict.
    """

    education_requirements = pd.read_table(soc_job_requirements_csv, dtype={'soc': str})
    soc_entries = uk_cleaned_data.uk_soc2010_group_descriptions(filename=soc_descriptions_js).\
        minimum_diploma.dropna().reset_index(name='level').rename({'soc2010': 'soc'}, axis=1)
    soc_entries = soc_entries[
        (soc_entries.level != 'UNKNOWN_DEGREE')]
    # TODO(cyrille): Decide how we should arbitrate between the two sources.
    education_requirements = pd.concat((education_requirements, soc_entries)).drop_duplicates(
        'soc', keep='first').set_index('soc').level
    soc_education_requirements = education_requirements.\
        apply(_get_education_requirements).\
        to_frame('diplomas')
    soc_education_requirements['_id'] = soc_education_requirements.index
    return typing.cast(
        list[dict[str, Any]],
        soc_education_requirements[['_id', 'diplomas']].to_dict(orient='records'))


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'job_requirements')
