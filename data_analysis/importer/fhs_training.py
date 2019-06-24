"""This script extracts training done by job seeker from FHS.

Pôle emploi categorizes job seekers in several categories (A, B, ... F). In
this script we focus on category ABC.

It creates a simple CSV table that can then be used more easily than the very large FHS.
Each row represents a contiguous period of time for which a job seeker was in category
ABC unemployment. For each job seeker only the last period of unemployment is kept and every
training period is extracted.
As such a jobseeker and a same unemployment period might be represented by several rows.
It provides a list of criteria for jobseekers (ROME job group, département ID, gender...) and their
training (beginning and ending dates, degree level...).

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/data_analysis/importer/fhs_training.py \
        "data/pole_emploi/FHS/FHS*201712" \
        2017-12-01 \
        data/fhs_training.csv
"""

import csv
import datetime
import sys
import typing

import tqdm

from bob_emploi.data_analysis.lib import fhs


# Jobseeker criteria provided per training period.
class _JobseekerCriteria(typing.NamedTuple):
    jobseeker_id: str
    code_rome: str
    city_id: typing.Optional[str]
    gender: typing.Optional[str]
    degree: str
    unemployment_duration: typing.Optional[int]
    unemployment_begin_date: typing.Optional[datetime.date]
    unemployment_end_date: typing.Optional[datetime.date]
    num_training: int
    training_info: str
    training_objective: str
    training_level: str
    training_begin_date: str
    training_end_date: str


# TODO(marielaure): Add tests.
def job_seeker_rows(job_seeker: fhs.JobSeeker, now: datetime.date) \
        -> typing.Iterator[_JobseekerCriteria]:
    """Yields multiple rows per job seeker with several fields.

    Args:
        job_seeker: a JobSeeker object.

    Yields:
        a namedtuple with the list of criteria for the job seeker.
    """

    category_periods = job_seeker.all_registration_periods()
    category_periods.exclude_after(now, lambda m: dict(
        m, MOTANN=fhs.CancellationReason.NOW))
    period = category_periods.last_contiguous_period()
    if not period:
        return
    state = period.metadata
    if state is None:
        return

    trainings = job_seeker.all_training_periods()
    if not trainings:
        yield _JobseekerCriteria(
            jobseeker_id=job_seeker.get_unique_id(),
            code_rome=state[fhs.JOB_GROUP_ID_FIELD],
            city_id=state.get(fhs.CITY_ID_FIELD, ''),
            gender=state.get(fhs.GENDER_FIELD, ''),
            degree=state['NIVFOR'],
            unemployment_duration=period.duration_days(),
            unemployment_begin_date=period.begin,
            unemployment_end_date=period.end,
            num_training=0,
            training_info='',
            training_objective='',
            training_level='',
            training_begin_date='',
            training_end_date='',
        )
        return
    for training in trainings:
        yield _JobseekerCriteria(
            jobseeker_id=job_seeker.get_unique_id(),
            code_rome=state[fhs.JOB_GROUP_ID_FIELD],
            city_id=state.get(fhs.CITY_ID_FIELD),
            gender=state.get(fhs.GENDER_FIELD),
            degree=state['NIVFOR'],
            unemployment_duration=period.duration_days(),
            unemployment_begin_date=period.begin,
            unemployment_end_date=period.end,
            num_training=len(trainings),
            training_info=training.metadata.get('FORMACOD', ''),
            training_objective=training.metadata.get('OBJFORM', ''),
            training_level=training.metadata.get('P2NIVFOR', ''),
            training_begin_date=training.metadata.get('P2DATDEB', ''),
            training_end_date=training.metadata.get('P2DATFIN', ''),
        )


def main(fhs_folder: str, now: str, csv_output: str) -> None:
    """Extract the training history from FHS.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        now: the date at which the FHS data was extracted, e.g. 2017-12-31.
        csv_output: path to the file to write to.
    """

    now_date = datetime.datetime.strptime(now, '%Y-%m-%d').date()

    job_seekers = fhs.job_seeker_iterator(
        fhs_folder,
        (fhs.UNEMPLOYMENT_PERIOD_TABLE, fhs.TARGETED_JOB_TABLE, fhs.TRAINING_TABLE))

    # Estimation of the total # of job seekers in the FHS.
    total = 2522364

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_JobseekerCriteria._fields)
        for job_seeker in tqdm.tqdm(job_seekers, total=total):
            for row in job_seeker_rows(job_seeker, now_date):
                writer.writerow(row)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
