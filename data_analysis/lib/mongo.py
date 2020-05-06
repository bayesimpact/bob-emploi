"""Module to ease interaction with MongoDB."""

import argparse
import collections
import datetime
import inspect
import json
import logging
import os
import re
import sys
import time
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Mapping, Optional, Set, TextIO, \
    Tuple, Type

import pymongo
from pymongo import collection as pymongo_collection
import requests
import tqdm

from google.protobuf import json_format
from google.protobuf import message

_GET_NOW = datetime.datetime.now

# Get mongo URL from the environment.
_MONGO_URL = os.getenv('MONGO_URL') or ''

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_IMPORT_URL = os.getenv('SLACK_IMPORT_URL')

JsonType = Dict[str, Any]
_FlagableCallable = Callable[..., List[JsonType]]


_T = typing.TypeVar('_T')


class InvalidValueError(typing.Generic[_T], ValueError):
    """A value error that holds the invalid value."""

    def __init__(self, value: _T, msg: Optional[str] = None) -> None:
        super(InvalidValueError, self).__init__(msg)
        self.invalid_value = value


class Importer(object):
    """A helper to import data in a MongoDB collection."""

    def __init__(self, flags: argparse.Namespace, out: TextIO = sys.stdout) -> None:
        self.flag_values = flags
        self.out = out

    def _print(self, arg: Any) -> None:
        self.out.write(f'{arg}\n')

    def _print_in_report(self, arg: Any) -> None:
        if _SLACK_IMPORT_URL:
            requests.post(_SLACK_IMPORT_URL, json={'attachments': [{
                'mrkdwn_in': ['text'],
                'title': f'Automatic import of {self.flag_values.mongo_collection}',
                'text': f'{arg}\n',
            }]})
        self._print(arg)

    def import_in_collection(
            self,
            items: List[JsonType],
            collection_name: str,
            check_error: Optional[Exception] = None) -> None:
        """Import items in a MongoDB collection."""

        real_collection = self._collection_from_flags(collection_name)
        has_old_data = bool(real_collection.estimated_document_count())

        if has_old_data:
            has_diff_to_review, has_diff = self.print_diff(items, real_collection)
        else:
            has_diff_to_review, has_diff = False, True

        if check_error:
            raise check_error

        if not has_diff:
            return

        if has_diff_to_review and not self.approve_diff():
            return

        unique_suffix = f'_{round(time.time() * 1e6):x}'
        collection = self._collection_from_flags(collection_name, suffix=unique_suffix)
        collection.drop()
        collection = collection.database.get_collection(collection.name)
        chunk_size = self.flag_values.chunk_size
        total = len(items)
        try:
            # Splitting in chunk is only done to display progress, as pymongo
            # already cut it in small pieces:
            # https://api.mongodb.com/python/current/examples/bulk.html
            if not chunk_size or chunk_size >= total:
                self._print_in_report(f'Inserting all {total:d} objects at once.')
                try:
                    collection.insert_many(items)
                except pymongo.errors.BulkWriteError as error:
                    self._print_in_report(error.details)
                    raise
            else:
                self._print_in_report(f'Inserting {total:d} objects in chunks of {chunk_size}')
                for pos in tqdm.tqdm(range(0, total, chunk_size), file=sys.stdout):
                    try:
                        collection.insert_many(items[pos:pos + chunk_size])
                    except pymongo.errors.BulkWriteError as error:
                        self._print_in_report(error.details)
                        raise
        except Exception:
            collection.drop()
            raise

        # Archive current content if any.
        if has_old_data:
            today = _GET_NOW().date().isoformat()
            archive_collection = self._collection_from_flags(
                collection_name, suffix=f'.{today}{unique_suffix}')
            real_collection.aggregate([{'$out': archive_collection.name}])
            # Drop old archives (exclude the ones archived today and keep only one additional).
            old_versions = sorted(
                name for name in real_collection.database.list_collection_names()
                if name.startswith(real_collection.name + '.') and
                not name.startswith(real_collection.name + f'.{today}')
            )
            for old_version in old_versions[:-1]:
                real_collection.database.drop_collection(old_version)

        collection.rename(real_collection.name, dropTarget=True)
        meta = self._collection_from_flags('meta', collection_name_from_flags=False)
        meta.update_one(
            {'_id': real_collection.name},
            {'$set': {'updated_at': _GET_NOW()}},
            upsert=True)

    def _collection_from_flags(
            self,
            collection_name: str,
            suffix: str = '',
            collection_name_from_flags: bool = True) -> pymongo_collection.Collection:
        if collection_name_from_flags and self.flag_values.mongo_collection:
            collection_name = self.flag_values.mongo_collection
        client = pymongo.MongoClient(_MONGO_URL)
        _database = client.get_database()
        return _database.get_collection(collection_name + suffix)

    def print_diff(
            self,
            new_list: List[JsonType],
            old_mongo_collection: pymongo_collection.Collection) -> Tuple[bool, bool]:
        """Print the difference between an old and new dataset.

        Returns: whether there is a diff to approve, and whether there is a diff to import.
        """

        new_list_len = len(new_list)
        if new_list_len > 1000:
            self._print_in_report(f'Too many entries to diff ({new_list_len}).')
            return False, True

        old_list = list(old_mongo_collection.find())

        diff = _compute_diff(old_list, new_list)
        if not diff:
            self._print_in_report('The data is already up to date.')
            return False, False

        if not self.flag_values.always_accept_diff:
            self._print(json.dumps(diff, indent=2, ensure_ascii=False))

        return True, True

    def approve_diff(self) -> bool:
        """Review the difference between an old and new dataset."""

        if self.flag_values.always_accept_diff:
            return True

        while True:
            # Needed as input() prompts to stderr and stderr might be captured,
            # e.g. by import_status subprocess.run(...).
            self._print('Do you approve this diff? Y/N ')
            answer = input('Do you approve this diff? Y/N ').upper()
            if answer == 'Y':
                return True
            if answer == 'N':
                return False


def _get_doc_section(docstring: str, section_name: str) -> Optional[str]:
    for doc_part in docstring.split('\n\n'):
        if doc_part.strip().startswith(section_name + ':\n'):
            return doc_part
    return None


def _remove_left_padding(lines: List[str], min_padding: int) -> Iterator[str]:
    if not lines:
        return []
    padding = len(lines[0]) - len(lines[0].lstrip())
    if padding < min_padding:
        return []
    for line in lines:
        if len(line) < padding or line[:padding].strip():
            return
        yield line[padding:]


def parse_args_doc(docstring: Optional[str]) -> Dict[str, str]:
    """Parse the args documentation in a function's docstring.

    This function expects a very specific documentation format and parses it to
    extract the documentation for each argument. The documentation format is
    the same one as used by this docstring itself: the arguments are documented
    in an "Args" section (section being defined by good-looking padding and
    blank lines around), each argument is documented by its name followed by a
    colon and a description.

    This function will not crash even if the docstring is not in the correct
    format. The worse you risk by using it is not to find any documentation for
    a given arg, or to retrieve other part of the documentation mistakenly
    taken as an arg documentation.

    Args:
        docstring: the documentation of the function.

    Returns:
        A dictionary of argument names with their documentation.
    """

    if docstring is None:
        raise ValueError('Undocumented function')
    # Find the beginning of the paragraph about args.
    args_part = _get_doc_section(docstring, 'Args')
    if not args_part:
        return {}

    # Remove the left blank padding and drop next paragraph if it's contiguous.
    args_lines = _remove_left_padding(
        args_part.strip().split('\n')[1:],
        min_padding=len(args_part) - len(args_part.lstrip()) + 1)
    if not args_lines:
        return {}

    # Join long docs split on multiple lines.
    args_long_lines = []
    for args_line in args_lines:
        if len(args_line) == len(args_line.lstrip()):
            # New arg.
            args_long_lines.append(args_line.strip())
        else:
            args_long_lines[-1] += ' ' + args_line.strip()

    # Create arg dict.
    args_doc = {}
    for args_long_line in args_long_lines:
        parts = args_long_line.split(':', 1)
        if len(parts) != 2:
            continue
        args_doc[parts[0].strip()] = parts[1].strip()

    return args_doc


def _arg_names(func: _FlagableCallable) -> Mapping[str, Any]:
    """Return the tuple of a function's args."""

    return inspect.signature(func).parameters


def _define_flags_args(func: _FlagableCallable, parser: argparse.ArgumentParser) -> None:
    """Define string flags from the name and doc of a function's args."""

    args_doc = parse_args_doc(func.__doc__)
    for func_arg, param_obj in _arg_names(func).items():
        has_default_val = param_obj.default != inspect.Parameter.empty
        parser.add_argument(
            f'--{func_arg}',
            default=param_obj.default if has_default_val else None,
            help=args_doc.get(func_arg),
            required=not has_default_val)


_AType = typing.TypeVar('_AType')


def _exec_from_flags(func: _FlagableCallable, flags: argparse.Namespace) -> List[JsonType]:
    """Execute a function pulling arguments from flags."""

    args: List[str] = []
    for func_arg in _arg_names(func):
        args.append(getattr(flags, func_arg))
    return func(*args)


def importer_main(
        func: _FlagableCallable,
        collection_name: str,
        args: Optional[List[str]] = None,
        out: TextIO = sys.stdout) -> None:
    """Main function for an importer to MongoDB.

    Use this function as the main function in an importer script, e.g.

    if __name__ == "__main__:
      mongo.importer_main(csv2dicts, 'my-collection')

    Args:
        func: the function that computes the list of dict to import in the
            MongoDB collection using arguments given by flags. The name and
            documentation of the args of this function are used to define
            flags. However those args can only be strings.
        collection_name: the name of the collection in which to import the
            values.
        args: commandline args as a list of strings in the sys.argv format or
            None to use sys.argv (mostly to ease testing).

    Flags:
        to_json: when this flag is used all the other mongo flags are ignored
            and nothing is imported to the DB.
        from_json: when this flag is used, all the other importing flags are
            ignored and no data is computed from source, just pulled from the
            json file.
    """

    logging.basicConfig(level='INFO')

    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    _define_flags_args(func, parser)

    parser.add_argument('--to_json', help='Path to the JSON file to save the data in.')
    parser.add_argument('--from_json', help='Path to the JSON file from which to read data.')
    parser.add_argument(
        '--filter_ids',
        help='A regular expression to filter data before importing it. This is '
        'useful to generate fixtures or test data, but it can be dangerous as '
        'it drops the whole collection to replace it only with a subset of it')
    parser.add_argument('--mongo_collection', help='Name of the collection to access.')
    parser.add_argument(
        '--chunk-size', type=int, default=10000, help='Import data in chunks of chunk_size.')
    parser.add_argument(
        '--always_accept_diff', action='store_true',
        help='Skip asking validation of difference between an old and new dataset')

    flags = parser.parse_args(args)

    importer = Importer(flags, out=out)
    check_error: Optional[Exception] = None

    if flags.from_json:
        with open(flags.from_json) as input_file:
            data = json.load(input_file)
    else:
        try:
            data = _exec_from_flags(func, flags)
        except InvalidValueError as error:
            data = error.invalid_value
            check_error = error

    if flags.filter_ids:
        match_id = re.compile(flags.filter_ids)
        data = [
            document for document in data
            if match_id.match(document.get('_id', ''))]

    if flags.to_json:
        with open(flags.to_json, 'w') as output_file:
            json.dump(
                data, output_file,
                indent=1, sort_keys=True, ensure_ascii=False)
            # End the file with a new line.
            output_file.write('\n')
    else:
        importer.import_in_collection(data, collection_name, check_error)


_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def collection_to_proto_mapping(collection: Iterable[JsonType], proto_type: Type[_ProtoType]) \
        -> Iterator[Tuple[Any, _ProtoType]]:
    """Iterate over a Mongo collection parsing documents to protobuffers.

    Args:
        collection: A list of dict fetched with pymongo.
        proto_type: the type of the proto messages.

    Yields:
        a tuple with the ID of the proto, and the value.

    Raises:
        json_format.ParseError: if one of the dict doesn't match the proto
            type.
        KeyError: if an ID is found more than once.
    """

    ids: Set[Any] = set()
    for document in collection:
        document_id = document['_id']
        del document['_id']

        if document_id in ids:
            raise KeyError(f'{document_id} is a duplicate')
        ids.add(document_id)
        yield document_id, parse_doc_to_proto(document, proto_type)


def parse_doc_to_proto(document: JsonType, proto_type: Type[_ProtoType]) -> _ProtoType:
    """Parse a single proto from a document."""

    proto = proto_type()
    to_delete = [k for k in document if k.startswith('_')]
    for k in to_delete:
        del document[k]
    try:
        json_format.Parse(json.dumps(document), proto)
    except json_format.ParseError as error:
        raise json_format.ParseError(
            f'Error while parsing item {id}: {error}\n{json.dumps(document, indent=2)}')
    return proto


def _compute_diff(
        list_a: List[JsonType],
        list_b: List[JsonType],
        key: str = '_id') -> Dict[Any, Any]:
    dict_a = collections.OrderedDict((value.get(key), value) for value in list_a)
    dict_b = collections.OrderedDict((value.get(key), value) for value in list_b)

    return _compute_dict_diff(dict_a, dict_b)


def _compute_dict_diff(
        dict_a: Dict[Any, Any],
        dict_b: Dict[Any, Any]) -> Dict[Any, Any]:
    diff: Dict[Any, Any] = collections.OrderedDict()

    for a_key, a_value in dict_a.items():
        if a_key not in dict_b:
            diff[a_key] = 'removed'
            continue
        b_value = dict_b[a_key]
        if a_value != b_value:
            if isinstance(a_value, dict) and isinstance(b_value, dict):
                diff[a_key] = _compute_dict_diff(a_value, b_value)
            else:
                diff[a_key] = {'before': a_value, 'after': b_value}

    for b_key, b_value in dict_b.items():
        if b_key not in dict_a:
            diff[b_key] = {'added': b_value}

    return diff
