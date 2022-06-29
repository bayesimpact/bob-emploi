"""Module for helpers to work with the Job Offers dataset."""

import codecs
import collections
import csv
import logging
import sys
from typing import AbstractSet, Iterator, Optional, Tuple

import pandas as pd


def double_property_frequency(job_offers: pd.DataFrame, column: str, req_column: str) \
        -> pd.DataFrame:
    """List one property and their frequency.

    Job offers contain many properties that are doubled (degree, driving
    licence, language proficiency). This function gets the frequency of a
    property in the list of job offers provided.

    Args:
        job_offers: The job offers to consider as a DataFrame.
        column: Name of the column containing the property. As it's a double
            property the column names are actually this name with "_1" and "_2"
            suffixes.
        req_column: Name of the column containing 'E' if the property is
            required.
    Returns:
        A DataFrame with the frequency and the frequency of required indexed by
        property name.
    """

    field_1 = column + '_1'
    field_2 = column + '_2'
    required_1 = job_offers[req_column + '_1'] == 'E'
    required_2 = job_offers[req_column + '_2'] == 'E'
    same = job_offers[field_1] == job_offers[field_2]
    counts = pd.DataFrame({
        'field_1': job_offers[field_1].value_counts(),
        'field_2': job_offers[field_2].value_counts(),
        'intersection': job_offers[same][field_1].value_counts(),
        'required_1': job_offers[required_1][field_1].value_counts(),
        'required_2': job_offers[required_2][field_2].value_counts(),
        'required_intersection':
            job_offers[required_1 & required_2 & same][field_1].value_counts(),
    }).fillna(0)
    frequencies = pd.DataFrame({
        'frequency': counts.field_1 + counts.field_2 - counts.intersection,
        'required_frequency':
            counts.required_1 + counts.required_2 -
            counts.required_intersection,
    }) / len(job_offers)
    frequencies.index.name = column
    return frequencies.sort_values('frequency', ascending=False)


class _JobOffer(Tuple[Optional[str], ...]):
    """Typing stub for the result of iterate."""

    def __getattr__(self, unused_name: str) -> Optional[str]:
        """Access a field of the job offer."""


def iterate(
        job_offers_csv: str, colnames_txt: str,
        required_fields: Optional[AbstractSet[str]] = None) \
        -> Iterator[_JobOffer]:
    """Iterate on all job offers lazily.

    Args:
        job_offers_csv: The CSV containing all job offers.
        colnames_txt: A txt file containing the name of the CSV's columns (one
            by line).
        required_fields: the set of fields that should exist in the CSV file.

    Yields:
        A named tuple representing a job offer.

    Raises:
        ValueError: if the column names do not include one of the required
            fields.
    """

    with open(colnames_txt, encoding='utf-8') as colnames_lines:
        column_names = [line.strip() for line in colnames_lines]
    if required_fields and not required_fields < set(column_names):
        raise ValueError(f'Required fields are missing: {required_fields - set(column_names)}')
    min_num_required_fields = -1
    if required_fields:
        for field in required_fields:
            field_index = column_names.index(field)
            if field_index + 1 > min_num_required_fields:
                min_num_required_fields = field_index + 1
    job_offer_type = collections.namedtuple('JobOffer', column_names)  # type: ignore
    with codecs.open(job_offers_csv, encoding='latin-1') as job_offers_file:
        # The CSV file has some very long fields.
        csv.field_size_limit(sys.maxsize)
        job_offers_rows = csv.reader(
            job_offers_file, delimiter='|', escapechar='\\',
            quoting=csv.QUOTE_NONE)
        for row in job_offers_rows:
            if len(row) != len(column_names):
                logging.warning('A line does not contain enough values:\n%s', row)
                if required_fields and min_num_required_fields < len(row):
                    row = row + [None] * (len(column_names) - len(row))  # type: ignore
                else:
                    logging.warning('Skipping this line')
                    continue
            yield job_offer_type(*row)  # type: ignore
