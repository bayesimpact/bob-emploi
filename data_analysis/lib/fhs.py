"""Module for helpers to work with the FHS dataset."""

import collections
import datetime
from os import path
import re
import typing

from bob_emploi.data_analysis.lib import migration_helpers

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

# A table containing historical values for the training programs that job seekers
# have followed.
TRAINING_TABLE = 'p2'


# The fields in FHS.

# Unique (inside a region) ID per job seeker: it can only be used as join key
# between tables as it is recreated on each export from Pôle Emploi data.
JOBSEEKER_ID_FIELD = 'IDX'

# The FHS is split in multiple regions: because multiple job seeker can have the
# same IDX but should be in different regions it can be distinguish them.
JOBSEEKER_REGION_FIELD = 'region'

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

# Date at which the job seeker made its job group change.
JOB_GROUP_START_DATE_FIELD = 'JOURDV'

# Date at which the job seeker made its job group change.
JOB_GROUP_END_DATE_FIELD = 'JOURFV'

# Date at which the job seeker starts a training.
TRAINING_START_DATE = 'P2DATDEB'

# Date at which the job seeker ends a training.
TRAINING_END_DATE = 'P2DATFIN'


# Regular expression to search the number of the region in an FHS filename.
# E.g. in "data/pole_emploi/FHS/FHS\ 201512/Reg27/de_201512_echant.csv",
# it isolates "27" as the first group.
_REGION_MATCHER = re.compile(r'/Reg(\d+)/')

# Jobseeker criteria provided per unemployment period.
_JobseekerCriteria = collections.namedtuple('JobseekerCriteria', [
    'jobseeker_unique_id',
    'code_rome',
    'departement',
    'gender'])


def job_seeker_iterator(
        fhs_folder: str, tables: typing.Iterable[str] = (UNEMPLOYMENT_PERIOD_TABLE,)) \
        -> typing.Iterator['JobSeeker']:
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

    def _table_iterator(table: str) -> PeekIterator[typing.Dict[str, str]]:
        return PeekIterator(migration_helpers.flatten_iterator(
            path.join(fhs_folder, '*/{}.csv'.format(table))))
    iterators = {table: _table_iterator(table) for table in set(tables)}

    while any(not i.done for i in iterators.values()):
        # Find the next job seeker to process: look at all iterators that still
        # have data and pick the one that has the smallest key.
        key = min(
            job_seeker_key(i.peek())
            for i in iterators.values() if not i.done)
        job_seeker: typing.Dict[str, typing.List[typing.Dict[str, str]]] = {}
        for table, i in iterators.items():
            values: typing.List[typing.Dict[str, str]] = []
            while not i.done:
                current = i.peek()
                if job_seeker_key(current) != key:
                    break
                values.append(current)
                next(i)
            job_seeker[table] = values
        yield JobSeeker(key.IDX, key.region, job_seeker)


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
class _JobSeekerKey(typing.NamedTuple):
    region: str
    IDX: int


def job_seeker_key(row: typing.Dict[str, str]) -> _JobSeekerKey:
    """Compute the key from some job seeker's data."""

    return _JobSeekerKey(
        extract_region(row['__file__']), int(float(row[JOBSEEKER_ID_FIELD])))


def extract_region(filename: str) -> str:
    """Extract region from filename."""

    match = _REGION_MATCHER.search(filename)
    assert match
    return match.group(1)


_T = typing.TypeVar('_T')


class PeekIterator(typing.Iterable[_T]):
    """An iterator that allows peeking on the next value without consuming it.

    It wraps an existing iterator and works exactly like it except that for the
    attribute done and the method peek.

    Attributes:
        done: whether the iteration is over and any further calls to next()
            will raise a StopIteration exception.
    """

    def __init__(self, iterator: typing.Iterator[_T]) -> None:
        self._iterator = iterator
        self.done = False
        self._next: _T
        self._pre_next()

    def __iter__(self) -> typing.Iterator[_T]:
        return self

    def peek(self) -> _T:  # pylint: disable=invalid-name
        """Take a peek at the next value.

        Returns:
            the value that would be returned by next without consuming it.
        """

        if self.done:
            raise StopIteration()
        return self._next

    def __next__(self) -> _T:
        """Works as the usual next() method for an iterator."""

        if self.done:
            raise StopIteration()
        latest = self._next
        self._pre_next()
        return latest

    def _pre_next(self) -> None:
        if self.done:
            return
        try:
            self._next = next(self._iterator)
        except StopIteration:
            self.done = True


