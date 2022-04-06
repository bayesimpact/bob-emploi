"""Importer for local market information for a given area to MongoDB."""

import locale
import math
import typing
from typing import Any

import pandas

from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.lib import uk_cleaned_data
from bob_emploi.frontend.api import job_pb2

# TODO(cyrille): Generate these types from protobuf.
_RelatedJobGroup = dict[str, Any]


def _isnan(value: Any) -> bool:
    """Check whether a Python value is numpy's NaN."""

    return isinstance(value, float) and math.isnan(value)


def _get_single_salary_detail(median_salary: float) -> dict[str, Any]:
    if _isnan(median_salary):
        return {}
    median_salary_text = locale.format_string('%d', median_salary, grouping=True)
    short_text = f'Around £\xa0{median_salary_text}'
    return {
        'medianSalary': median_salary,
        'shortText': short_text,
        'unit': job_pb2.SalaryUnit.Name(job_pb2.ANNUAL_GROSS_SALARY),
    }


def _make_related_job_group(salaries: pandas.Series) -> _RelatedJobGroup:
    # TODO(cyrille): Add relevant info.
    return {
        'jobGroup': {'romeId': salaries.Code},
        'localStats': {
            'salary': _get_single_salary_detail(salaries.Median_salary),
        },
    }


def _get_salaries_by_region(salaries: pandas.Series) -> pandas.Series:
    return list(salaries.apply(_make_related_job_group, axis='columns'))


def csv2dicts(
        *, salaries_by_region_2020_xlsx: str, wards_ons_csv: str,
        geonames_txt: str, geonames_admin_txt: str) -> list[dict[str, Any]]:
    """Export data for the main app."""

    locale.setlocale(locale.LC_ALL, 'en_GB.UTF-8')

    salaries = uk_cleaned_data.get_salaries(
        salary_filename=salaries_by_region_2020_xlsx,
        wards_ons_csv=wards_ons_csv, geonames_txt=geonames_txt,
        geonames_admin_txt=geonames_admin_txt).reset_index()

    area_best_jobs = salaries.dropna(axis='index', subset=['Median_salary']).sort_values(
        by='Median_salary', ascending=False).groupby('Area').apply(
            _get_salaries_by_region).to_frame('bestSalariesJobs')

    areas = area_best_jobs.reset_index().rename({'Area': '_id'}, axis=1)

    return typing.cast(list[dict[str, Any]], areas.to_dict('records'))


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'best_jobs_in_area')
