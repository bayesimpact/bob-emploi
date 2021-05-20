"""Module for Bob USA importers."""

import os

from bob_emploi.data_analysis.importer import importers
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2

_HERE = os.path.relpath(
    os.path.dirname(__file__),
    os.path.dirname(importers.__file__))

_ONET_VERSION = '22_3'

IMPORTERS = dict(
    {
        key: importer for key, importer in importers.IMPORTERS.items()
        if key in {
            'diagnostic_overall',
            'diagnostic_responses',
            'reorient_jobbing',
            'strategy_modules',
            'strategy_advice_templates',
            'translations'
        }
    },
    advice_modules=importers.IMPORTERS['advice_modules'].updated_with_args(view='Export Bob US'),
    application_tips=importers.IMPORTERS['application_tips'].updated_with_args(
        view='Export Bob US'),
    diagnostic_main_challenges=importers.IMPORTERS['diagnostic_main_challenges'].updated_with_args(
        view='Export Bob US'),
    focus_emails=importers.IMPORTERS['focus_emails'].updated_with_args(view='Export Bob US'),
    jobboards=importers.IMPORTERS['jobboards'].updated_with_args(view='Export Bob US'),
    local_diagnosis=importers.Importer(
        name='Local Diagnosis',
        script=f'{_HERE}/local_diagnosis',
        args={
            'hires_csv': 'data/usa/emsi_hires.csv',
            'job_seekers_csv': 'data/usa/emsi_job_seekers_counts_dec_2019.csv',
            'carreer_changers_tsv': f'data/usa/onet_{_ONET_VERSION}/Career_Changers_Matrix.txt',
            'soc_definition_xls': 'data/usa/soc/soc_2010_definitions.xls',
        },
        is_imported=True,
        run_every='30 days',
        proto_type=job_pb2.LocalJobStats,
        key='<County FIPS ID>:<job group ID>',
        has_pii=False),
    job_group_info=importers.Importer(
        name='Job Group Info',
        script=f'{_HERE}/job_group_info',
        args={
            'application_mode_csv': 'data/imt/application_modes.csv',
            'hires_csv': 'data/usa/emsi_hires.csv',
            'job_seekers_csv': 'data/usa/emsi_job_seekers_counts_dec_2019.csv',
            'soc_fap_crosswalk_airtable': 'app2xuIa0KpAWGJBV:SOC US 2010',
            'soc_definitions_xls': 'data/usa/soc/soc_2010_definitions.xls',
            'states_txt': 'data/usa/states.txt',
            'soc_structure_xls': 'data/usa/soc/soc_structure_2010.xls',
            'brookings_automation_risk_json': 'data/usa/automation-risk.json',
        },
        is_imported=True,
        run_every='30 days',
        proto_type=job_pb2.JobGroup,
        key='job group ID',
        has_pii=False),
    reorient_jobbing=importers.Importer(
        name='Reorient to jobbing positions',
        script=f'{_HERE}/reorient_jobbing',
        args={
            'job_zones_tsv': f'data/usa/onet_{_ONET_VERSION}/job_zones.tsv',
            'occupation_data_txt': f'data/usa/onet_{_ONET_VERSION}/Occupation_Data.txt'
        },
        is_imported=True,
        run_every='30 days',
        proto_type=reorient_jobbing_pb2.LocalJobbingStats,
        key='Departement ID',
        has_pii=False),
    specific_to_job_advice=importers.IMPORTERS['specific_to_job_advice'].updated_with_args(
        view='Export Bob US'),
)
