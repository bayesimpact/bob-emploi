"""Module to upload the number of unemployed people per occupation and county from Emsi.

To run it, you need job seekers numbers and openings dataset from Emsi.

docker-compose run --rm -e MONGO_URL=<the US MONGO URL> \
    data-analysis-prepare python \
    bob_emploi/data_analysis/importer/deployments/usa/local_diagnosis.py
"""

from typing import Any, Iterator

import pandas as pd

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import market_score_derivatives
from bob_emploi.data_analysis.lib import usa_cleaned_data

ONET_VERSION = '22_3'

# Cache for loading the carreer changers matrix.
_CARREER_CHANGERS_CACHE: dict[str, pd.DataFrame] = {}


def csv2dicts(
        *,
        hires_csv: str = 'data/usa/emsi_hires.csv',
        job_seekers_csv: str = 'data/usa/emsi_job_seekers_counts_dec_2019.csv',
        carreer_changers_tsv: str = f'data/usa/onet_{ONET_VERSION}/Career_Changers_Matrix.txt',
        soc_definition_xls: str = 'data/usa/soc/soc2010_definition.xls') \
        -> Iterator[dict[str, Any]]:
    """Compute market stress from unemployed and hires dataset."""

    job_groups = usa_cleaned_data.us_soc2010_job_groups(filename=soc_definition_xls)
    job_group_names = job_groups.name.to_dict()
    local_stats = usa_cleaned_data.usa_compute_market_score(
        hires_csv=hires_csv, job_seekers_csv=job_seekers_csv, job_groups=job_groups)
    carreer_jumps = usa_cleaned_data.usa_soc2010_career_changes(filename=carreer_changers_tsv)
    yield from market_score_derivatives.local_diagnosis(
        local_stats, carreer_jumps, prefix_length=2, job_group_names=job_group_names)


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'local_diagnosis', count_estimate=2756677)
