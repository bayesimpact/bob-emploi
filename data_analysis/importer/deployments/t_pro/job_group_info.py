"""Import jobs for t_pro jobflix."""

from typing import Any

import pandas as pd

from bob_emploi.data_analysis.importer import job_group_info
from bob_emploi.data_analysis.importer.deployments.t_pro import cleaned_data
from bob_emploi.data_analysis.lib import mongo

_KEPT_FIELDS = ('_id', 'romeId', 'description', 'requirements', 'samples')


def _make_sampler(tpro_jobs: pd.DataFrame) -> job_group_info.Sampler:
    tpro_job_names = tpro_jobs.set_index('job_group').name

    def _sample(jobs: pd.DataFrame) -> list[dict[str, Any]]:
        names = jobs.code_rome.map(tpro_job_names).unique()
        return [{'name': name} for name in names]
    return _sample


def make_dicts(
        *, rome_csv_pattern: str, job_requirements_json: str,
        metiers_xlsx: str) -> list[dict[str, Any]]:
    """Import job info in MongoDB.

    Args:
        rome_csv_pattern: pattern of paths to CSV file containing the ROME data.
            It must contain a '{}' that will be replaced by
            'referentiel_code_rome', 'referentiel_env_travail',
            'liens_rome_referentiels' and 'referentiel_appellation'.
        metiers_xlsx: path to an Excel file containing Transitions Pro jobs.
    Returns:
        A list of dict that maps the JSON representation of JobGroup protos.
    """

    tpro_jobs = cleaned_data.clean_metiers(metiers_xlsx)
    sampler = _make_sampler(tpro_jobs)
    full_dicts = job_group_info.make_dicts(
        job_requirements_json=job_requirements_json,
        rome_csv_pattern=rome_csv_pattern, sampler_generator=lambda n: sampler)
    return [
        {key: d[key] for key in _KEPT_FIELDS if key in d}
        for d in full_dicts
        if d['_id'] in set(tpro_jobs.job_group.unique())]


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')
