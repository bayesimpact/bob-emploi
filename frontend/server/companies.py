"""Module to get information on companies."""

import logging
import os
import typing

import emploi_store

from bob_emploi.frontend.api import company_pb2
from bob_emploi.frontend.api import project_pb2

_EMPLOI_STORE_DEV_CLIENT_ID = os.getenv('EMPLOI_STORE_CLIENT_ID')

_EMPLOI_STORE_DEV_SECRET = os.getenv('EMPLOI_STORE_CLIENT_SECRET')


def get_lbb_companies(
        project: project_pb2.Project,
        distance: float = 10,
        contract: typing.Optional[str] = None,
) -> typing.Iterator[typing.Dict[str, str]]:
    """Retrieve a list of companies from LaBonneBoite API."""

    if not _EMPLOI_STORE_DEV_CLIENT_ID or not _EMPLOI_STORE_DEV_SECRET:
        logging.warning('Missing Emploi Store Dev identifiers.')
        return

    client = emploi_store.Client(
        client_id=_EMPLOI_STORE_DEV_CLIENT_ID,
        client_secret=_EMPLOI_STORE_DEV_SECRET)
    try:
        companies = client.get_lbb_companies(
            city_id=project.city.city_id,
            rome_codes=[project.target_job.job_group.rome_id],
            distance=distance, contract=contract)
        yield from companies
    except (IOError, ValueError) as error:
        logging.error(
            'Error while calling LBB API: %s\nCity: %s\nJob group: %s',
            error, project.city.city_id,
            project.target_job.job_group)
        return


def to_proto(company_json: typing.Dict[str, str]) -> company_pb2.Company:
    """Convert a JSON company fetched from LBB to our proto."""

    return company_pb2.Company(
        name=company_json.get('name', ''),
        siret=company_json.get('siret', ''),
        city_name=company_json.get('city', ''),
        activity_sector_name=company_json.get('naf_text', ''),
        headcount_text=company_json.get('headcount_text', ''),
        hiring_potential=int(company_json.get('stars', -1)) + 1,
    )
