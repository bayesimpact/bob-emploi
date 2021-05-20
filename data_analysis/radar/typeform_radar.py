"""Module to get snapshot results from Typeform."""

import json
import os
import sys
import typing
from typing import Any, Dict, Iterable, List, Optional, Tuple

from google.protobuf import json_format
import requests
import typeform

from bob_emploi.frontend.api.radar import typeform_pb2

_TYPEFORM_UIDS = ('VAj8bEvq', 'beviMNpK')
_FORMS_PATH = os.path.join(os.path.dirname(__file__), 'forms')


def iterate_results(uids: Tuple[str, ...] = _TYPEFORM_UIDS) -> Iterable[typeform_pb2.Photo]:
    """Iterate through all responses of Radar's typeforms."""

    for uid in uids:
        yield from _iterate_form_results(uid)


def _iterate_form_results(uid: str) -> Iterable[typeform_pb2.Photo]:
    api_key = os.environ.get('TYPEFORM_API_KEY')
    if not api_key:
        raise ValueError('Set TYPEFORM_API_KEY as an env var')
    responses = typeform.Typeform(api_key).responses
    last_token: Optional[str] = None
    while True:
        items = responses.list(uid, before=last_token).get('items')
        if not items:
            break
        for item in items:
            last_token = item['token']
            photo = typeform_pb2.Photo()
            json_format.ParseDict(item, photo, ignore_unknown_fields=True)
            yield photo


def fetch_forms(uids: Tuple[str, ...] = _TYPEFORM_UIDS) -> Iterable[Tuple[str, Dict[str, Any]]]:
    """Fetch all form definitions from Typeform API."""

    for uid in uids:
        yield uid, _fetch_form(uid)


def _fetch_form(uid: str) -> Dict[str, Any]:
    response = requests.get(f'https://api.typeform.com/forms/{uid}')
    definition = response.json()
    assert isinstance(definition, dict)
    return typing.cast(Dict[str, Any], definition)


def download_forms(output_path: str = _FORMS_PATH, uids: Tuple[str, ...] = _TYPEFORM_UIDS) -> None:
    """Download all form definitions in a folder."""

    os.makedirs(output_path, exist_ok=True)

    for uid, definition in fetch_forms(uids):
        output_filename = os.path.join(output_path, f'{uid}.json')
        with open(output_filename, 'w') as output_file:
            json.dump(definition, output_file, sort_keys=True, indent=2, ensure_ascii=False)


def upload_forms(json_input_folder: str = _FORMS_PATH) -> None:
    """Upload all form definitions from a folder."""

    api_key = os.environ.get('TYPEFORM_API_KEY')
    if not api_key:
        raise ValueError('Set TYPEFORM_API_KEY as an env var')
    forms = typeform.Typeform(api_key).forms

    for filename in os.listdir(json_input_folder):
        if not filename.endswith('.json'):
            continue
        uid = filename[:-len('.json')]
        with open(os.path.join(json_input_folder, filename), 'r') as input_file:
            data = json.load(input_file)
        forms.update(uid, data)


def main(string_args: Optional[List[str]] = None) -> None:
    """Handle download or upload of forms definitions depending on the arguments."""

    if string_args and 'upload' in string_args:
        upload_forms()
    else:
        download_forms()


if __name__ == '__main__':
    main(sys.argv[1:])
