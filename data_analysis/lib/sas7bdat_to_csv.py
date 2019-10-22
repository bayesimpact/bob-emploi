"""Convert SAS7BDAT files to CSV."""

import os
import sys
from typing import List

import sas7bdat


def convert_files(files: List[str]) -> None:
    """Create a csv file for each matching sas7bdat file."""

    matching = [f for f in files if f.endswith('.sas7bdat')]
    num_files = len(matching)
    if num_files != len(files):
        print(
            f'Ignoring {len(files) - num_files:d}/{len(files):d} files that were not '
            '.sas7bdat files.')
    print(f'Attempting to convert {num_files:d} files')

    for i, filename in enumerate(sorted(matching)):
        csv_filename = filename.rsplit('.sas7bdat', 1)[0] + '.csv'
        print(f'{i + 1:d}/{num_files:d}: Converting {filename} to {csv_filename}')
        if os.path.exists(csv_filename):
            print('Skipping, resulting csv already exists')
            continue
        with sas7bdat.SAS7BDAT(filename) as infile:
            infile.convert_file(csv_filename)


if __name__ == '__main__':
    convert_files(sys.argv[1:])
