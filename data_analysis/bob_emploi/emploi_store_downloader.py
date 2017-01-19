"""A script to download data from Emploi Store Dev website."""
import os
import re
import sys

import emploi_store


def main(package_name, resource_re, output_file_name):
    """Download a resource from Emploi Store as a CSV.

    Args:
        - package_name: "bmo", "imt" or another package name.
        - resource_re: a regular expression to match the resource's name within
          the package, e.g. ".*2014.*"
        - output_file_name: path to the CSV file to write.

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
    package = client.get_package(package_name)
    resource = package.get_resource(name_re=re.compile(resource_re))
    resource.to_csv(output_file_name)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover
