"""A module to mock MailJet."""

# TODO(pascal): Probably move to its own package.

import datetime
import io
import json
import time
import typing
from typing import Any, Callable, Dict, Iterator, List, Optional, Tuple, Union
from unittest import mock
import uuid

import requests


_JsonDict = Dict[str, Any]


def _check_not_null_variable(
        json_variable: Union[None, List[Any], _JsonDict]) -> None:
    if json_variable is None:
        raise ValueError('null is not an acceptable value.')
    if isinstance(json_variable, list):
        for element in json_variable:
            _check_not_null_variable(element)
    if isinstance(json_variable, dict):
        for element in json_variable.values():
            _check_not_null_variable(element)


class _SentMessage(object):

    def __init__(
            self, recipient: _JsonDict, properties: _JsonDict,
            message_id: int, message_uuid: str) -> None:
        self.recipient = recipient
        self.properties = properties
        self.message_id = message_id
        self.uuid = message_uuid
        self.arrived_at = time.time()
        self.status = 'sent'

    def open(self) -> None:  # pylint: disable=invalid-name
        """Mark the message as opened."""

        if self.status == 'sent':
            self.status = 'opened'

    def click(self) -> None:
        """Mark the message as clicked."""

        if self.status in {'sent', 'opened'}:
            self.status = 'clicked'

    def __repr__(self) -> str:
        return f'_SentMessage({self.recipient}, {self.properties}, {self.message_id})'


def _create_json_response(json_content: _JsonDict, status_code: int = 200) -> requests.Response:
    response = requests.Response()
    response.status_code = status_code
    response.encoding = 'utf-8'
    response.raw = io.BytesIO(json.dumps(json_content, ensure_ascii=False).encode('utf-8'))
    return response


def _mailjet_error(error_code: str, additional_content: Optional[_JsonDict] = None) \
        -> requests.exceptions.HTTPError:
    return requests.exceptions.HTTPError(response=_create_json_response(
        dict(
            additional_content or {},
            ErrorIdentifier=str(uuid.uuid4()), ErrorCode=error_code, StatusCode=400),
        status_code=400))


def _check_valid_sender(sender: Any) -> bool:
    if isinstance(sender, dict):
        email = sender.get('Email', '')
        name = sender.get('Name')
        if '@' not in email:
            raise _mailjet_error('mj-0013', {
                'ErrorMessage': f'\"{email}\" is an invalid email address.',
                'ErrorRelatedTo': ['From.Email']
            })
        if name is not None:
            return True
    raise _mailjet_error('mj-004', {
        'ErrorMessage': 'Type mismatch. Expected type \"emailIn\".',
        'ErrorRelatedTo': ['Messages']
    })


def _check_valid_template_id(template_id: Any) -> bool:
    if isinstance(template_id, int):
        return True
    raise _mailjet_error('mj-004', {
        'ErrorMessage': 'Type mismatch. Expected type \"int64\".',
        'ErrorRelatedTo': ['Messages']
    })


class _InMemoryMailjetServer(object):

    def __init__(self) -> None:
        self.messages: List[_SentMessage] = []
        self.next_id = 101
        self._messages_by_id: Dict[int, _SentMessage] = {}
        self.has_too_many_get_requests = False

    def clear(self) -> None:
        """Clear all messages sent."""

        self.has_too_many_get_requests = False
        self.messages.clear()

    def create_message(self, recipient: _JsonDict, message: _JsonDict) -> Tuple[str, int]:
        """Create a message as if it was sent."""

        message_id = self.next_id + 1
        self.next_id += 1
        message_uuid = f'aa{message_id}'
        sent_message = _SentMessage(recipient, message, message_id, message_uuid)

        self._messages_by_id[message_id] = sent_message
        self.messages.append(sent_message)

        return message_uuid, message_id

    def __getitem__(self, message_id: int) -> _SentMessage:
        """Gets a message by its ID."""

        return self._messages_by_id[message_id]


_MOCK_SERVER = _InMemoryMailjetServer()


class _Client(object):
    """A MailJet mock client."""

    def __init__(self, auth: Optional[Any] = None, version: str = 'v3'):
        self._auth = auth
        self.version = version
        self.message = _Messager(version)
        self.send = _Sender(version)


class _Messager(object):

    def __init__(self, client_version: str) -> None:
        self._version = client_version

    def _create_message_info(self, message: _SentMessage) -> _JsonDict:
        arrived_at = datetime.datetime.fromtimestamp(round(message.arrived_at))
        return {
            'ArrivedAt': f'{arrived_at.isoformat()}Z',
            'ID': message.message_id,
            'Status': message.status,
        }

    def get(self, message_id: int) -> requests.Response:  # pylint: disable=invalid-name
        """Get info on a message."""

        if _MOCK_SERVER.has_too_many_get_requests:
            response = requests.Response()
            response.reason = 'Too many requests'
            response.url = f'https://api.mailjet.com/{self._version}/REST/message/{message_id}'
            response.status_code = 429
            return response

        try:
            message = _MOCK_SERVER[message_id]
        except KeyError:
            response = requests.Response()
            response.reason = 'Client Error'
            response.url = f'https://api.mailjet.com/{self._version}/REST/message/{message_id}'
            response.status_code = 404
            return response
        return _create_json_response({
            'Count': 1 if message else 0,
            'Data': [self._create_message_info(message)] if message else [],
        })


