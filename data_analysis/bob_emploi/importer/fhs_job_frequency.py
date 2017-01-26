"""This script computes the frequency of professions in the FHS.

The script considers only the jobseekers that are unemployed to date (well to
the date of the FHS) and get the # of jobseekers in each job.

It outputs a simple JSON file with a mapping from the OGR codes to the # of
jobseekers in the corresponding job.

The output is used for the ranking of jobs in
https://github.com/bayesimpact/french-job-suggest.

If you managed to get your hands on the FHS dataset, you can run:
    docker-compose run --rm data-analysis-prepare python \
        bob_emploi/importer/fhs_job_frequency.py \
        "data/pole_emploi/FHS/FHS*201512" \
        data/jobs_frequency.json
"""
import collections
import json
from os import path
import sys

import numpy
import pandas

from bob_emploi.lib import migration_helpers

# Field in the FHS "de" table for the end date of the job request.
_END_DATE_FIELD = 'DATANN'

# Field in the FHS "de" table for the OGR code of the job requested.
_JOB_CODE_FIELD = 'ROMEAPL'


def _print_progress(value, total, bar_length=100):
    percent = round(value * 100 / total, 2)
    filled_length = int(percent * bar_length / 100)
    bar_ascii = '#' * filled_length + '-' * (bar_length - filled_length)

    sys.stdout.write('[%s] %s%%\r' % (bar_ascii, percent))
    if value == total:
        sys.stdout.write('\n')
    sys.stdout.flush()


def main(fhs_folder, json_output, progress=_print_progress):
    """Extract the job OGR codes from FHS and count them.

    Args:
        fhs_folder: path of the root folder of the FHS files.
        json_output: path to the file to write to.
    """
    # Check that the output file is writeable before starting the long process
    # of collecting data.
    with open(json_output, 'w'):
        pass

    de_rows = migration_helpers.flatten_iterator(
        path.join(fhs_folder, '*/de_*.csv'))

    # Estimation of the total # of rows in the FHS "de" table.
    total = 7000001

    # If we need to do that often we could replace this code by a simple Map
    # Reduce to use multiple threads or multiple computers.
    job_counts = collections.defaultdict(int)
    counted = 0
    for de_dict in de_rows:
        counted += 1
        if counted % 1000 == 0 and progress:
            progress(counted, total)
        if de_dict[_END_DATE_FIELD]:
            continue
        job_code = de_dict[_JOB_CODE_FIELD]
        job_counts[job_code] += 1

    _print_progress(total, total)

    job_count_series = pandas.Series(job_counts)
    # Add random gaussian noise so that numbers do not reveal initial data.
    job_count_series = job_count_series.add(
        numpy.random.normal(scale=5, size=len(job_count_series)))
    # Keep int only to hide the fact we added noise.
    job_count_series = job_count_series.round().astype(int)
    # Keep strictly positive values only.
    job_count_series = job_count_series[job_count_series > 0]
    # Return to dict format and get rid of numpy int64 (TODO find a cleaner way
    # to do that).
    job_counts = json.loads(job_count_series.to_json())

    with open(json_output, 'w') as output_file:
        json.dump(job_counts, output_file, sort_keys=True, indent=2)


if __name__ == '__main__':
    main(*sys.argv[1:])
