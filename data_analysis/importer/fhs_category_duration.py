"""This script extracts unemployment durations of different categories from FHS.

Pôle emploi categorizes job seekers in several categories (A, B, ... F). In
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
group, département ID, gender, subscription or unsubscription reasons).

There's another mode all-A where each row does not represent
a job seeker, but a contiguous period of time for which a job seeker was in
category A unemployment. As such a jobseeker might be represented by several rows.

The mode first-A extracts only the first contiguous period for which a job was in
Category A.

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/data_analysis/importer/fhs_category_duration.py \
        "data/pole_emploi/FHS/FHS*201512" \
        2015-12-01 \
        ABC \
        data/fhs_category_abc_duration_motann.csv
"""

import csv
import datetime
import sys
import typing
from typing import Iterable, Iterator, Optional, Union

import tqdm

from bob_emploi.data_analysis.lib import fhs

# TODO: Add tests.


class _CollectionMode(typing.NamedTuple):
    categories: str
    only_one: Union[bool, str]


_MODES = {
    # Extract the last contiguous period for which a job seeker was in category A unemployment.
    'A': _CollectionMode(categories='A', only_one='last'),
    # Extract the last contiguous period for which a job seeker was in one of
    # the unemployment categories A, B or C.
    'ABC': _CollectionMode(categories='ABC', only_one='last'),
    # Extract all the contiguous periods of time for which job seekers stayed
    # in category A unemployment.
    'all-A': _CollectionMode(categories='A', only_one=False),
    # Extract the first contiguous period for which a job seeker was in
    # category A unemployment.
    'first-A': _CollectionMode(categories='A', only_one='first'),
    # Extract all the periods of registration at Pôle emploi for all job seekers.
    'all': _CollectionMode(categories='all', only_one=False),
}


class _Criteria(typing.NamedTuple):
    jobseeker_id: str
    code_rome: Optional[str]
    city_id: Optional[str]
    sex: Optional[str]
    reason_begin: str
    reason_end: str
    begin_date: Optional[datetime.date]
    end_date: Optional[datetime.date]
    duration: Optional[int]


def job_seeker_rows(
        job_seeker: fhs.JobSeeker, now: datetime.date, categories: str,
        only_one: Union[bool, str]) \
        -> Iterator[_Criteria]:
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
    elif categories == 'all':
        category_periods = job_seeker.all_registration_periods()
    else:
        raise ValueError(f'Unknown categories type: "{categories}"')

    category_periods.exclude_after(now, lambda m: dict(
        m, MOTANN=fhs.CancellationReason.NOW))

    periods: Iterable[fhs.Period]

    if only_one == 'last':
        last_period = category_periods.last_contiguous_period()
        if last_period is None:
            return
        periods = [last_period]
    elif only_one == 'first':
        first_period = category_periods.first_contiguous_period()
        if first_period is None:
            return
        periods = [first_period]
    else:
        periods = category_periods

    for period in periods:
        state = period.metadata
        if state is None:
            return

        yield _Criteria(
            job_seeker.get_unique_id(),
            state[fhs.JOB_GROUP_ID_FIELD],
            state[fhs.CITY_ID_FIELD],
            state[fhs.GENDER_FIELD],
            state[fhs.REGISTRATION_REASON_FIELD],
            state[fhs.CANCELATION_REASON_FIELD],
            period.begin,
            period.end,
            period.duration_days(),
        )


def main(fhs_folder: str, now: str, mode_name: str, csv_output: str) -> None:
    """Extract the unemployment duration information from FHS.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        now: the date at which the FHS data was extracted, e.g. 2015-12-31.
        mode_name: the mode of extraction, see _MODES.
        csv_output: path to the file to write to.
    """

    if mode_name not in _MODES:
        raise ValueError(f'Unsupported mode: [{mode_name}], want one of [{_MODES.keys()}]')
    mode = _MODES[mode_name]
    now_as_date = datetime.datetime.strptime(now, '%Y-%m-%d').date()

    job_seekers = fhs.job_seeker_iterator(
        fhs_folder,
        (fhs.UNEMPLOYMENT_PERIOD_TABLE, fhs.PART_TIME_WORK_TABLE))

    # Estimation of the total # of job seekers in the FHS 2017.
    total = 2478287

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_Criteria._fields)
        for job_seeker in tqdm.tqdm(job_seekers, total=total):
            for row in job_seeker_rows(job_seeker, now_as_date, mode.categories, mode.only_one):
                writer.writerow(row)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
