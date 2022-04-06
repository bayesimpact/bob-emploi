"""A module to mock MailJet."""

# TODO(pascal): Probably move to its own package.

import datetime
import functools
import io
import itertools
import json
import time
import typing
from typing import Any, Callable, Iterator, Optional, Tuple, Type, Union
from unittest import mock
import uuid

import requests


_JsonDict = dict[str, Any]


def _check_not_null_variable(
        json_variable: Union[None, list[Any], _JsonDict]) -> None:
    if json_variable is None:
        raise ValueError('null is not an acceptable value.')
    if isinstance(json_variable, list):
        for element in json_variable:
            _check_not_null_variable(element)
    if isinstance(json_variable, dict):
        for element in json_variable.values():
            _check_not_null_variable(element)


class _SentMessage:

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


class _InMemoryMailjetServer:

    def __init__(self) -> None:
        self.messages: list[_SentMessage] = []
        self.next_id = 101
        self._messages_by_id: dict[int, _SentMessage] = {}
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


class _Client:
    """A MailJet mock client."""

    def __init__(self, auth: Optional[Any] = None, version: str = 'v3'):
        self._auth = auth
        self.version = version
        self.message = _Messager(version)
        self.send = _Sender(version)
        self.campaign = _Campaigner(version)


class _Messager:

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


class _Sender:

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
                messages: list[dict[str, Any]] = []
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


class _Campaigner:

    def __init__(self, client_version: str) -> None:
        self._version = client_version

    def get(self, *, filters: Optional[_JsonDict] = None) -> requests.Response:  # pylint: disable=invalid-name
        """Create a new email."""

        campaigns = itertools.groupby(
            sorted(_MOCK_SERVER.messages, key=lambda m: m.properties.get('CustomCampaign', '')),
            key=lambda m: typing.cast(str, m.properties.get('CustomCampaign', '')))

        custom_campaign = filters and filters.get('CustomCampaign')

        json_campaigns: list[_JsonDict] = []
        for name, messages in campaigns:
            if custom_campaign and custom_campaign != name:
                continue
            all_messages = list(messages)
            first_message = all_messages[0]
            created_at = datetime.datetime.fromtimestamp(round(first_message.arrived_at))
            send_end_at = datetime.datetime.fromtimestamp(round(all_messages[-1].arrived_at))
            json_campaigns.append({
                'ID': first_message.message_id + 10000,
                'CreatedAt': f'{created_at.isoformat()}Z',
                'SendStartAt': f'{created_at.isoformat()}Z',
                'SendEndAt': f'{send_end_at.isoformat()}Z',
                'CustomValue': name,
                'FirstMessageID': first_message.message_id
            })

        return _create_json_response({'Count': len(json_campaigns), 'Data': json_campaigns})


_T = typing.TypeVar('_T')


class _Patch:

    def __init__(self) -> None:
        self._patcher = mock.patch('mailjet_rest.Client', _Client)

    def __call__(self, func: Union[Type[Any], Callable[..., Any]]) -> Any:
        if isinstance(func, type):
            return self._decorate_class(func)
        return self._decorate_callable(func)

    def _decorate_class(self, klass: Any) -> Any:
        for attr in dir(klass):
            if not attr.startswith(mock.patch.TEST_PREFIX):
                continue

            attr_value = getattr(klass, attr)
            if not hasattr(attr_value, '__call__'):
                continue

            setattr(klass, attr, self._decorate_callable(attr_value))
        return klass

    def _decorate_callable(self, func: Any) -> Any:
        @functools.wraps(func)
        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            self.start()
            try:
                return func(*args, **kwargs)
            finally:
                self.stop()
        return _wrapped

    def start(self) -> Any:
        """Activate a patch, returning any created mock."""

        _MOCK_SERVER.clear()
        return self._patcher.start()

    def stop(self) -> Any:  # pylint: disable=invalid-name
        """Stop an active patch."""

        return self._patcher.stop()


def patch() -> _Patch:
    """Patch the mailjet_rest module with a mock.

    This also clears all messages sent known by the mock module when the patch starts."""

    return _Patch()


def get_all_sent_messages() -> list[_SentMessage]:
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
