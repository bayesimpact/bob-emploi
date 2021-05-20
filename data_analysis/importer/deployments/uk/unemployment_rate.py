"""Get the Labour Force Survey data on unemployment from LMI for all API."""

import argparse
import json
from typing import Optional, List, TypedDict

import requests

from bob_emploi.data_analysis.lib import uk_cleaned_data


class Rate(TypedDict):
    """Unemployment rate from the LMI for all API."""

    unemprate: float
    year: int


def _get_unemployment_rate(code: int, year: int) -> float:
    """Get the unemployment rate for the requested year from LMI for all.
        returns -1 if there are no data.
    """

    response = requests.get(
        f'http://api.lmiforall.org.uk/api/v1/lfs/unemployment?soc={code}&minYear={year}',
        headers={'Accept': 'application/json'})
    formatted_response = json.loads(response.text)
    if 'years' not in formatted_response:
        return -1.0
    data: Rate = formatted_response['years'].pop()
    if 'year' in data and data['year'] == year and 'unemprate' in data:
        return data['unemprate'] if data['unemprate'] else -1.0
    return -1.0


def main(
        output_csv: str,
        jobs_xls: str = 'data/uk/soc/soc2010.xls',
        year: int = 2020) -> None:
    """Get the unemployment rate for unit soc groups."""

    job_groups = uk_cleaned_data.uk_soc2010_job_groups(filename=jobs_xls) \
        .reset_index()
    job_groups['unemployment_rate'] = job_groups.Unit_Group.apply(
        _get_unemployment_rate, args=(year,))
    job_groups.to_csv(output_csv, index=False, sep='\t')


def _parser_main(string_args: Optional[List[str]] = None) -> None:

    parser = argparse.ArgumentParser(
        description='Get the unemployment rate for a specific year for a list of SOC codes.')
    parser.add_argument(
        '--output-csv', default='data/uk/unemployment_rate.csv',
        help='The path where you wish to save the file.')
    parser.add_argument(
        '--jobs-xls', nargs='?', help='The path of the list of all SOC2010 job groups.')
    parser.add_argument(
        '--year-of-interest',
        default=2020,
        nargs='?',
        help='The year for which the unemployment rate is requested.')
    args = parser.parse_args(string_args)
    main(args.output_csv, args.jobs_xls, args.year_of_interest)


if __name__ == '__main__':
    _parser_main()