class JobSeeker(object):
    """A job seeker.

    This holds all the data we have about a job seeker in the FHS and helps get
    or compute properties that feels more natural.
    """

    def __init__(
            self, job_seeker_id: int, region_id: str,
            data: typing.Dict[str, typing.List[typing.Dict[str, typing.Any]]]) \
            -> None:
        self._data = data
        self._job_seeker_id = job_seeker_id
        self._region_id = region_id
        self._data.get('de', []).sort(key=lambda de: de[REGISRATION_DATE_FIELD])
        self._data.get('e0', []).sort(key=lambda e0: e0[PART_TIME_WORK_MONTH_FIELD])
        self._data.get('rome', []).sort(key=lambda rome: rome['JOURFV'])
        self._data.get('p2', []).sort(key=lambda p2: p2[TRAINING_START_DATE])

    def _unemployment_periods(
            self, cover_holes_up_to: int, period_type: typing.Optional[str]) -> 'DateIntervals':
        # Category A, B and C are defined by: CATREGR being 1, 2 or 3.

        # Find disjoint periods from "de" table which have CATREGR 1, 2, or 3.
        periods = DateIntervals([
            (de[REGISRATION_DATE_FIELD],
             de[CANCELATION_DATE_FIELD] if de[CANCELATION_DATE_FIELD] else None, de)
            for de in self._data[UNEMPLOYMENT_PERIOD_TABLE]
            if not period_type or de[PERIOD_CATEGORY_FIELD] in {'1', '2', '3'}])

        if period_type == 'a':
            self._exclude_worked_months(periods)

        if cover_holes_up_to >= 0:
            periods.cover_holes(
                datetime.timedelta(days=cover_holes_up_to),
                lambda m1, m2: dict(m2, **{
                    REGISTRATION_REASON_FIELD: m1[REGISTRATION_REASON_FIELD],
                    REGISRATION_DATE_FIELD: m1[REGISRATION_DATE_FIELD]}))

        return periods

    def all_training_periods(self) -> 'DateIntervals':
        """Periods of training at Pôle emploi for this job seeker.

        Returns:
            a DateIntervals object covering all dates for which this job seeker
            was registered as in training by Pôle emploi.
            The metadata in this object are dictionaries
            coming from the "training" table and as such contain all the fields like
            FORMACOD, OBJFORM, P2NIVFOR, P2DATDEB, etc.
        """

        registration_periods = self._unemployment_periods(cover_holes_up_to=-1, period_type=None)
        training_periods = []
        for p2_record in self._data[TRAINING_TABLE]:
            last_registration_period = registration_periods.last_contiguous_period_before(
                p2_record[TRAINING_START_DATE])
            assert last_registration_period
            p2_record[JOB_GROUP_ID_FIELD] = last_registration_period.metadata[JOB_GROUP_ID_FIELD]
            p2_record[CITY_ID_FIELD] = last_registration_period.metadata[CITY_ID_FIELD]
            training_periods.append((
                p2_record[TRAINING_START_DATE],
                p2_record[TRAINING_END_DATE] if p2_record[TRAINING_END_DATE] else None,
                p2_record
            ))

        return DateIntervals(training_periods)

    def all_registration_periods(self, cover_holes_up_to: int = -1) -> 'DateIntervals':
        """Periods of registration at Pôle emploi for this job seeker.

        Args:
            cover_holes_up_to: consecutive unemployment periods with up to
                cover_holes_up_to days in between will be merged into a
                single unemployment period.
            period_type: Unemployment categories like category a, b or C.

        Raises:
            KeyError: if the JobSeeker was created without "de" data.

        Returns:
            a DateIntervals object covering all dates for which this job seeker
            was registered in Pôle emploi.
            The metadata in this object are dictionaries
            coming from the "de" table and as such contain all the fields like
            DATINS, DATANN, MOTINS, MOTANN, CATREGR, etc.
        """

        return self._unemployment_periods(cover_holes_up_to, period_type=None)

    def unemployment_abc_periods(self, cover_holes_up_to: int = 0) -> 'DateIntervals':
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

    def unemployment_a_periods(self, cover_holes_up_to: int = 0) -> 'DateIntervals':
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

    def _exclude_worked_months(self, periods: 'DateIntervals') -> None:
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

    def state_at_date(self, when: datetime.datetime) -> typing.Optional['_PeriodMetadata']:
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
        return None

    def get_rome_per_period(
            self, cover_holes_up_to: int, period_type: str, now: datetime.date) \
            -> typing.Iterator[_JobseekerCriteria]:
        """Get the job group, departement and gender at jobseeker's unemployment periods
            and periods when the jobseeker has changed the job group they were looking for.
            The periods are sorted by earliest ending.

        Yields:
            An object with job group, departement and gender.
            This job seeker was unemployed and classified by Pôle Emploi in
            categories defined by period_type. The metadata in this object are
            dictionaries coming from the "de" or the "rome" tables.
        """

        unemployment_periods = self._unemployment_periods(cover_holes_up_to, period_type)
        unemployment_periods.exclude_after(now, lambda m: dict(m, MOTANN=CancellationReason.NOW))
        job_group_history = self._data[TARGETED_JOB_TABLE]
        for unemployment_period in unemployment_periods:
            periods_including_changes: typing.List[Period] = []
            state = unemployment_period.metadata
            if job_group_history:
                for change in self._data[TARGETED_JOB_TABLE]:
                    change_period = Period(
                        change[JOB_GROUP_START_DATE_FIELD],
                        change[JOB_GROUP_END_DATE_FIELD],
                        change)
                    if change_period.touches(unemployment_period):
                        periods_including_changes.append(change_period)
            periods_including_changes.append(unemployment_period)
            for period in sorted(periods_including_changes, key=lambda p: p.end):
                state = period.metadata
                jobseeker_unique_id = self.get_unique_id()
                yield _JobseekerCriteria(
                    jobseeker_unique_id=jobseeker_unique_id,
                    code_rome=state[JOB_GROUP_ID_FIELD],
                    departement=state.get(CITY_ID_FIELD),
                    gender=state.get(GENDER_FIELD))

    def get_unique_id(self) -> str:
        """Returns an unique ID for this jobseeker."""

        return '{}_{}'.format(self._job_seeker_id, self._region_id)


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


