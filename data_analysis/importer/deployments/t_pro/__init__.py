"""Module for Bob UK importers."""

import os

from bob_emploi.data_analysis.importer import importers
from bob_emploi.frontend.api import job_pb2

_ROME_VERSION = 'v347'

_HERE = os.path.relpath(
    os.path.dirname(__file__),
    os.path.dirname(importers.__file__))

IMPORTERS = {
    'best_jobs_in_area': importers.IMPORTERS['best_jobs_in_area'].
    updated_with_script(f'{_HERE}/best_jobs_in_area').
    updated_with_args(
        metiers_xlsx='data/t_pro/metiers_porteurs.xlsx',
        rome_item_arborescence=None),
    'job_group_info': importers.IMPORTERS['job_group_info'].
    updated_with_script(f'{_HERE}/job_group_info').
    updated_with_args(
        keep_old=False,
        job_requirements_json='data/fhs/s3/job_offers_requirements.json',
        metiers_xlsx='data/t_pro/metiers_porteurs.xlsx',
        rome_csv_pattern=f'data/rome/csv/unix_{{}}_{_ROME_VERSION}_utf8.csv'),
    'local_diagnosis': importers.IMPORTERS['local_diagnosis'].
    updated_with_script(f'{_HERE}/local_diagnosis').
    updated_with_args(
        keep_old=False,
        metiers_xlsx='data/t_pro/metiers_porteurs.xlsx',
        imt_salaries_csv='data/imt/salaries.csv',
        pcs_rome_crosswalk='data/crosswalks/passage_pcs_romev3.csv'),
    'section_generators': importers.IMPORTERS['section_generators'].
    updated_with_args(view='viwInTduBdxQ32kvD'),
}
