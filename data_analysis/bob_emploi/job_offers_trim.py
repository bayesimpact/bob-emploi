"""Script to trim down the full job offers file.

The historic job offers file from Pole Emploi is 12Gb+, in order to maniuplate
it in RAM run this script to remove the fields you do not need.

Example of usage:
docker-compose run --rm data-analysis-prepare \
    python bob_emploi/job_offers_trim.py \
    data/job_offers/sample_10perc.csv \
    data/job_offers/column_names.txt \
    data/job_offers/trimmed_offers.csv \
    2015-06-01 \
    rome_profession_card_code,experience_min_duration,creation_date
"""
import csv
import sys

from bob_emploi.lib import job_offers

_DEFAULT_FIELDS = 'rome_profession_card_code,experience_min_duration,creation_date'


def trim_job_offers_csv(
        in_csv, colnames_txt, out_csv, min_creation_date='', fields=_DEFAULT_FIELDS):
    """Trim job offers CSV.

    Args:
        in_csv: the path of the CSV file containing all job offers in the Pôle
            Emploi format (using latin-1 encoding, | separators, etc).
        colnames_txt: the TXT file containing the list of column names.
        out_csv: the path where to store the output CSV file.
        fields: the list of fields to keep, separated by commas.
    """
    fieldnames = fields.split(',')
    all_job_offers = job_offers.iterate(
        in_csv, colnames_txt, required_fields=set(fieldnames + ['creation_date']))
    with open(out_csv, 'w') as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()
        for job_offer in all_job_offers:
            if job_offer.creation_date < min_creation_date:
                continue
            writer.writerow({field: getattr(job_offer, field) for field in fieldnames})


if __name__ == "__main__":
    trim_job_offers_csv(*sys.argv[1:])
