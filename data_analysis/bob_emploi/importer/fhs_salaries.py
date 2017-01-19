# encoding: utf-8
"""This script extracts salaries information from FHS.

It creates a simple CSV table that contains some kind of datacubes about
jobseekers that can then be used more easily than the very large FHS. The
datacube contains for each row a list of criteria for jobseekers (ROME job
group, département ID, gender, age bucket, salary bucket) and then the number
of jobseekers that have the same criteria.

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/importer/fhs_salaries.py \
        "data/pole_emploi/FHS/FHS*201512" \
        data/fhs_salaries.csv
"""
import collections
import csv
from os import path
import sys

from bob_emploi.lib import fhs
from bob_emploi.lib import migration_helpers

# Field in the FHS "de" table for the end date of the job request.
_END_DATE_FIELD = 'DATANN'

# Range of salaries for which we have the same size of buckets.
_BucketRange = collections.namedtuple(
    'BucketRange', [
        # The lower bound of the range for which the buckets are defined.
        'lower_bound',
        # The size of each bucket.
        'bucket_size'])

# Definition of ranges of salaries with increasing bucket sizes. When
# bucketizing salaries we want to have fine grain bucket for lower salaries and
# larger buckets for bigger ones. We do that by defining range of salaries in
# which we have constant size buckets.
#
# The definition below is done with some estimation of what should be
# interesting:
#  - make sure that range boundaries are never in the middle of the bucket
#    (just make sure that the boundary value is a multiple of the bucket sizes
#    in the range before and after the boundary),
#  - make sure that bucket sizes are growing,
#  - keep bucket size smaller than the approximation we would display for the
#    range of salaries,
#  - as a reminder the SMIC (minimum wage) is at 17600.
_SALARY_BUCKET_SIZES = [
    _BucketRange(lower_bound=0, bucket_size=100),
    _BucketRange(lower_bound=17600, bucket_size=200),
    _BucketRange(lower_bound=25000, bucket_size=500),
    _BucketRange(lower_bound=35000, bucket_size=1000),
    _BucketRange(lower_bound=50000, bucket_size=2000),
    _BucketRange(lower_bound=70000, bucket_size=5000),
    _BucketRange(lower_bound=100000, bucket_size=10000),
]


# TODO: Move to a library.
def _print_progress(value, total, bar_length=100):
    percent = round(value * 100 / total, 2)
    filled_length = int(percent * bar_length / 100)
    bar_ascii = '#' * filled_length + '-' * (bar_length - filled_length)

    sys.stdout.write('[%s] %s%%\r' % (bar_ascii, percent))
    if value == total:
        sys.stdout.write('\n')
    sys.stdout.flush()


def compute_annual_salary(amt, unit):
    """Compute annual salary from a (possibly non-annual) amount and unit."""
    try:
        amt = float(amt)
    except ValueError:
        amt = 0.0

    if unit == 'H':
        return amt * 52 * 35
    if unit == 'M':
        return amt * 12
    return amt


def bucketize_salary(de_dict):
    """Bucketize the salary of a job seeker.

    Args:
        de_dict: the dict directly pulled from FHS about a job seeker.

    Returns:
        two integers representing the lower and higher threshold of the bucket
        in which the job seeker's salary is. The amount are in euros per year
        before taxes.
    """
    amt = de_dict['SALMT']
    unit = de_dict['SALUNIT']
    salary = compute_annual_salary(amt, unit)

    if salary == 0:
        return 0, 0

    bucket_size = 0
    for salary_range in _SALARY_BUCKET_SIZES:
        if salary <= salary_range.lower_bound:
            break
        bucket_size = salary_range.bucket_size

    # Note the SMIC (minimal wage) is at 17600 in January 2016.
    bucket_lower = int(salary - salary % bucket_size)
    bucket_higher = bucket_lower + bucket_size
    return bucket_lower, bucket_higher


def job_seeker_criteria(de_dict):
    """Extract a limited set of criteria for a job seeker.

    Args:
        de_dict: the dict directly pulled from FHS about a job seeker.

    Returns:
        a tuple with the list of criteria for the job seeker.
    """
    salary_low, salary_high = bucketize_salary(de_dict)
    return (
        de_dict['ROME'],
        fhs.extract_departement_id(de_dict['DEPCOM']),
        de_dict['SALUNIT'],
        salary_low,
        salary_high)


def main(fhs_folder, csv_output, progress=_print_progress):
    """Extract the salaries information from FHS and bucketize them.

    In order to avoid issues about jobseekers being counted several times, we
    only consider salaries for jobseekers that are still unemployed at the time
    the FHS was sampled.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        csv_output: path to the file to write to.
    """
    # TODO: Factorize this code with fhs_job_frequency.

    # Check that the output file is writeable before starting the long process
    # of collecting data.
    with open(csv_output, 'w'):
        pass

    de_rows = migration_helpers.flatten_iterator(
        path.join(fhs_folder, '*/de_*.csv'))

    # Estimation of the total # of rows in the FHS "de" table.
    total = 7000001

    job_seeker_counts = collections.defaultdict(int)
    counted = 0
    for de_dict in de_rows:
        counted += 1
        if counted % 10000 == 0 and progress:
            progress(counted, total)
        # Discard historical job requests, only work on the ones that are still
        # open.
        if de_dict[_END_DATE_FIELD]:
            continue
        job_seeker_counts[job_seeker_criteria(de_dict)] += 1

    _print_progress(total, total)

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow((
            'code_rome',
            'departement_id',
            'salary_unit',
            'salary_low',
            'salary_high',
            'count'))
        for key, count in job_seeker_counts.items():
            writer.writerow(key + (count,))


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover
