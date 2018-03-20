"""This script extracts multiple job groups of jobseekers from FHS.

Pôle emploi categorizes job seekers in several categories (A, B, ... F). In
this script we focus on category ABC.

It creates a simple CSV table that can then be used more easily than the very large FHS.
Each row represents a contiguous period of time for which a job seeker was in category
ABC unemployment. However, only the first period and the later periods where a job seeker has
changed the job they were looking for are kept.
As such a jobseeker might be represented by several rows.
It provides a list of criteria for jobseekers (ROME job group, département ID, gender).

To create this dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/data_analysis/importer/fhs_job_mobility.py \
        "data/pole_emploi/FHS/FHS*201512" \
        2015-12-01 \
        data/fhs_job_mobility.csv
"""

import csv
import collections
import datetime
import sys
import tqdm

from bob_emploi.data_analysis.lib import fhs

# Jobseeker criteria provided per unemployment period.
_JobseekerCriteria = collections.namedtuple('JobseekerCriteria', [
    'jobseeker_id',
    'code_rome',
    'city_id',
    'gender'])


# TODO(marielaure): Add tests.
def job_seeker_rows(job_seeker, now):
    """Yields multiple rows per job seeker with several fields.

    Args:
        job_seeker: a JobSeeker object.

    Yields:
        a namedtuple with the list of criteria for the job seeker.
    """

    job_seeker_periods = job_seeker.get_rome_per_period(27, 'abc', now)
    previous_rome = ''
    for job_seeker in job_seeker_periods:

        if previous_rome == job_seeker.code_rome or not job_seeker.code_rome:
            continue
        previous_rome = job_seeker.code_rome
        yield _JobseekerCriteria(
            jobseeker_id=job_seeker.jobseeker_unique_id,
            code_rome=previous_rome,
            city_id=job_seeker.departement,
            gender=job_seeker.gender,
        )


def main(fhs_folder, now, csv_output):
    """Extract the job group history from FHS and deduplicate them.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        now: the date at which the FHS data was extracted, e.g. 2015-12-31.
        csv_output: path to the file to write to.
    """

    now = datetime.datetime.strptime(now, '%Y-%m-%d').date()

    job_seekers = fhs.job_seeker_iterator(
        fhs_folder,
        (fhs.UNEMPLOYMENT_PERIOD_TABLE, fhs.TARGETED_JOB_TABLE))

    # Estimation of the total # of job seekers in the FHS.
    total = 2522364

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_JobseekerCriteria._fields)
        for job_seeker in tqdm.tqdm(job_seekers, total=total):
            for row in job_seeker_rows(job_seeker, now):
                writer.writerow(row)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover; pylint: disable=no-value-for-parameter
