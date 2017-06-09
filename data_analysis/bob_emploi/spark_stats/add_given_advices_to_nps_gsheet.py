"""Add which advices where given to users in the Net Promoter Score google sheet.

To use it:

 - First: docker-compose build data-analysis-prepare
 - Finally run this script:
    docker-compose run \
        -e MONGO_URL \
        --rm data-analysis-prepare \
        python bob_emploi/spark_stats/add_given_advices_to_nps_gsheet.py \
        --noauth_local_webserver
"""
import argparse
import collections
import os
import string

import apiclient
import httplib2
import pymongo
import oauth2client


_FLAGS = argparse.ArgumentParser(parents=[oauth2client.tools.argparser]).parse_args()
_MONGO_DB = pymongo.MongoClient(os.getenv('MONGO_URL')).get_default_database()
# If modifying these scopes, delete your previously saved credentials
# at ~/.credentials/sheets.googleapis.com-bob-internal-tools.json
_SCOPES = 'https://www.googleapis.com/auth/spreadsheets'
# TODO(florian): use env var instead of file for the gsheet api secret
_CLIENT_SECRET_FILE = 'client_secret.json'
_APPLICATION_NAME = 'Bob Internal Tool - NPS Sheet Update'
# This is the id of the gsheet at http://go/bob:NPS
_SPREADSHEET_ID = '1ELSlglxN9C5HdeUpfM2Xk8okdBVeuCkhp39xTsc2XNc'
_FULL_NPS_GSHEET_RANGE = 'NPS Responses!A1:G'
_CREDENTIAL_PATH = os.path.expanduser(
    '~/.credentials/sheets.googleapis.com-bob-internal-tools.json'
)


class UserNotFoundException(Exception):
    """When user not found in the app database."""
    pass


def get_credentials():
    """Gets valid user credentials from storage.

    If nothing has been stored, or if the stored credentials are invalid,
    the OAuth2 flow is completed to obtain the new credentials.

    Code taken from https://developers.google.com/sheets/api/quickstart/python.

    Returns:
        Credentials, the obtained credential.
    """
    credential_dir = os.path.dirname(_CREDENTIAL_PATH)
    if not os.path.exists(credential_dir):
        os.makedirs(credential_dir)

    store = oauth2client.file.Storage(_CREDENTIAL_PATH)
    credentials = store.get()
    if not credentials or credentials.invalid:
        flow = oauth2client.client.flow_from_clientsecrets(_CLIENT_SECRET_FILE, _SCOPES)
        flow.user_agent = _APPLICATION_NAME
        credentials = oauth2client.tools.run_flow(flow, store, _FLAGS)
        print('Storing credentials to ' + _CREDENTIAL_PATH)
    return credentials


def add_given_advices_to_nps_gsheet(user_db):
    """Writes in the NPS gsheet what advices were given to users that responsed to the NPS survey.
    """
    credentials = get_credentials()
    http = credentials.authorize(httplib2.Http())
    discovery_url = 'https://sheets.googleapis.com/$discovery/rest?version=v4'
    service = apiclient.discovery.build(
        'sheets',
        'v4',
        http=http,
        discoveryServiceUrl=discovery_url
    )

    result = service.spreadsheets().values().get(
        spreadsheetId=_SPREADSHEET_ID, range=_FULL_NPS_GSHEET_RANGE).execute()
    user_rows = result.get('values', [])

    if not user_rows:
        print('Could not read data from the NPS gsheet.')
        return

    # Create User class from the first row, which contains the headers.
    headers = user_rows.pop(0)
    User = collections.namedtuple('User', ['user_index'] + headers)  # pylint: disable-msg=C0103

    user_index = 0
    for user_row in user_rows:
        # The sheet API removes trailing empty values in a row, so we add them back
        # to have the right number of params for the User constructor.
        user_row += (len(headers) - len(user_row)) * ['']
        user = User(user_index, *user_row)
        if not user.given_advice_ids:
            write_given_advices_in_gsheet(user_db, service, user)
        user_index += 1


def write_given_advices_in_gsheet(user_db, service, user):
    """Fetches given advices for one user from our db and writes it in the NPS gsheet."""
    print('%s %s' % (user.user_index, user.email))
    # TODO(florian): if necessary for perf later, fetch given advices in bulk.
    try:
        given_advice_ids = get_given_advices_id(user_db, user.email)
    except UserNotFoundException:
        given_advice_ids_text = '404'
    else:
        if given_advice_ids:
            given_advice_ids_text = '\n'.join(given_advice_ids)
        else:
            # Empty list.
            given_advice_ids_text = '(no advices given)'
    print(given_advice_ids_text + '\n')
    update_user_field_in_nps_gsheet(service, user, 'given_advice_ids', given_advice_ids_text)


def update_user_field_in_nps_gsheet(service, user, field_name, field_value):
    """Write one field for a user in the NPS gsheet."""
    field_range = get_range_for_user_field(user, field_name)
    result = service.spreadsheets().values().update(
        spreadsheetId=_SPREADSHEET_ID,
        range=field_range,
        valueInputOption='RAW',
        body={
            'range': field_range,
            'values': [[field_value]],
            'majorDimension': 'ROWS'
        }
    ).execute()
    if result['updatedCells'] != 1:
        print('Error updating cell in gsheet: %s' % result)


def get_range_for_user_field(user, field_name):
    """Returns the range in the gsheet that corresponds to the nth user in the table.

    Example: The field 'given_advice_id' for the first user (which is on the row 2)
    will have the range 'G2'

    Note: user_index starts at 0."""
    first_user_row_id = 2
    row_id = first_user_row_id + user.user_index
    field_index = user._fields.index(field_name)
    # Converts 1 to 'A', 2 to 'B'...
    column_id = string.ascii_uppercase[field_index - 1]
    return 'NPS Responses!%s%s:%s%s' % (column_id, row_id, column_id, row_id)


def get_given_advices_id(user_db, email):
    """Fetch on our db what advices the app gave to this user.

    Returns:
        The array of advice ids in the order they were given to the user.

    Raises:
        When user not found in db.
    """
    nested_given_advice_ids = user_db.find_one(
        {'profile.email': email},
        {'projects.advices.adviceId': 1, '_id': 0}
    )
    if not nested_given_advice_ids:
        raise UserNotFoundException()
    given_advice_ids = [
        advice['adviceId']
        for project in nested_given_advice_ids.get('projects', [])
        for advice in project.get('advices', [])
    ]
    return given_advice_ids


if __name__ == '__main__':
    print('Run NPS sheet script to add given advices')
    add_given_advices_to_nps_gsheet(_MONGO_DB.user)
