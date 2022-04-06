"""This script extracts salaries information from FHS.

It creates a simple CSV table that contains some kind of datacubes about
jobseekers that can then be used more easily than the very large FHS. The
datacube contains for each row a list of criteria for jobseekers (ROME job
group, département ID, gender, age bucket, salary bucket) and then the number
of jobseekers that have the same criteria.

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/data_analysis/importer/fhs_salaries.py \
        "data/pole_emploi/FHS/FHS*201512" \
        data/fhs_salaries.csv
"""

import collections
import csv
from os import path
import sys
import typing
from typing import Any, Tuple, Union

import tqdm

from bob_emploi.data_analysis.lib import fhs
from bob_emploi.data_analysis.lib import migration_helpers

# Field in the FHS "de" table for the end date of the job request.
_END_DATE_FIELD = fhs.CANCELATION_DATE_FIELD


# Range of salaries for which we have the same size of buckets.
class _BucketRange(typing.NamedTuple):
    # The lower bound of the range for which the buckets are defined.
    lower_bound: float
    # The size of each bucket.
    bucket_size: float


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


def compute_annual_salary(amt: Union[float, str], unit: str) -> float:
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


def bucketize_salary(de_dict: dict[str, Any]) -> Tuple[float, float]:
    """Bucketize the salary of a job seeker.

    Args:
        de_dict: the dict directly pulled from FHS about a job seeker.

    Returns:
        two integers representing the lower and higher threshold of the bucket
        in which the job seeker's salary is. The amount are in euros per year
        before taxes.
    """

    amt = de_dict[fhs.SALARY_AMOUNT_FIELD]
    unit = de_dict[fhs.SALARY_UNIT_FIELD]
    salary = compute_annual_salary(amt, unit)

    if salary == 0:
        return 0, 0

    bucket_size: float = 0
    for salary_range in _SALARY_BUCKET_SIZES:
        if salary <= salary_range.lower_bound:
            break
        bucket_size = salary_range.bucket_size

    # Note the SMIC (minimal wage) is at 17600 in January 2016.
    bucket_lower = int(salary - salary % bucket_size)
    bucket_higher = bucket_lower + bucket_size
    return bucket_lower, bucket_higher


class _JobSeekerBucket(typing.NamedTuple):
    code_rome: str
    departement_id: str
    salary_unit: str
    salary_low: float
    salary_high: float


def job_seeker_criteria(de_dict: dict[str, Any]) -> _JobSeekerBucket:
    """Extract a limited set of criteria for a job seeker.

    Args:
        de_dict: the dict directly pulled from FHS about a job seeker.

    Returns:
        a tuple with the list of criteria for the job seeker.
    """

    salary_low, salary_high = bucketize_salary(de_dict)
    return _JobSeekerBucket(
        de_dict[fhs.JOB_GROUP_ID_FIELD],
        fhs.extract_departement_id(de_dict[fhs.CITY_ID_FIELD]),
        de_dict[fhs.SALARY_UNIT_FIELD],
        salary_low,
        salary_high)


def main(fhs_folder: str, csv_output: str) -> None:
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
    with open(csv_output, 'w', encoding='utf-8'):
        pass

    de_rows = migration_helpers.flatten_iterator(
        path.join(fhs_folder, '*/de_*.csv'))

    # Estimation of the total # of rows in the FHS "de" table.
    total = 7000001

    job_seeker_counts: dict[_JobSeekerBucket, int] = collections.defaultdict(int)
    for de_dict in tqdm.tqdm(de_rows, total=total, file=sys.stdout):
        # Discard historical job requests, only work on the ones that are still
        # open.
        if de_dict[_END_DATE_FIELD]:
            continue
        job_seeker_counts[job_seeker_criteria(de_dict)] += 1

    with open(csv_output, 'w', encoding='utf-8') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_JobSeekerBucket._fields + ('count',))
        for key, count in job_seeker_counts.items():
            writer.writerow(key + (count,))


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
