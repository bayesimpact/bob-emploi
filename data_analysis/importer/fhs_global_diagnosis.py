"""Import FHS stats as global diagnosis on MongoDB.

To create the input CSV, run:

`run --rm data-analysis-prepare make data/fhs_category_abc_duration.csv`

You can try it out on a local instance:
 - Start your local environment with `docker-compose up frontend-dev`.
 - Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/fhs_global_diagnosis.py \
        --durations_csv data/fhs_category_abc_duration.csv
"""

import locale
import typing
from typing import Any

import numpy
import pandas

from bob_emploi.data_analysis.lib import importer_helpers
from bob_emploi.data_analysis.lib import mongo

# Average number of days per month.
_BIN_WIDTH = importer_helpers.DAYS_PER_MONTH
locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')


class _NumpyHistogramFunc(typing.Protocol):

    def __call__(self, a: pandas.Series, bins: int = 0) -> pandas.Series:  # pylint: disable=invalid-name
        ...


# TODO(pascal): Fix the upstream type.
_numpy_histogram = typing.cast(_NumpyHistogramFunc, numpy.histogram)


def _get_histogram(duration: pandas.Series) -> list[float]:
    cutoff = duration.quantile(0.95)
    data = duration[duration <= cutoff]
    bins = numpy.arange(0, cutoff + _BIN_WIDTH, _BIN_WIDTH)
    histo = _numpy_histogram(data, bins=bins)
    normalized_histo = histo[0] / numpy.sum(histo[0])
    return typing.cast(list[float], normalized_histo.tolist())


def fhs2dicts(durations_csv: str) -> list[dict[str, Any]]:
    """Import stats from FHS as gobal diagnosis.

    Args:
        durations_csv: path to a CSV file containing one line for each job
        seeker, some of their properties and the duration of their last
        unemployment period. See the full doc in the
        `fhs_category_duration.py` script.

    Returns:
        A list of dict compatible with the JSON version of
        TODO: Add proto here
        with an additional unique "_id" field.
    """

    job_seekers = pandas.read_csv(durations_csv, dtype={'city_id': str})

    global_diagnoses = []
    for rome_id, group in job_seekers.groupby('code_rome'):
        estimation = importer_helpers.unemployment_estimation(group.duration)
        global_diagnoses.append({
            '_id': rome_id,
            'unemploymentTimeHistogram': _get_histogram(group.duration),
            'diagnosis': estimation,
        })
    return global_diagnoses


if __name__ == '__main__':
    mongo.importer_main(fhs2dicts, 'global_diagnosis')
