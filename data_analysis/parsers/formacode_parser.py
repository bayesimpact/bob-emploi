"""Script to parse the PDF dump containing mappings from Rome to Formacodes."""

import re
import sys
import typing

# Matches ROME identifiers "H2101".
_ROME_MATCHER = re.compile(r'(?:\b|_)([A-Z]\d{4})(?:\b|_)')
# Matches Formacodes "215 99".
_FORMACODE_MATCHER = re.compile(r'(?:\b|\D)(\d{3} \d{2})(?:\b|\D)')


def _parse_rome_formacode_file(pdf_dump: str) -> typing.Iterator[typing.Tuple[str, str]]:
    """Parse a Correspondance from Rome to Formacode PDF dump.

    Yields:
        a mapping from the ROME ID of a job, to a the Formacode ID of a
        training that would be useful for this job.
    """

    with open(pdf_dump) as mappings_file:
        for line in mappings_file:
            for mapping in parse_rome_formacode_line(line):
                yield mapping


def parse_rome_formacode_line(line: str) -> typing.Iterator[typing.Tuple[str, str]]:
    """Parse a Correspondance line from Rome to Formacode PDF dump.

    Yields:
        a mapping from the ROME ID of a job, to a the Formacode ID of a
        training that would be useful for this job.
    """

    rome_ids = _ROME_MATCHER.findall(line)
    formacodes = _FORMACODE_MATCHER.findall(line)
    if not rome_ids and not formacodes:
        return
    if not rome_ids:
        raise ValueError(
            f'A line contained Formacodes, but no ROME ID:\n{line}')
    if len(rome_ids) > 1:
        raise ValueError(
            f'A line contained more than one ROME ID:\n{line}')
    if not formacodes:
        raise ValueError(
            f'A line contained a ROME ID, but no Formacodes:\n{line}')
    rome_id = rome_ids[0]
    for formacode in formacodes:
        yield (rome_id, formacode)


def main(args: typing.Sequence[str], out: typing.TextIO = sys.stdout) -> None:
    """Parse a Correspondance from Rome to Formacode PDF dump.

    Outputs a CSV file with a mapping from ROME ID of jobs to Formacode ID of
    trainings that would be useful for each job.
    """

    if len(args) != 2:
        raise SystemExit(
            'Usage: formacode_parser.py Correspondance_Rome_Formacode.txt')
    input_file = args[1]
    out.write('rome,formacode\n')
    for rome_id, formacode in _parse_rome_formacode_file(input_file):
        out.write(f'{rome_id},{formacode}\n')


if __name__ == '__main__':
    main(sys.argv)
