"""Convert SAS7BDAT files to CSV."""
import os
import sys

from sas7bdat import SAS7BDAT


def convert_files(files):
    """Create a csv file for each matching sas7bdat file."""
    matching = [f for f in files if f.endswith('.sas7bdat')]
    num_files = len(matching)
    if num_files != len(files):
        print('Ignoring %d/%d files that were not .sas7bdat files.' % (
            len(files) - num_files, len(files)))
    print('Attempting to convert %d files' % num_files)

    for i, filename in enumerate(sorted(matching)):
        csv_filename = filename.rsplit('.sas7bdat', 1)[0] + '.csv'
        print('%d/%d: Converting %s to %s' % (
            i + 1, num_files, filename, csv_filename))
        if os.path.exists(csv_filename):
            print('Skipping, resulting csv already exists')
            continue
        with SAS7BDAT(filename) as infile:
            infile.convert_file(csv_filename)


if __name__ == '__main__':
    convert_files(sys.argv[1:])  # pragma: no-cover