class _Sender(object):

    def __init__(self, client_version: str) -> None:
        self._version = client_version

    def _create_v31_message(self, message: _JsonDict) -> _JsonDict:
        out: _JsonDict = {
            'Status': 'Success',
        }
        if 'Variables' in message:
            _check_not_null_variable(message['Variables'])
        # Template messages don't require a 'From' field.
        if 'From' in message:
            _check_valid_sender(message['From'])
        if not {'HTMLPart', 'TextPart', 'TemplateID'} & set(message):
            raise _mailjet_error('send-0003', {
                'ErrorMessage': 'At least "HTMLPart", "TextPart" or "TemplateID" must be provided.',
                'ErrorRelatedTo': ['HTMLPart', 'TextPart', 'TemplateID'],
            })
        if 'TemplateID' in message:
            _check_valid_template_id(message['TemplateID'])
        for target_type in ('To', 'Cc', 'Cci'):
            if target_type in message:
                messages: List[Dict[str, Any]] = []
                for recipient in message[target_type]:
                    message_uuid, message_id = _MOCK_SERVER.create_message(recipient, message)
                    messages.append({
                        'Email': recipient['Email'],
                        'MessageUUID': message_uuid,
                        'MessageID': message_id,
                        'MessageHref': f'https://api.mailjet.com/v3/message/{message_id}',
                    })
                out[target_type] = messages
        return out

    # TODO(pascal): Add a way to make it return a 5xx error so that tests can
    # check how code catches such errors.
    # TODO(cyrille): Return the correct error when recipient email address is invalid.
    def create(self, data: _JsonDict) -> requests.Response:
        """Create a new email."""

        if self._version != 'v3.1':
            raise NotImplementedError(f'mailjetmock not ready for version "{self._version}"')

        json_content: _JsonDict = {}
        try:
            json_content['Messages'] = [self._create_v31_message(m) for m in data['Messages']]
        except (KeyError, ValueError):
            return _create_json_response({}, 400)
        except requests.exceptions.HTTPError as error:
            return typing.cast(requests.Response, error.response)

        return _create_json_response(json_content)


def patch() -> 'mock._patch':
    """Patch the mailjet_rest module with a mock.

    This also clears all messages sent known by the mock module when the patch starts."""

    # We're using the famous mock.patch: it's super cool as it allows to patch
    # manually (using start/stop), as a function decorator or even as a test
    # class decorator. Unfortunately it does not have a hook to launch special
    # code when the patch is applied, so we need the little hack below to clear
    # sent messages before entering the patch context.

    def _clear_and_call(func: Callable[..., Any]) -> Callable[..., Any]:
        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            _MOCK_SERVER.clear()
            return func(*args, **kwargs)
        return _wrapped

    # To work as a class decorator, the patcher object knows how to copy
    # itself: we need to propagate the hack above to the copies as well.

    def _copy_and_patch_enter(
            func: Callable[..., Any]) -> Callable[..., Any]:
        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            result = func(*args, **kwargs)
            result.__enter__ = _clear_and_call(result.__enter__)
            result.copy = _copy_and_patch_enter(result.copy)
            return result
        return _wrapped

    patcher = mock.patch('mailjet_rest.Client', _Client)
    patcher.__enter__ = _clear_and_call(patcher.__enter__)  # type: ignore
    patcher.copy = _copy_and_patch_enter(patcher.copy)  # type: ignore
    return patcher


def get_all_sent_messages() -> List[_SentMessage]:
    """Return a list of all sent messages."""

    return _MOCK_SERVER.messages


def get_messages_sent_to(recipient_email: str) -> Iterator[_SentMessage]:
    """Yields messages sent to a given email."""

    for message in get_all_sent_messages():
        if message.recipient['Email'] == recipient_email:
            yield message


def clear_sent_messages() -> None:
    """Clear the list of sent messages."""

    return _MOCK_SERVER.clear()


def get_message(message_id: int) -> _SentMessage:
    """Get a message by its ID."""

    return _MOCK_SERVER[message_id]


def set_too_many_get_api_requests() -> None:
    """Mock a server having received too many get API requests.

    Any following calls to Client.message.get will return a 429 HTTP error.
    """

    _MOCK_SERVER.has_too_many_get_requests = True
