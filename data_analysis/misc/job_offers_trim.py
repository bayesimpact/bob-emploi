"""Script to trim down the full job offers file.

The historic job offers file from Pole Emploi is 12Gb+, in order to maniuplate
it in RAM run this script to remove the fields you do not need.

Example of usage:
docker-compose run --rm data-analysis-prepare \
    python bob_emploi/data_analysis/misc/job_offers_trim.py \
    data/job_offers/sample_10perc.csv \
    data/job_offers/column_names.txt \
    data/job_offers/trimmed_offers.csv \
    2015-06-01 \
    rome_profession_card_code,experience_min_duration,creation_date
"""

import argparse
import csv
from typing import Optional, Set, TextIO

import tqdm

from bob_emploi.data_analysis.lib import job_offers

_DEFAULT_FIELDS = 'rome_profession_card_code,experience_min_duration,creation_date'


def _trim_job_offers_csv(args: argparse.Namespace, out: Optional[TextIO]) -> None:

    fieldnames = args.fields.split(',')
    all_job_offers = job_offers.iterate(
        args.in_csv, args.colnames_txt, required_fields=set(fieldnames + ['creation_date']))

    number_offers_estimate = 8500000

    with open(args.out_csv, 'w', encoding='utf-8') as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()

        trim_date_fields: Set[str] = set()
        if args.trim_dates:
            trim_date_fields = {
                field for field in fieldnames
                if field.startswith('date_') or field.endswith('_date')
            }

        for job_offer in tqdm.tqdm(all_job_offers, total=number_offers_estimate, file=out):
            if job_offer.creation_date < args.min_creation_date:
                continue
            row = {field: getattr(job_offer, field) for field in fieldnames}
            for field in trim_date_fields:
                row[field] = row[field][:10]
            writer.writerow(row)


def main(string_args: Optional[list[str]] = None, out: Optional[TextIO] = None) -> None:
    """Trim job offers CSV."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        'in_csv',
        help='Path of the CSV file containing all job offers in the Pôle emploi '
        'format (using latin-1 encoding, | separators, etc).')
    parser.add_argument('colnames_txt', help='TXT file containing the list of column names.')
    parser.add_argument('out_csv', help='Path where to store the output CSV file.')
    parser.add_argument('min_creation_date', help='Trim out all offers created before this date.')
    parser.add_argument(
        'fields', help='list of fields to keep, separated by commas.',
        default=_DEFAULT_FIELDS)
    parser.add_argument('--trim-dates', action='store_true', help='Trim dates precision to the day')

    args = parser.parse_args(string_args)

    _trim_job_offers_csv(args, out=out)


if __name__ == '__main__':
    main()