_PeriodMetadata = typing.Dict[str, typing.Any]


class Period(object):
    """Defines a single contiguous period of time (whole days)."""

    def __init__(
            self, begin: typing.Union[str, datetime.date, None],
            end: typing.Union[str, datetime.date, None], metadata: _PeriodMetadata):
        """Initialize with begin/end dates (or string dates) and metadata."""

        self.begin: typing.Optional[datetime.date]
        self.end: typing.Optional[datetime.date]

        if isinstance(begin, str):
            self.begin = datetime.datetime.strptime(begin, '%Y-%m-%d').date()
        else:
            self.begin = begin

        if isinstance(end, str):
            self.end = datetime.datetime.strptime(end, '%Y-%m-%d').date()
        else:
            self.end = end

        self.metadata = metadata
        self.as_tuple = (self.begin, self.end, metadata)

    def duration_days(self) -> typing.Optional[int]:
        """Return the length of the period in complete days."""

        if self.end and self.begin:
            return (self.end - self.begin).days
        return None

    def __lt__(self, other: 'Period') -> bool:
        if other.begin is None:
            return False
        if self.begin is None:
            return True
        return self.begin < other.begin

    def __eq__(self, other: typing.Any) -> bool:
        return isinstance(other, Period) and self.as_tuple == other.as_tuple

    def touches(self, other: 'Period') -> bool:
        """Check if another period touches this one."""

        if self.begin and other.end and self.begin > other.end:
            return False
        if other.begin and self.end and other.begin > self.end:
            return False
        return True

    def __repr__(self) -> str:
        return repr(self.as_tuple)


