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
from typing import Any, Dict, List

import numpy
import pandas

from bob_emploi.data_analysis.lib import importer_helpers
from bob_emploi.data_analysis.lib import mongo

# Average number of days per month.
_BIN_WIDTH = importer_helpers.DAYS_PER_MONTH
locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')


def _get_histogram(duration: pandas.Series) -> List[float]:
    cutoff = duration.quantile(0.95)
    data = duration[duration <= cutoff]
    bins = numpy.arange(0, cutoff + _BIN_WIDTH, _BIN_WIDTH)
    histo = numpy.histogram(data, bins=bins)
    normalized_histo = histo[0] / numpy.sum(histo[0])
    return typing.cast(List[float], normalized_histo.tolist())


def fhs2dicts(durations_csv: str) -> List[Dict[str, Any]]:
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
