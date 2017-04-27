# encoding: utf-8
"""Module for helpers to work with the FHS dataset."""
import collections
import datetime
from os import path
import re

from bob_emploi.lib import migration_helpers

# The tables in the FHS.

# The main FHS table with a row for each unemployment period. In French it's
# "Demande d'Emploi" (which means "Job Search") and is abbreviated as "de".
UNEMPLOYMENT_PERIOD_TABLE = 'de'

# A table containing number of hours worked in each month for job seekers that
# are partially working.
PART_TIME_WORK_TABLE = 'e0'

# A table containing historical values for the targeted job when this one
# change during one unemployment period.
TARGETED_JOB_TABLE = 'rome'


# The fields in FHS.

# Unique ID per job seeker: it can only be used as join key between tables as
# it is recreated on each export from Pôle Emploi data.
JOBSEEKER_ID_FIELD = 'IDX'

# Date at which a job seeker registered at Pôle Emploi.
REGISRATION_DATE_FIELD = 'DATINS'

# Reason the job seeker registered at Pôle Emploi. See RegistrationReason.
REGISTRATION_REASON_FIELD = 'MOTINS'

# Date at which the job seeker canceled their Pôle Emploi registration.
CANCELATION_DATE_FIELD = 'DATANN'

# Reason the job seeker canceled their Pôle Emploi registration. See
# CancellationReason.
CANCELATION_REASON_FIELD = 'MOTANN'

# Category of unemployment for a period.
PERIOD_CATEGORY_FIELD = 'CATREGR'

# INSEE ID of the city in which the job seeker is looking for a job.
CITY_ID_FIELD = 'DEPCOM'

# ID of the job group (ROME) of the job that the job seeker is looking for.
JOB_GROUP_ID_FIELD = 'ROME'

# ID of the job (ROME appelation) that the job seeker is looking for.
JOB_ID_FIELD = 'ROMEAPL'

# Month on which a job seeker worked partially.
PART_TIME_WORK_MONTH_FIELD = 'MOIS'

# Amount of the salary that the job seeker is looking for.
SALARY_AMOUNT_FIELD = 'SALMT'

# Unit for the salary in SALARY_AMOUNT_FIELD.
SALARY_UNIT_FIELD = 'SALUNIT'

# Gender of the job seeker.
GENDER_FIELD = 'SEXE'


# Regular expression to search the number of the region in an FHS filename.
# E.g. in "data/pole_emploi/FHS/FHS\ 201512/Reg27/de_201512_echant.csv",
# it isolates "27" as the first group.
_REGION_MATCHER = re.compile(r'/Reg(\d+)/')


def job_seeker_iterator(fhs_folder, tables=(UNEMPLOYMENT_PERIOD_TABLE,)):
    """Iterator on job seekers based of the FHS.

    This function assumes that the FHS has a specific structure:
     - all the data for a given jobseeker is in only one region,
     - in each region and each table, the data is sorted by job seeker's index
       (as an integer).

    See the design at http://go/pe:fhs-iterator

    Args:
        fhs_folder: path of the root folder of the FHS files.
        tables: list of tables to join.

    Yields:
        one dict per job seeker containing the IDX of the job_seeker and for
        each table a list of dict coming from this table. For instance, if
        tables is 'de', 'e0' the function will yield {'de': [...], 'e0': [...],
        'IDX': ...}
    """
    def _table_iterator(table):
        return PeekIterator(migration_helpers.flatten_iterator(
            path.join(fhs_folder, '*/%s_*.csv' % table)))
    iterators = {table: _table_iterator(table) for table in set(tables)}

    while any(not i.done for i in iterators.values()):
        # Find the next job seeker to process: look at all iterators that still
        # have data and pick the one that has the smallest key.
        key = min(
            job_seeker_key(i.peek())
            for i in iterators.values() if not i.done)
        job_seeker = {}
        for table, i in iterators.items():
            values = []
            while not i.done:
                current = i.peek()
                if job_seeker_key(current) != key:
                    break
                values.append(current)
                next(i)
            job_seeker[table] = values
        job_seeker[JOBSEEKER_ID_FIELD] = str(key.IDX)
        yield JobSeeker(job_seeker)


# A key representing a job seeker.
#
# The key has the following property:
#  - it's monotonically increasing when using flatten_iterator,
#  - it's valid for any job seeker FHS data table,
#  - it can be compared for equality across several FHS tables,
#  - it has an IDX field representing the unique index of the job seeker.
#
# The main benefit of this key compared to the raw IDX field is that it knows
# about the grouping by regions and make sure to keep increasing when going
# into a new region file (whereas the IDX would return to a very small number).
_JobSeekerKey = collections.namedtuple('JobSeekerKey', ['region', 'IDX'])


