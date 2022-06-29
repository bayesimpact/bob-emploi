"""A script to download data from Emploi Store Dev website."""

import json
import os
import sys

import emploi_store


def main(json_file_name: str) -> None:
    """Download all online events from Emploi Store as a JSON.

    To use this script you first have to create a `client_id` and a `client_secret` for
    an [Emploi Store app](https://www.emploi-store-dev.fr). When you have these access
    credentials, set the environment variables EMPLOI_STORE_CLIENT_ID and
    EMPLOI_STORE_CLIENT_SECRET with them.

    For Bayes internal use visit http://go/pe:api-credentials
    """

    # The client ID and Secret have been created by Pascal
    # (pascal@bayesimpact.org) for an app called MyGamePlan on the Emploi Store
    # Dev website. Don't spread those identifiers.
    client = emploi_store.Client(
        client_id=os.getenv('EMPLOI_STORE_CLIENT_ID'),
        client_secret=os.getenv('EMPLOI_STORE_CLIENT_SECRET'))
    salons = client.list_online_events()
    with open(json_file_name, 'w', encoding='utf-8') as outfile:
        json.dump(salons, outfile)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pylint: disable=no-value-for-parameter
