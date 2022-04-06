"""Helper functions to clean Transition Pros data."""

import pandas as pd


def clean_metiers(metiers_xlsx: str) -> pd.DataFrame:
    """Clean the Excel file with job informations."""

    tpro_jobs = pd.read_excel(metiers_xlsx, header=1).fillna(method='ffill')
    tpro_jobs['job_group'] = tpro_jobs['ROME associés'].str.strip()
    tpro_jobs.rename({
        'Catégories de métiers': 'name',
        'DOMEX': 'sector',
    }, axis=1, inplace=True)
    return tpro_jobs[['job_group', 'name', 'sector']]
