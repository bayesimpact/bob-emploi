"""Script to trim down the full CPF training list.

The scraping of CPF is 1Gb+ in JSON, in order to manipulate it in RAM, run this script to flattend
and remove the fields you do not need.

Example of usage:
docker-compose run --rm data-analysis-prepare \
    python bob_emploi/data_analysis/misc/cpf_trim.py \
    data/cpf_training_programs.json \
    data/cpf_simple_trainings.csv \
    --fields duration,totalPriceTTC
"""

import argparse
import csv
import json
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence, TextIO

import tqdm


def _load_trainings(filename: str) -> Iterator[Dict[str, Any]]:
    with open(filename, 'rt') as open_file:
        for line in open_file:
            if not line.startswith('{'):
                continue
            if line.endswith(',\n'):
                yield json.loads(line[:-2])
                continue
            yield json.loads(line)


def _flatten_on(root: Dict[str, Any], fields: Sequence[str]) -> Iterator[Dict[str, Any]]:
    if not fields or fields[0] not in root:
        yield root
        return

    field = fields[0]
    other_fields = fields[1:]
    if other_fields:
        if not isinstance(root[field], dict):
            yield root
            return
        for flattened in _flatten_on(root[field], other_fields):
            yield dict(root, **{field: flattened})
        return

    if not isinstance(root[field], list):
        yield root
        return

    if not root[field]:
        yield dict(root, **{field: None})
        return

    for value in root[field]:
        yield dict(root, **{field: value})


def _flatten_trainings(field: str, trainings: Iterator[Dict[str, Any]]) -> Iterator[Dict[str, Any]]:
    field_parts = field.split('.') if field else []
    for training in trainings:
        yield from _flatten_on(training, field_parts)


def _get_nested_value(root: Any, fields: Sequence[str]) -> Any:
    if not fields:
        return root
    if not isinstance(root, dict) or fields[0] not in root:
        return None
    return _get_nested_value(root[fields[0]], fields[1:])


def _project_training(training: Dict[str, Any], fields: Iterable[str]) -> Dict[str, Any]:
    return {
        field: _get_nested_value(training, field.split('.'))
        for field in fields
    }


def main(string_args: Optional[List[str]] = None, out: Optional[TextIO] = None) -> None:
    """Trim CPF trainings."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        'in_json',
        help='Path of the CSV file containing all job offers in the Pôle emploi '
        'format (using latin-1 encoding, | separators, etc).')
    parser.add_argument('out_csv', help='Path where to store the output CSV file.')
    parser.add_argument(
        '--flatten', help='field of a repeated value to flatten.',
        default='formation.proximiteRomes')
    parser.add_argument(
        '--fields', help='list of fields to keep, separated by commas.',
        default='formation.title,formation.proximiteRomes.code,duration,totalPriceTTC')

    args = parser.parse_args(string_args)

    fieldnames = args.fields.split(',')
    flatten_trainings = _flatten_trainings(args.flatten, _load_trainings(args.in_json))
    with open(args.out_csv, 'w') as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()

        for training in tqdm.tqdm(flatten_trainings, file=out):
            writer.writerow(_project_training(training, fieldnames))


if __name__ == '__main__':
    main()
