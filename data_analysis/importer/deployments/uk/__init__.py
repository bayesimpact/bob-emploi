"""Module for Bob UK importers."""

import os

from bob_emploi.data_analysis.importer import importers
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import training_pb2

_HERE = os.path.relpath(
    os.path.dirname(__file__),
    os.path.dirname(importers.__file__))

IMPORTERS = dict(
    {
        key: importer for key, importer in importers.IMPORTERS.items()
        if key in {
            'diagnostic_overall',
            'diagnostic_responses',
            'strategy_modules',
            'strategy_advice_templates',
            'translations',
            'trainings'
        }
    },
    action_templates=importers.IMPORTERS['action_templates'].updated_with_args(
        view='Export Bob UK'),
    advice_modules=importers.IMPORTERS['advice_modules'].updated_with_args(view='Export Bob UK'),
    application_tips=importers.IMPORTERS['application_tips'].updated_with_args(
        view='Export Bob UK'),
    associations=importers.IMPORTERS['associations'].updated_with_args(view='Export Bob UK'),
    best_jobs_in_area=importers.IMPORTERS['best_jobs_in_area'].
    updated_with_script(f'{_HERE}/best_jobs_in_area').updated_with_args(
        keep_old=False,
        geonames_admin_txt='data/uk/geonames_admin.txt',
        geonames_txt='data/uk/geonames.txt',
        salaries_by_region_2020_xls='data/uk/salaries_by_region_2020.xls',
        wards_ons_csv='data/uk/wards_counties_regions_local_authorities_2016.csv'),
    departements=importers.Importer(
        name='Basic information for UK local authorities',
        script=f'{_HERE}/local_authorities',
        args={
            'wards_counties_regions_local_authorities_csv':
            'data/uk/wards_counties_regions_local_authorities_2016.csv',
        },
        is_imported=True,
        run_every=None,
        proto_type=geo_pb2.Departement,
        key='Local Authority ID',
        has_pii=False),
    diagnostic_main_challenges=importers.IMPORTERS['diagnostic_main_challenges'].updated_with_args(
        view='Export Bob UK'),
    focus_emails=importers.IMPORTERS['focus_emails'].updated_with_args(
        view='Live in Bob UK'),
    local_diagnosis=importers.Importer(
        name='Local Diagnosis',
        script=f'{_HERE}/local_diagnosis',
        args={
            'postings_csv': 'data/uk/emsi_postings_counts_2019-area4-occ4.csv',
            'occupations_csv': 'data/uk/emsi_occupation_counts.csv',
            'career_jumps_csv': 'data/uk/soc/career_changers_matrix.csv',
            'jobs_xls': 'data/uk/soc/soc2010.xls',
            'info_by_prefix_airtable': 'app2xuIa0KpAWGJBV:tbl7eVORxOnsCH5mv',
            'geonames_admin_txt': 'data/uk/geonames_admin.txt',
            'geonames_txt': 'data/uk/geonames.txt',
            'salary_filename': 'data/uk/salaries_by_region_2020.xls',
            'wards_ons_csv': 'data/uk/wards_counties_regions_local_authorities_2016.csv',
        },
        is_imported=True,
        run_every='30 days',
        proto_type=job_pb2.LocalJobStats,
        key='<local authority ID>:<job group ID>',
        has_pii=False),
    jobboards=importers.IMPORTERS['jobboards'].updated_with_args(view='Export Bob UK'),
    job_group_info=importers.Importer(
        name='Job Group Info',
        script=f'{_HERE}/job_group_info',
        args={
            'postings_csv': 'data/uk/emsi_postings_counts_2019-area4-occ4.csv',
            'occupations_csv': 'data/uk/emsi_occupation_counts.csv',
            'jobs_xls': 'data/uk/soc/soc2010.xls',
            'soc2010_js': 'data/uk/soc/socDB.js',
            'career_jumps_csv': 'data/uk/soc/career_changers_matrix.csv',
            'automation_xls': 'data/uk/automation_probability.xls',
            'info_by_prefix_airtable': 'app2xuIa0KpAWGJBV:tbl7eVORxOnsCH5mv',
            'occupation_requirements_json': 'data/uk/job_requirements.json',
            'skills_for_future_airtable': 'appXmyc7yYj0pOcae:skills_for_future:viwfJ3L3qKPMVV2wp',
        },
        is_imported=True,
        run_every='30 days',
        proto_type=job_pb2.JobGroup,
        key='job group ID',
        has_pii=False),
    section_generators=importers.IMPORTERS['section_generators'].updated_with_args(
        view='Ready to Import UK'),
    specific_to_job_advice=importers.IMPORTERS['specific_to_job_advice'].updated_with_args(
        view='Export Bob UK'),
    trainings=importers.Importer(
        name='UK Trainings',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'UK training',
            'view': 'Ready to Import',
            'proto': 'Training',
        },
        is_imported=True,
        run_every=None,
        proto_type=training_pb2.Training,
        key='airtable ID',
        has_pii=False),
)
