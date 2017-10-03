"""Script to parse the PDF dump containing mappings from Rome to Formacodes."""
import re
import sys

# Matches ROME identifiers "H2101".
_ROME_MATCHER = re.compile(r'(?:\b|_)([A-Z]\d{4})(?:\b|_)')
# Matches Formacodes "215 99".
_FORMACODE_MATCHER = re.compile(r'(?:\b|\D)(\d{3} \d{2})(?:\b|\D)')


def _parse_rome_formacode_file(pdf_dump):
    """Parse a Correspondance from Rome to Formacode PDF dump.

    Yields:
        a mapping from the ROME ID of a job, to a the Formacode ID of a
        training that would be useful for this job.
    """
    with open(pdf_dump) as mappings_file:
        for line in mappings_file:
            for mapping in parse_rome_formacode_line(line):
                yield mapping


def parse_rome_formacode_line(line):
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
            'A line contained Formacodes, but no ROME ID:\n{}'.format(line))
    if len(rome_ids) > 1:
        raise ValueError(
            'A line contained more than one ROME ID:\n{}'.format(line))
    if not formacodes:
        raise ValueError(
            'A line contained a ROME ID, but no Formacodes:\n{}'.format(line))
    rome_id = rome_ids[0]
    for formacode in formacodes:
        yield (rome_id, formacode)


def main(args, out=sys.stdout):
    """Parse a Correspondance from Rome to Formacode PDF dump.

    Outputs a CSV file with a mapping from ROME ID of jobs to Formacode ID of
    trainings that would be useful for each job.
    """
    if len(args) != 2:
        raise SystemExit(
            'Usage: formacode_parser.py Correspondance_Rome_Formacode.txt')
    input_file = args[1]
    out.write('rome,formacode\n')
    for mapping in _parse_rome_formacode_file(input_file):
        out.write('{},{}\n'.format(*mapping))


if __name__ == '__main__':
    main(sys.argv)  # pragma: no cover
