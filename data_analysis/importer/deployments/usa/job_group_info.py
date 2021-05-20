"""Importer for US job groups info."""

import os
import typing
from typing import Any, Dict, List, Optional, Tuple

from airtable import airtable
import pandas as pd

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import usa_cleaned_data


def _load_crosswalk_airtable(base_id: str, table: str, view: Optional[str] = None) -> pd.DataFrame:
    """Load FAP -> SOC crosswalk from AirTable.

    Args:
        base_id: the ID of your AirTable app.
        table: the name of the table to import.
    """

    api_key = os.getenv('AIRTABLE_API_KEY')
    if not api_key:
        raise ValueError(
            'No API key found. Create an airtable API key at '
            'https://airtable.com/account and set it in the AIRTABLE_API_KEY '
            'env var.')
    client = airtable.Airtable(base_id, api_key)
    mappings: List[Tuple[str, str]] = []
    errors: List[KeyError] = []
    for record in client.iterate(table, view=view):
        try:
            for fap_prefix in record['fields']['FAP prefixes']:
                mappings.append((record['fields']['O*NET-SOC Code'], fap_prefix))
        except KeyError as error:
            errors.append(error)
    if errors:
        raise KeyError(
            f'{len(errors):d} errors while importing from Airtable:\n' +
            '\n'.join(str(error) for error in errors))
    return pd.DataFrame(mappings, columns=('soc_2018', 'fap_prefix'))


def make_dicts(
        *,
        soc_definitions_xls: str,
        hires_csv: str,
        job_seekers_csv: str,
        states_txt: str,
        application_mode_csv: str,
        soc_structure_xls: str,
        soc_fap_crosswalk_airtable: str,
        brookings_automation_risk_json: str,
) -> List[Dict[str, Any]]:
    """Prepare job info for MongoDB."""

    job_groups = usa_cleaned_data.us_soc2010_job_groups(filename=soc_definitions_xls)
    job_groups['_id'] = job_groups['romeId']

    # Domains
    structure = pd.read_excel(soc_structure_xls, skiprows=11)\
        .dropna(subset=['Major Group'])\
        .drop(['Minor Group', 'Broad Group', 'Detailed Occupation'], axis='columns')
    structure['Major Group'] = structure['Major Group'].str[:3]
    major_groups = structure.set_index('Major Group').squeeze()
    job_groups['domain'] = job_groups['romeId'].str[:3].map(major_groups)
    job_groups.domain.fillna('', inplace=True)

    local_stats = usa_cleaned_data.usa_compute_market_score(
        hires_csv=hires_csv, job_seekers_csv=job_seekers_csv, job_groups=job_groups)

    # Application modes.
    modes = cleaned_data.fap_application_modes(filename=application_mode_csv)
    fap_prefixes = pd.DataFrame({'fap_code': modes.index, 'fap_prefix': modes.index.str[:3]})
    soc_to_fap_prefix = _load_crosswalk_airtable(*soc_fap_crosswalk_airtable.split(':'))
    soc_to_fap = soc_to_fap_prefix.join(
        fap_prefixes.set_index('fap_prefix'), on='fap_prefix', how='inner')
    soc_to_fap['modes'] = soc_to_fap.fap_code.map(modes)
    job_groups['applicationModes'] = soc_to_fap.groupby('soc_2018').apply(lambda faps: {
        str(fap.fap_code): fap.modes for fap in faps.itertuples() if fap.modes
    })
    # Fill NaN with empty {}.
    job_groups['applicationModes'] = job_groups.applicationModes.apply(
        lambda s: s if isinstance(s, dict) else {})

    # Add best counties.
    # TODO(cyrille): Rename field to a more generic area name.
    job_groups['departementScores'] = market_score_derivatives.get_less_stressful_districts(
        local_stats, max_districts=20)
    # Fill NaN with empty [].
    job_groups['departementScores'] = job_groups.departementScores.apply(
        lambda s: s if isinstance(s, list) else [])

    job_groups['automationRisk'] = usa_cleaned_data.us_automation_brookings(
        filename=brookings_automation_risk_json,
        soc_filename=soc_definitions_xls).mul(100).round(0).astype(int)
    # Mark 0 values as 1, as 0 means undefined.
    job_groups.loc[job_groups['automationRisk'] == 0, 'automationRisk'] = 1
    job_groups['automationRisk'].fillna(0, inplace=True)

    # Data per state.
    states = pd.read_csv(states_txt, delimiter='|')
    local_stats['state'] = local_stats['district_id'].astype(int).div(1000).astype(int)\
        .map(states.set_index('STATE').STUSAB)
    state_scores = local_stats.dropna(subset=['market_score'])\
        .groupby(['state', 'job_group']).market_score.median().reset_index()
    job_groups['admin1AreaScores'] = state_scores.groupby('job_group').apply(lambda stat_scores: [
        {
            'areaId': row.state,
            'localStats': {'imt': {'yearlyAvgOffersPer10Candidates': round(row.market_score)}},
        }
        for row in stat_scores.itertuples()
    ])
    # Fill NaN with empty [].
    job_groups['admin1AreaScores'] = job_groups.admin1AreaScores.apply(
        lambda s: s if isinstance(s, list) else [])

    return typing.cast(List[Dict[str, Any]], job_groups.to_dict('records'))


if __name__ == '__main__':
    mongo.importer_main(make_dicts, 'job_group_info')
