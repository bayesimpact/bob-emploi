# encoding: utf-8
"""This script extracts unemployment durations of different categories from FHS.

Pôle Emploi categorizes job seekers in several categories (A, B, ... F). In
this script we focus on two different category groups:

* Category A, which is the one that matches the most common idea of a unemployed
job seeker: not working part time, not part of a training, no disabilities,
fully focused on their job search.
* Category ABC together, which we think will realistically what our users want
to get out of. They probably want to know the time until they become independent
of Pole Emploi.

It creates a simple CSV table that contains some kind of datacubes about
jobseekers that can then be used more easily than the very large FHS. The
datacube contains for each row a list of criteria for jobseekers (ROME job
group, département ID, gender, age bucket, salary bucket) and then the number
of jobseekers that have the same criteria.

There's another mode all-A where each row does not represent a job seeker, but
a contiguous period of time for which a job seeker was in category A
unemployment. As such a jobseeker might be represented by several rows.

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/importer/fhs_category_duration.py \
        "data/pole_emploi/FHS/FHS*201512" \
        2015-12-01 \
        ABC \
        data/fhs_category_abc_duration_motann.csv
"""
import collections
import csv
import datetime
import sys
import tqdm

from bob_emploi.lib import fhs

# TODO: Add tests.

_CollectionMode = collections.namedtuple('CollectionMode', ['categories', 'only_last'])
_MODES = {
    # Extract the last contiguous period for which a job seeker was in category A unemployment.
    'A': _CollectionMode(categories='A', only_last=True),
    # Extract the last contiguous period for which a job seeker was in one of
    # the unemployment categories A, B or C.
    'ABC': _CollectionMode(categories='ABC', only_last=True),
    # Extract all the contiguous periods of time for which job seekers stayed
    # in category A unemployment.
    'all-A': _CollectionMode(categories='A', only_last=False),
}


def job_seeker_rows(job_seeker, now, categories, only_last):
    """Extract a limited set of criteria for a job seeker.

    Args:
        job_seeker: a JobSeeker object.

    Returns:
        a tuple with the list of criteria for the job seeker.
    """
    # For each job seeker we only check their last unemployment period.
    if categories == 'ABC':
        category_periods = job_seeker.unemployment_abc_periods(
            cover_holes_up_to=27)
    elif categories == 'A':
        category_periods = job_seeker.unemployment_a_periods(
            cover_holes_up_to=27)
    category_periods.exclude_after(now, lambda m: dict(
        m, MOTANN=fhs.CancellationReason.NOW))

    if only_last:
        last_period = category_periods.last_contiguous_period()
        if last_period is None:
            return
        periods = [last_period]
    else:
        periods = category_periods

    for period in periods:
        state = period.metadata
        if state is None:
            return

        yield (
            state['ROME'],
            state['DEPCOM'],
            state['SEXE'],
            state['MOTINS'],
            state['MOTANN'],
            period.begin,
            period.end,
            period.duration_days(),
        )


_CRITERIA_HEADERS = (
    'code_rome',
    'city_id',
    'sex',
    'reason_begin',
    'reason_end',
    'begin_date',
    'end_date',
    'duration',
)


def main(fhs_folder, now, mode_name, csv_output):
    """Extract the salaries information from FHS and bucketize them.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        now: the date at which the FHS data was extracted, e.g. 2015-12-31.
        mode_name: the mode of extraction, see _MODES.
        csv_output: path to the file to write to.
    """
    if mode_name not in _MODES:
        raise ValueError('Unsupported mode: [%s], want one of [%s]' % (mode_name, _MODES.keys()))
    mode = _MODES[mode_name]
    now = datetime.datetime.strptime(now, '%Y-%m-%d').date()

    job_seekers = fhs.job_seeker_iterator(
        fhs_folder,
        (fhs.UNEMPLOYMENT_PERIOD_TABLE, fhs.PART_TIME_WORK_TABLE))

    # Estimation of the total # of job seekers in the FHS.
    total = 2522364

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_CRITERIA_HEADERS)
        for job_seeker in tqdm.tqdm(job_seekers, total=total):
            for row in job_seeker_rows(job_seeker, now, mode.categories, mode.only_last):
                writer.writerow(list(row))


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover
