"""Script to hash email fields in a CSV file."""

import hashlib
import sys
import typing

import unidecode


def hash_line(line: str, keep: bool = False) -> str:
    """Hash first field of a CSV line.

    Args:
        line: the line to hash.
        keep: if True, the first field is kept and the hash is added as an
            extra field at the end of the lines. If False, the first field is
            replaced by the hash.
    Returns:
        The modified line.
    """

    fields = line.strip().split(',')
    hashed_field = hashlib.sha1(fields[0].encode('utf-8')).hexdigest()
    if keep:
        fields = fields + [hashed_field]
    else:
        fields = [hashed_field] + fields[1:]
    return ','.join(fields) + '\n'


def hash_files(inputfile: str, outputfile: str, keep: typing.Union[bool, str] = False) -> int:
    """Hash first field of each line of the input file and populate the output.

    Args:
        inputfile: path to the input CSV file.
        outputfile: path where to write the output CSV file.
        keep: if True, the first field is kept and the hash is added as an
            extra field at the end of the lines. If False, the first field is
            replaced by the hash.
    Returns:
        The number of hashed lines.
    """

    count = 0
    with open(outputfile, 'wt') as output:
        with open(inputfile, 'r') as input_lines:
            for line in input_lines:
                output.write(hash_line(line, bool(keep)))
                count += 1
    return count


def hash_user(email: str, name: str) -> str:
    """Prepare the hash string for a given user."""

    return hash_line(unidecode.unidecode(email + name[:3].lower())).strip()


if __name__ == '__main__':
    print(f'{hash_files(*sys.argv[1:])} lines hashed.')  # pylint: disable=no-value-for-parameter
