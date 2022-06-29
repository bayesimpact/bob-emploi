"""A script to download soft skills from Emploi Store Dev website."""

import csv
import logging
import os
import sys
import typing
from typing import Any, Iterable, Iterator, Optional, TextIO

import emploi_store

from bob_emploi.data_analysis.lib import cleaned_data


# TODO(marielaure): Add tests.

_EMPLOI_STORE_DEV_CLIENT_ID = os.getenv('EMPLOI_STORE_CLIENT_ID')
_EMPLOI_STORE_DEV_SECRET = os.getenv('EMPLOI_STORE_CLIENT_SECRET')


class _SoftSkill(typing.NamedTuple):
    job_group: str
    score: Optional[float]
    summary: Optional[str]
    details: Optional[str]


# Option to retrieve soft skills for every job groups.
DEFAULT_ROME_OPTIONS = 'all'


def _create_skill_csv_lines(rome: str, skills: Iterable[dict[str, Any]]) -> Iterator[_SoftSkill]:
    for skill in skills:
        yield _SoftSkill(
            job_group=rome,
            score=skill.get('score'),
            summary=skill.get('summary'),
            details=skill.get('details'),
        )


def main(output: TextIO, rome: str = DEFAULT_ROME_OPTIONS) -> None:
    """Retrieve a list of skills from MatchviaSoftSkills API.
    https://www.emploi-store-dev.fr/portail-developpeur-cms/home/catalogue-des-api/documentation-des-api/api-matchviasoftskills-v1.html
    """

    if not _EMPLOI_STORE_DEV_CLIENT_ID or not _EMPLOI_STORE_DEV_SECRET:
        logging.warning('Missing Emploi Store Dev identifiers.')
        return

    client = emploi_store.Client(
        client_id=_EMPLOI_STORE_DEV_CLIENT_ID,
        client_secret=_EMPLOI_STORE_DEV_SECRET)

    if rome == 'all':
        romes = list(cleaned_data.rome_job_groups().index)
    else:
        romes = [rome]

    if not romes:
        logging.warning('Missing job group identifiers.')
        return

    writer = csv.DictWriter(output, fieldnames=_SoftSkill._fields)
    writer.writeheader()

    for rome in romes:
        try:
            skills = client.get_match_via_soft_skills(rome=rome)

            for fields in _create_skill_csv_lines(rome, skills):
                writer.writerow(fields._asdict())
        except (IOError) as error:
            logging.error(
                'Error while calling MatchviaSoftSkills API: %s\nJob group: %s',
                error, rome)
            return


if __name__ == '__main__':
    with open(sys.argv[1], 'w', encoding='utf-8') as output_file:
        main(output_file, *sys.argv[2:])
