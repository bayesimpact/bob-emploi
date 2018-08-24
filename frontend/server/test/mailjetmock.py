"""A module to mock MailJet."""

# TODO(pascal): Probably move to its own package.

import datetime
import io
import json
import time

import mock
import requests


def _check_not_null_variable(json_variable):
    if json_variable is None:
        raise ValueError('null is not an acceptable value.')
    if isinstance(json_variable, list):
        for element in json_variable:
            _check_not_null_variable(element)
    if isinstance(json_variable, dict):
        for element in json_variable.values():
            _check_not_null_variable(element)


class _SentMessage(object):

    def __init__(self, recipient, properties, message_id, uuid):
        self.recipient = recipient
        self.properties = properties
        self.message_id = message_id
        self.uuid = uuid
        self.arrived_at = time.time()
        self.status = 'sent'

    def open(self):  # pylint: disable=invalid-name
        """Mark the message as opened."""

        if self.status == 'sent':
            self.status = 'opened'

    def click(self):
        """Mark the message as clicked."""

        if self.status in {'sent', 'opened'}:
            self.status = 'clicked'


def _create_json_response(json_content):
    response = requests.Response()
    response.status_code = 200
    response.encoding = 'utf-8'
    response.raw = io.BytesIO(json.dumps(json_content, ensure_ascii=False).encode('utf-8'))
    return response


class _InMemoryMailjetServer(object):

    def __init__(self):
        self.messages = []
        self.next_id = 101
        self._messages_by_id = {}
        self.has_too_many_get_requests = False

    def clear(self):
        """Clear all messages sent."""

        self.has_too_many_get_requests = False
        self.messages.clear()

    def create_message(self, recipient, message):
        """Create a message as if it was sent."""

        message_id = self.next_id + 1
        self.next_id += 1
        uuid = 'aa{}'.format(message_id)
        sent_message = _SentMessage(recipient, message, message_id, uuid)

        self._messages_by_id[message_id] = sent_message
        self.messages.append(sent_message)

        return uuid, message_id

    def __getitem__(self, message_id):
        """Gets a message by its ID."""

        return self._messages_by_id[message_id]


_MOCK_SERVER = _InMemoryMailjetServer()


class _Client(object):
    """A MailJet mock client."""

    def __init__(self, auth=None, version='v3'):
        self._auth = auth
        self.version = version
        self.message = _Messager(version)
        self.send = _Sender(version)


class _Messager(object):

    def __init__(self, client_version):
        self._version = client_version

    def _create_message_info(self, message):
        arrived_at = datetime.datetime.fromtimestamp(round(message.arrived_at))
        return {
            'ArrivedAt': '{}Z'.format(arrived_at.isoformat()),
            'ID': message.message_id,
            'Status': message.status,
        }

    def get(self, message_id):  # pylint: disable=invalid-name
        """Get info on a message."""

        if _MOCK_SERVER.has_too_many_get_requests:
            response = requests.Response()
            response.reason = 'Too many requests'
            response.url = \
                'https://api.mailjet.com/{}/REST/message/{}'.format(self._version, message_id)
            response.status_code = 429
            return response

        try:
            message = _MOCK_SERVER[message_id]
        except KeyError:
            message = None
        return _create_json_response({
            'Count': 1 if message else 0,
            'Data': [self._create_message_info(message)] if message else [],
        })


class _Sender(object):

    def __init__(self, client_version):
        self._version = client_version

    def _create_v31_message(self, message):
        out = {
            'Status': 'Success',
        }
        if 'Variables' in message:
            _check_not_null_variable(message['Variables'])
        for target_type in ('To', 'Cc', 'Cci'):
            if target_type in message:
                out[target_type] = []
                for recipient in message[target_type]:
                    uuid, message_id = _MOCK_SERVER.create_message(recipient, message)
                    out[target_type].append({
                        'Email': recipient['Email'],
                        'MessageUUID': uuid,
                        'MessageID': message_id,
                        'MessageHref': 'https://api.mailjet.com/v3/message/{}'.format(message_id),
                    })
        return out

    def create(self, data):
        """Create a new email."""

        if self._version != 'v3.1':
            raise NotImplementedError(
                'mailjetmock not ready for version "{}"'.format(self._version))

        json_content = {}
        try:
            json_content['Messages'] = [self._create_v31_message(m) for m in data['Messages']]
        except (KeyError, ValueError):
            response = requests.Response()
            response.status_code = 400
            return response

        return _create_json_response(json_content)


def patch():
    """Patch the mailjet_rest module with a mock.

    This also clears all messages sent known by the mock module when the patch starts."""

    # We're using the famous mock.patch: it's super cools as it allows to patch
    # manually (using start/stop), as a function decorator or even as a test
    # class decorator. Unfortunately it does not have a hook to launch special
    # code when the patch is applied, so we need the little hack below to clear
    # sent messages before entering the patch context.

    def _clear_and_call(func):
        def _wrapped(*args, **kwargs):
            _MOCK_SERVER.clear()
            return func(*args, **kwargs)
        return _wrapped

    # To work as a class decorator, the patcher object knows how to copy
    # itself: we need to propagate the hack above to the copies as well.

    def _copy_and_patch_enter(func):
        def _wrapped(*args, **kwargs):
            result = func(*args, **kwargs)
            result.__enter__ = _clear_and_call(result.__enter__)
            result.copy = _copy_and_patch_enter(result.copy)
            return result
        return _wrapped

    patcher = mock.patch('mailjet_rest.Client', _Client)
    patcher.__enter__ = _clear_and_call(patcher.__enter__)
    patcher.copy = _copy_and_patch_enter(patcher.copy)
    return patcher


def get_all_sent_messages():
    """Return a list of all sent messages."""

    return _MOCK_SERVER.messages


def get_messages_sent_to(recipient_email):
    """Yields messages sent to a given email."""

    for message in get_all_sent_messages():
        if message.recipient['Email'] == recipient_email:
            yield message


def clear_sent_messages():
    """Clear the list of sent messages."""

    return _MOCK_SERVER.clear()


def get_message(message_id):
    """Get a message by its ID."""

    return _MOCK_SERVER[message_id]


def set_too_many_get_api_requests():
    """Mock a server having received too many get API requests.

    Any following calls to Client.message.get will return a 429 HTTP error.
    """

    _MOCK_SERVER.has_too_many_get_requests = True
