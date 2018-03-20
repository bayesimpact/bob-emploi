"""A script to sample ROME jobs in job groups.

This scripts take as an input the full ROME "appellation" table and outputs a
file with a list of masculine job names (one per line).
"""

import sys

from bob_emploi.data_analysis.lib import cleaned_data
from bob_emploi.data_analysis.lib import rome_genderization


def main(rome_appellation_csv, output_txt):
    """Sample ROME jobs in job groups.

    Args:
        rome_appellation_csv: path to a CSV file containing all ROME jobs.
        output_txt: path where to create the output txt file. It will get
            populated with a list of masculine job names, one per line.
    """

    jobs = cleaned_data.rome_jobs(filename=rome_appellation_csv)
    samples = jobs.groupby('code_rome').apply(lambda d: d.sample(1))
    names, unused_ = rome_genderization.genderize(samples.name)
    with open(output_txt, 'w') as output:
        output.write('\n'.join(names.tolist()) + '\n')


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover; pylint: disable=no-value-for-parameter
