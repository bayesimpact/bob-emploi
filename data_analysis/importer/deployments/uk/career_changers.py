"""Convert the Career Changers Matrix from O*NET to SOC."""

import argparse
import json
from typing import Optional, Iterable, TextIO, Union

import pandas as pd
import requests

from bob_emploi.data_analysis.lib import batch

ONET_VERSION = '22_3'


def _soc_to_onet_api(codes: list[str]) -> requests.Response:
    batch_codes = ','.join(codes)
    return requests.get(
        f'http://api.lmiforall.org.uk/api/v1/o-net/onet2soc?onetCodes={batch_codes}',
        headers={'Accept': 'application/json'})


# TODO(cyrille): Move to lib, if we need it again.
def _get_soc_to_onet(onet_codes: Iterable[str]) -> pd.Series:
    return pd.Series({
        code['soc']: onet_code['onetCode']
        for batched_codes in batch.batch_iterator(onet_codes, 10)
        for response in [_soc_to_onet_api(batched_codes)]
        for onet_code in json.loads(response.text)
        for code in onet_code['socCodes']})


def main(output_csv: Union[str, TextIO], career_changers_tsv: str) -> None:
    """Make a career changers matrix for SOC codes from the O*NET one."""

    onet_career_jumps = pd.read_csv(
        career_changers_tsv, delimiter='\t',
        header=0, names=['job_group', 'target_job_group', 'rank']).drop(['rank'], axis='columns')
    relevant_onet_codes = onet_career_jumps.job_group\
        .append(onet_career_jumps.target_job_group)\
        .unique()
    soc_to_onet = _get_soc_to_onet(relevant_onet_codes)
    onet_career_jumps\
        .merge(
            soc_to_onet.to_frame('job_group').reset_index(),
            on='job_group')\
        .merge(
            soc_to_onet.to_frame('target_job_group').reset_index(),
            on='target_job_group', suffixes=('', '_target'))\
        .drop(['job_group', 'target_job_group'], axis='columns')\
        .rename({
            'index': 'job_group',
            'index_target': 'target_job_group',
        }, axis='columns').to_csv(output_csv, index=False)


def _parser_main(string_args: Optional[list[str]] = None) -> None:

    parser = argparse.ArgumentParser(
        description='Make a career changers matrix for SOC codes.')
    parser.add_argument(
        '--output-csv', default='data/uk/soc/career_changers_matrix.csv',
        help='The path where you wish to save the created matrix.')
    parser.add_argument(
        '--career-changers-tsv',
        default=f'data/usa/onet_{ONET_VERSION}/Career_Changers_Matrix.txt',
        help='The path of an existing Career Changers matrix for O*NET')
    args = parser.parse_args(string_args)
    main(args.output_csv, args.career_changers_tsv)


if __name__ == '__main__':
    _parser_main()