class DateIntervals(object):
    """Defines potentially non-contiguous periods of time."""

    def __init__(self, periods: typing.Iterable[typing.Tuple[
            typing.Union[str, datetime.date, None],
            typing.Union[str, datetime.date, None],
            _PeriodMetadata,
    ]]) -> None:
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

    def __iter__(self) -> typing.Iterator[Period]:
        for period in self._periods:
            yield period

    def __repr__(self) -> str:
        return repr(self._periods)

    def __eq__(self, other: typing.Any) -> bool:
        return (
            isinstance(other, self.__class__) and
            self._periods == other._periods)  # pylint: disable=protected-access

    def first_contiguous_period(self) -> typing.Optional[Period]:
        """First contiguous period of time."""

        return self._periods[0] if self._periods else None

    def last_contiguous_period(self) -> typing.Optional[Period]:
        """Last contiguous period of time."""

        return self._periods[-1] if self._periods else None

    def last_contiguous_period_before(self, begin: datetime.date) -> typing.Optional[Period]:
        """Last contiguous period of time before a given date."""

        periods_before = [p for p in self._periods if p.end and p.end < begin]
        return periods_before[-1] if periods_before else None

    def is_unfinished(self) -> bool:
        """Whether the intervals contain the future as well."""

        return bool(self._periods) and self._periods[-1].end is None

    def exclude_period(
            self, begin: datetime.date, end: datetime.date,
            metadata_cut_begin: typing.Callable[[_PeriodMetadata], _PeriodMetadata],
            metadata_cut_end: typing.Callable[[_PeriodMetadata], _PeriodMetadata]) -> None:
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
        periods_after = [p for p in self._periods if p.begin and p.begin > end]
        if len(periods_before) + len(periods_after) == len(self._periods):
            return

        affected_periods = self._periods[
            len(periods_before):len(self._periods) - len(periods_after)]
        modified_periods = []
        for period in affected_periods:
            if period.begin is None or period.begin < begin:
                modified_periods.append(Period(
                    period.begin, begin, metadata_cut_end(period.metadata)))
            if period.end is None or end < period.end:
                modified_periods.append(Period(
                    end, period.end, metadata_cut_begin(period.metadata)))

        self._periods = periods_before + modified_periods + periods_after

    def exclude_after(
            self, date: datetime.date,
            update_metadata: typing.Callable[[_PeriodMetadata], _PeriodMetadata]) -> None:
        """Exclude all dates after a given date."""

        periods = []
        for period in self._periods:
            if period.end and period.end <= date:
                periods.append(period)
            elif period.begin and period.begin < date:
                periods.append(Period(
                    period.begin, date, update_metadata(period.metadata)))
        self._periods = periods

    def cover_holes(
            self, max_duration: datetime.timedelta,
            merge_metadata: typing.Callable[[_PeriodMetadata, _PeriodMetadata], _PeriodMetadata]) \
            -> None:
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
            assert period.end
            assert next_period.begin
            if (period.end + max_duration) < next_period.begin:
                # The hole is too big.
                periods.append(period)
                period = next_period
                continue
            period = Period(
                period.begin, next_period.end,
                merge_metadata(period.metadata, next_period.metadata))
        periods.append(period)
        self._periods = periods


def _month_bounds(year_month: str) -> typing.Tuple[datetime.date, datetime.date]:
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


def extract_departement_id(depcom: str) -> str:
    """Extract the département ID from the DEPCOM field in FHS."""

    departement_id = depcom[:2]
    if departement_id == '97':
        return depcom[:3]
    return departement_id