def job_seeker_key(row):
    """Compute the key from some job seeker's data."""
    return _JobSeekerKey(
        extract_region(row['__file__']), int(float(row[JOBSEEKER_ID_FIELD])))


def extract_region(filename):
    """Extract region from filename."""
    return _REGION_MATCHER.search(filename).group(1)


class PeekIterator(object):
    """An iterator that allows peeking on the next value without consuming it.

    It wraps an existing iterator and works exactly like it except that for the
    attribute done and the method peek.

    Attributes:
        done: whether the iteration is over and any further calls to next()
            will raise a StopIteration exception.
    """

    def __init__(self, iterator):
        self._iterator = iterator
        self.done = False
        self._pre_next()

    def __iter__(self):
        return self

    def peek(self):  # pylint: disable=invalid-name
        """Take a peek at the next value.

        Returns:
            the value that would be returned by next without consuming it.
        """
        if self.done:
            raise StopIteration()
        return self._next

    def __next__(self):
        """Works as the usual next() method for an iterator."""
        if self.done:
            raise StopIteration()
        latest = self._next
        self._pre_next()
        return latest

    def _pre_next(self):
        if self.done:
            return
        try:
            self._next = next(self._iterator)
        except StopIteration:
            self.done = True
            self._next = None


class JobSeeker(object):
    """A job seeker.

    This holds all the data we have about a job seeker in the FHS and helps get
    or compute properties that feels more natural.
    """

    def __init__(self, data):
        self._data = data
        self._data['de'].sort(key=lambda de: de[REGISRATION_DATE_FIELD])
        self._data.get('e0', []).sort(key=lambda e0: e0[PART_TIME_WORK_MONTH_FIELD])
        self._data.get('rome', []).sort(key=lambda rome: rome['JOURFV'])

    def _unemployment_periods(self, cover_holes_up_to, period_type):
        # Category A, B and C are defined by: CATREGR being 1, 2 or 3.

        # Find disjoint periods from "de" table which have CATREGR 1, 2, or 3.
        periods = DateIntervals([
            (de[REGISRATION_DATE_FIELD],
             de[CANCELATION_DATE_FIELD] if de[CANCELATION_DATE_FIELD] else None, de)
            for de in self._data[UNEMPLOYMENT_PERIOD_TABLE]
            if de[PERIOD_CATEGORY_FIELD] in {'1', '2', '3'}])

        if period_type == 'a':
            self._exclude_worked_months(periods)

        periods.cover_holes(
            datetime.timedelta(days=cover_holes_up_to),
            lambda m1, m2: dict(m2, **{
                REGISTRATION_REASON_FIELD: m1[REGISTRATION_REASON_FIELD],
                REGISRATION_DATE_FIELD: m1[REGISRATION_DATE_FIELD]}))

        return periods

    def unemployment_abc_periods(self, cover_holes_up_to=0):
        """Periods of category ABC unemployment for this job seeker.

        Args:
            cover_holes_up_to: consecutive unemployment periods with up to
                cover_holes_up_to days in between will be merged into a
                single unemployment period.

        Raises:
            KeyError: if the JobSeeker was created without "de" data.

        Returns:
            a DateIntervals object covering all dates for which we consider
            this job seeker was unemployed and classified by Pôle Emploi in
            category A, B or C. The metadata in this object are dictionaries
            coming from the "de" table and as such contain all the fields like
            DATINS, DATANN, MOTINS, MOTANN, CATREGR, etc.
        """
        return self._unemployment_periods(cover_holes_up_to, 'abc')

    def unemployment_a_periods(self, cover_holes_up_to=0):
        """Periods of category A unemployment for this job seeker.

        Args:
            cover_holes_up_to: consecutive unemployment periods with up to
                cover_holes_up_to days in between will be merged into a
                single unemployment period.

        Raises:
            KeyError: if the JobSeeker was created without "de" or "e0" data.

        Returns:
            a DateIntervals object covering all dates for which we consider
            this job seeker was unemployed and classified by Pôle Emploi in
            category A. The metadata in this object are dictionaries coming
            from the "de" table and as such contain all the fields like DATINS,
            DATANN, MOTINS, MOTANN, CATREGR, etc.
        """
        return self._unemployment_periods(cover_holes_up_to, 'a')

    def _exclude_worked_months(self, periods):
        """Exlude months where the job seeker worked at least one hour."""
        for work_time_month in self._data[PART_TIME_WORK_TABLE]:
            begin, end = _month_bounds(work_time_month[PART_TIME_WORK_MONTH_FIELD])
            periods.exclude_period(
                begin,
                end,
                lambda m: dict(m, **{
                    REGISTRATION_REASON_FIELD: RegistrationReason.END_OF_PART_TIME_WORK,
                    REGISRATION_DATE_FIELD: end}),  # pylint: disable=cell-var-from-loop
                lambda m: dict(m, **{
                    CANCELATION_REASON_FIELD: CancellationReason.STARTING_PART_TIME_WORK,
                    CANCELATION_DATE_FIELD: begin}),  # pylint: disable=cell-var-from-loop
            )

    def state_at_date(self, when):
        """Computes the state of the job seeker at a given date.

        Raises:
            KeyError: if the JobSeeker was created without "de" data.

        Returns:
            None if the job seeker wasn't unemployed at that date or a
                dictionary like the "de" table.
        """
        for period in self._data[UNEMPLOYMENT_PERIOD_TABLE]:
            if period[CANCELATION_DATE_FIELD] and period[CANCELATION_DATE_FIELD] <= when:
                continue
            if period[REGISRATION_DATE_FIELD] > when:
                return None
            # TODO: Handle updates of variables that have history in other
            # tables.
            return period


class RegistrationReason(object):
    """Class enumerating reason for job seeker registration.

    These are the possible values for MOTINS.
    """

    ECONOMIC_LAY_OFF = '1'
    OTHER_LAY_OFF = '2'
    RESIGNATION = '3'
    END_OF_CONTRACT = '4'
    END_OF_INTERIM_MISSION = '5'
    FIRST_ENTRY = '6'
    BACK_AFTER_LONG_INTERRUPTION = '7'
    OTHER = '8'
    END_OF_CONVERSION_CONVENTION = '9'
    ECONOMIC_LAY_OFF_PAP_ANTICIPE = 'Z'
    ENTERING_CRP_CTP = 'A'
    END_OF_CRP = 'B'
    BREACH_OF_CNE_BY_EMPLOYER = 'C'
    BREACH_OF_CNE_BY_EMPLOYEE = 'D'
    END_OF_INTERNSHIP = 'E'
    END_OF_NON_SALARIED_ACTIVITY = 'F'
    END_OF_SICK_OR_MATERNITY_LEAVE = 'G'
    CONTRACTUAL_TERMINATION = 'I'
    ENTERING_CTP_FOLLOWING_CRP = 'J'
    ENTERING_CSP = 'K'

    # Our own codes (make sure they do not exist above).
    END_OF_PART_TIME_WORK = 'Y'


# TODO(pascal): Rename to CancelationReason (US spelling).
class CancellationReason(object):
    """Class enumerating the reason for job seeker cancellation.

    These are the possible values of MOTANN.
    """
    BACK_TO_WORK = '01'
    ENTERING_TRAINING = '02'
    SICKNESS_OR_ACCIDENT = '03'
    JOB_SEARCH_EXEMPTION = '04'
    RETIRING = '05'
    CHANGE_ALE_ASSEDIC = '06'
    MILITARY_SERVICE = '07'
    OTHER_REASON_STOP_JOB_SEARCH = '08'
    ABSENCE_AT_CONTROL = '09'
    ADMINISTRATIVE_CANCELLATION = '10'
    OTHER_CANCELLATION = '11'
    OTHER = '12'
    ABSENCE_OF_FILE_UPDATE = '13'
    DUPLICATE = '14'
    SUBSIDIZED_CONTRACT = '15'
    CREATING_A_COMPANY = '16'

    # Our own codes (make sure they do not exist above).
    NOW = '90'
    STARTING_PART_TIME_WORK = '91'


class Period(object):
    """Defines a single contiguous period of time (whole days)."""

    def __init__(self, begin, end, metadata):
        """Initialize with begin/end dates (or string dates) and metadata."""
        if isinstance(begin, str):
            begin = datetime.datetime.strptime(begin, "%Y-%m-%d").date()
        if isinstance(end, str):
            end = datetime.datetime.strptime(end, "%Y-%m-%d").date()
        self.begin = begin
        self.end = end
        self.metadata = metadata
        self.as_tuple = (begin, end, metadata)

    def duration_days(self):
        """Return the length of the period in complete days."""
        if self.end and self.begin:
            return (self.end - self.begin).days
        return None

    def __lt__(self, other):
        return self.begin < other.begin

    def __eq__(self, other):
        return self.as_tuple == other.as_tuple

    def __repr__(self):
        return repr(self.as_tuple)


class DateIntervals(object):
    """Defines potentially non-contiguous periods of time."""

    # Period = collections.namedtuple('Period', ['begin', 'end', 'metadata'])

    def __init__(self, periods):
        """Initialize with a list of non-overlapping periods.

        Args:
            periods: a list of 3-tuple containing beginning (inclusive), end
            (exclusive) of each period as well as a dict of metadata fo this
            period. The end may be None, meaning that the period is not
            finished.


            The metadata is an object that is just attached to each period,
            when updating the periods (cutting, excluding, merging), you need
            to also explain how to update the metadata associated with the
            modified periods.
        """
        self._periods = sorted(Period(*p) for p in periods)

    def __iter__(self):
        for period in self._periods:
            yield period

    def __repr__(self):
        return repr(self._periods)

    def __eq__(self, other):
        return (
            isinstance(other, self.__class__) and
            self._periods == other._periods)  # pylint: disable=protected-access

    def last_contiguous_period(self):
        """Last contiguous period of time."""
        return self._periods[-1] if self._periods else None

    def is_unfinished(self):
        """Whether the intervals contain the future as well."""
        return self._periods and self._periods[-1].end is None

    def exclude_period(self, begin, end, metadata_cut_begin, metadata_cut_end):
        """Exclude a period from the existing interval.

        Note that the period to exclude can be completely unrelated to the
        existing contiguous existing periods of time: it might remove one or
        multiple of those, shorten them, or even break them in 2 contiguous
        periods if the exclusion happens to be in the middle of an existing
        period.

        Args:
            begin: the date of the first day to exclude.
            end: the date of the first day not to exclude.
            metadata_cut_begin: a function called when cutting the beginning of
                a period to update its metadata.
            metadata_cut_end: a function called when cutting the end of a
                period to udpate its metadata.
        """
        periods_before = [
            p for p in self._periods if p.end and p.end < begin]
        periods_after = [p for p in self._periods if p.begin > end]
        if len(periods_before) + len(periods_after) == len(self._periods):
            return

        affected_periods = self._periods[
            len(periods_before):len(self._periods) - len(periods_after)]
        modified_periods = []
        for period in affected_periods:
            if period.begin < begin:
                modified_periods.append(Period(
                    period.begin, begin, metadata_cut_end(period.metadata)))
            if period.end is None or end < period.end:
                modified_periods.append(Period(
                    end, period.end, metadata_cut_begin(period.metadata)))

        self._periods = periods_before + modified_periods + periods_after

    def exclude_after(self, date, update_metadata):
        """Exclude all dates after a given date."""
        periods = []
        for period in self._periods:
            if period.end and period.end <= date:
                periods.append(period)
            elif period.begin < date:
                periods.append(Period(
                    period.begin, date, update_metadata(period.metadata)))
        self._periods = periods

    def cover_holes(self, max_duration, merge_metadata):
        """Cover holes between contiguous periods.

        In order to ignore little gaps in the interval when using the
        last_contiguous_period method, that would break a very long
        almost-contiguous period even if one day is excluded in the middle, the
        cover_holes function find those little holes and include them in the
        interval.

        Args:
            max_duration: the maximum duration of holes to cover.
        """
        if not self._periods:
            return
        periods = []
        period = self._periods[0]
        for next_period in self._periods[1:]:
            if period.end + max_duration < next_period.begin:
                # The hole is too big.
                periods.append(period)
                period = next_period
                continue
            period = Period(
                period.begin, next_period.end,
                merge_metadata(period.metadata, next_period.metadata))
        periods.append(period)
        self._periods = periods


def _month_bounds(year_month):
    """Compute a month's bounds.

    Args:
        year_month: the month as YYYYMM e.g. 201605 is May 2016.

    Returns:
        A tuple with the first day of the month and the first day of the next
        month.
    """
    year = int(year_month[:4])
    month = int(year_month[4:])
    begin = datetime.date(year, month, 1)
    end = datetime.date(int(month / 12) + year, month % 12 + 1, 1)
    return (begin, end)


def extract_departement_id(depcom):
    """Extract the département ID from the DEPCOM field in FHS."""
    departement_id = depcom[:2]
    if departement_id == '97':
        return depcom[:3]
    return departement_id
