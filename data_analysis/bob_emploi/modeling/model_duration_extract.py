# encoding: utf-8
"""Extract features for modelling unemployment duration.

Specifically, we use FHS data to predict the time for a category A
jobseeker to go off unemployment. This file is for extracting features.

The output is a CSV file with one row per unemployment stint
(so there may be multiple rows per job seeker). The features can be
seen in the _FEATURE_NAMES object.

NOTE: This does not impute missing values. We leave that choice up
to the modelling code. It does, however, sanitize values (e.g.
setting unreasonable values to None, or clipping them to a range).

See Makefile for example command.
"""
import collections
import csv
import datetime
import sys

import numpy as np

from bob_emploi.importer import fhs_salaries
from bob_emploi.lib import fhs


MIN_AGE = 16
MAX_AGE = 100
MIN_SALARY = 10000
MAX_SALARY = 200000
# TODO: Add tests.


# TODO: Move to a library.
def _print_progress(value, total, bar_length=100):
    percent = round(value * 100 / total, 2)
    filled_length = int(percent * bar_length / 100)
    bar_ascii = '#' * filled_length + '-' * (bar_length - filled_length)

    sys.stdout.write('[%s] %s%%\r' % (bar_ascii, percent))
    if value == total:
        sys.stdout.write('\n')
    sys.stdout.flush()


def _parse_date(date_str):
    """Parse a date string of the form YYYY-MM-DD to datetime.date."""
    return datetime.datetime.strptime(date_str, '%Y-%m-%d').date()


def compute_mobility_minutes(unit, distance):
    """Compute the length of time the jobseeker is willing to commute.

    In here we assume that a jobseeker travels with 60km/h => 1km/m. Therefore
    we can treat the KM and MN unit the same and only have to convert
    values where the unit is H.
    """
    if unit not in ('KM', 'MN', 'H'):
        return None
    try:
        distance = max(0, float(distance))
        if distance == 0:
            return None
    except ValueError:
        return None
    if unit == 'H':
        return distance * 60
    return distance


def compute_jobseeker_features_row(period, now):
    """Compute a feature row for an unemployment period."""
    state = period.metadata

    # Just drop people for whom we have no desired job code
    if state['ROME'] is None or state['ROME'] == '':
        return None

    # Compute age at enrollment
    birth_date = _parse_date(state['datnais'])
    age = int(np.floor((period.begin - birth_date).days / 365.25))
    if age < MIN_AGE or age >= MAX_AGE:
        # Ignore the few jobseekers have extreme ages - these are likely
        # data entry errors, and we don't really want to impute age.
        return None

    # Extreme salary values are usually data entry errors. We don't
    # try to correct them, we simply mark them as NA and impute them
    # later.
    salary = round(fhs_salaries.compute_annual_salary(
        state['SALMT'], state['SALUNIT']))
    if salary < MIN_SALARY or salary >= MAX_SALARY:
        salary = None

    # Extract location data
    region = fhs.extract_region(state['__file__'])
    dept = fhs.extract_departement_id(state['DEPCOM'])
    city = state['DEPCOM']

    # Mobility features
    if state['MOBUNIT'] == 'FE':
        mobility_all_france = True
        mobility_minutes = None
    else:
        mobility_all_france = False
        mobility_minutes = compute_mobility_minutes(
            state['MOBUNIT'], state['MOBDIST'])

    return _UnemploymentDurationFeatures(
        job_desired_rome=state['ROME'],
        location_region_id=region,
        location_department_id=dept,
        location_city_id=city,
        age=age,
        sex_male=int(state['SEXE'] == '1'),
        num_children=state['NENF'],
        mobility_minutes=mobility_minutes,
        mobility_all_france=int(mobility_all_france),
        salary_annual_desired=salary,
        begin_date=period.begin,
        ongoing=int(period.end == now),
        duration_days=period.duration_days()
    )


def compute_job_seeker_features(job_seeker, now, categories):
    """Extract features for each unemployment period of this jobseeker.

    Sometimes jobseekers accidentally forget to file their paperwork
    and may have a month where they look employed but are not. To catch
    this, we patch over any 'employment' period of 32 days or less.
    We use a 32-day period since often jobseekers unenroll at the end
    of a month and re-enroll on the first of the month. So if there is an
    accidental month off, there might be as many as 32 days of "employment"
    that we want to treat like a continuous unemployment period.

    See data_analysis/notebooks/datasets/
        FHS Explore Unemployment Duration and Frequency.ipynb

    Args:
        job_seeker: a JobSeeker object.
        now: the "current" date, beyond which enrollment periods
             should be clipped.
        categories: either 'A' or 'ABC'

    Returns:
        Generator of tuples, each with the features for an unemployment period.
    """
    if categories == 'ABC':
        category_periods = job_seeker.unemployment_abc_periods(
            cover_holes_up_to=32)
    if categories == 'A':
        category_periods = job_seeker.unemployment_a_periods(
            cover_holes_up_to=32)
    category_periods.exclude_after(now, lambda m: dict(
        m, MOTANN=fhs.CancellationReason.NOW))

    for period in category_periods:
        if period.begin < _IGNORE_ENROLLMENTS_BEFORE:
            continue
        if period.metadata is None:
            continue
        features = compute_jobseeker_features_row(period, now)
        if features is not None:
            yield features


_FEATURE_NAMES = (
    'job_desired_rome',
    'location_region_id',
    'location_department_id',
    'location_city_id',
    'age',
    'sex_male',
    'num_children',
    'mobility_minutes',
    'mobility_all_france',
    'salary_annual_desired',
    'begin_date',
    'ongoing',
    'duration_days'
)
_UnemploymentDurationFeatures = collections.namedtuple(
    'UnemploymentDurationFeatures', _FEATURE_NAMES)


# We don't trust unemployment periods that begin before this date.
# See data_analysis/notebooks/datasets/
#     FHS Explore Unemployment Duration and Frequency.ipynb
_IGNORE_ENROLLMENTS_BEFORE = datetime.date(2005, 6, 1)


def main(fhs_folder, now, categories, csv_output, progress=_print_progress):
    """Extract unemployment duration information and save it as a CSV.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        now: the date at which the FHS data was extracted, e.g. 2015-12-31.
        category: the unemployment categories considered as unemployment.
        csv_output: path to the file to write to.
    """
    if categories not in {'ABC', 'A'}:
        raise ValueError('Unsupported category combination: [%s]' % categories)
    now = _parse_date(now)

    job_seekers = fhs.job_seeker_iterator(
        fhs_folder,
        (fhs.UNEMPLOYMENT_PERIOD_TABLE, fhs.PART_TIME_WORK_TABLE))

    # Estimation of the total # of job seekers in the FHS.
    # TODO: Move this constant to fhs.py.
    total = 2510001
    counted = 0

    with open(csv_output, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(_FEATURE_NAMES)
        for job_seeker in job_seekers:
            counted += 1
            if counted % 10000 == 0 and progress:
                progress(counted, total)
            rows = compute_job_seeker_features(job_seeker, now, categories)
            for period_features in rows:
                writer.writerow(list(period_features))

    _print_progress(total, total)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover
