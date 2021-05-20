"""Module to ease interaction with MongoDB."""

import argparse
import collections
import datetime
import inspect
import itertools
import json
import logging
import os
import re
import sys
import time
import typing
from typing import Any, Callable, Dict, Iterable, Iterator, List, Mapping, NoReturn, Optional, \
    Set, TextIO, Tuple, Type, Union

import pymongo
from pymongo import collection as pymongo_collection
from pymongo import errors as pymongo_errors
import requests
import tqdm

from google.protobuf import json_format
from google.protobuf import message

from bob_emploi.data_analysis.lib import batch

_TQDM_OUTPUT = sys.stdout

_GET_NOW = datetime.datetime.now

# Get mongo URL from the environment.
_MONGO_URL = os.getenv('MONGO_URL') or ''

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_IMPORT_URL = os.getenv('SLACK_IMPORT_URL')

JsonType = Dict[str, Any]
_FlagableCallable = Callable[..., Iterable[JsonType]]


_T = typing.TypeVar('_T')


class InvalidValueError(typing.Generic[_T], ValueError):
    """A value error that holds the invalid value."""

    def __init__(self, value: _T, msg: Optional[str] = None) -> None:
        super(InvalidValueError, self).__init__(msg)
        self.invalid_value = value


class Importer:
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
            items: Iterable[JsonType],
            collection_name: str,
            count_estimate: Optional[int] = None,
            check_error: Optional[Exception] = None) -> None:
        """Import items in a MongoDB collection."""

        real_collection = self._collection_from_flags(collection_name)
        has_old_data = bool(real_collection.estimated_document_count())

        items_list: List[JsonType] = []
        if count_estimate is None:
            items_list = list(items)
            total = len(items_list)
        else:
            total = count_estimate

        if items_list and has_old_data:
            has_diff_to_review, has_diff = self.print_diff(items_list, real_collection)
        else:
            has_diff_to_review, has_diff = False, True

        if check_error:
            raise check_error

        if not has_diff:
            return

        if self.flag_values.fail_on_diff:
            self._print_in_report('There are some diffs to import.')
            raise ValueError('There are some diffs to import.')

        if has_diff_to_review and not self.approve_diff():
            return

        unique_suffix = f'_{round(time.time() * 1e6):x}'
        collection = self._collection_from_flags(collection_name, suffix=unique_suffix)
        collection.drop()
        collection = collection.database.get_collection(collection.name)
        chunk_size = self.flag_values.chunk_size
        try:
            # Splitting in chunk is only done to display progress, as pymongo
            # already cut it in small pieces:
            # https://api.mongodb.com/python/current/examples/bulk.html
            if not chunk_size or chunk_size >= total:
                self._print_in_report(f'Inserting all {total:d} objects at once.')
                try:
                    all_items = list(items) if count_estimate else items_list
                    collection.insert_many(all_items)
                except pymongo_errors.BulkWriteError as error:
                    self._print_in_report(error.details)
                    raise
            else:
                self._print_in_report(f'Inserting {total:d} objects in chunks of {chunk_size}')
                with tqdm.tqdm(None, total=total, file=_TQDM_OUTPUT) as progress_bar:
                    for chunk in batch.batch_iterator(items, chunk_size):
                        try:
                            collection.insert_many(chunk)
                            progress_bar.update(len(chunk))
                        except pymongo_errors.BulkWriteError as error:
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


def _define_flags_args(
        func: _FlagableCallable, parser: argparse.ArgumentParser,
        extra_args: Mapping[str, str]) -> None:
    """Define string flags from the name and doc of a function's args."""

    args_doc = parse_args_doc(func.__doc__)
    for func_arg, param_obj in _arg_names(func).items():
        if func_arg in extra_args:
            continue
        has_default_val = param_obj.default != inspect.Parameter.empty
        parser.add_argument(
            f'--{func_arg}',
            default=param_obj.default if has_default_val else None,
            help=args_doc.get(func_arg),
            required=not has_default_val)


_AType = typing.TypeVar('_AType')


def _exec_from_flags(
        func: _FlagableCallable, flags: argparse.Namespace,
        extra_args: Mapping[str, str]) -> Iterable[JsonType]:
    """Execute a function pulling arguments from flags."""

    kwargs: Dict[str, str] = {}
    for func_arg in _arg_names(func):
        if func_arg in extra_args:
            kwargs[func_arg] = extra_args[func_arg]
            continue
        kwargs[func_arg] = getattr(flags, func_arg)
    return func(**kwargs)


def importer_main(
        func: _FlagableCallable,
        collection_name: str,
        args: Optional[List[str]] = None,
        count_estimate: Optional[int] = None,
        out: TextIO = sys.stdout) -> None:
    """Main function for an importer to MongoDB.

    Use this function as the main function in an importer script, e.g.

    if __name__ == "__main__:
      mongo.importer_main(csv2dicts, 'my-collection')

    Args:
        func: the function that computes the list (or iterator) of dicts to import in the
            MongoDB collection using arguments given by flags. The name and
            documentation of the args of this function are used to define
            flags. However those args can only be strings.
        collection_name: the name of the collection in which to import the
            values.
        args: commandline args as a list of strings in the sys.argv format or
            None to use sys.argv (mostly to ease testing).
        count_estimate: When the importer function outputs an iterator, this is an estimate of the
            length of the iterator. If it's kept as None (default), the algorithm assumes that the
            output can be handled as a list, so it allows diff with previous import, but forbids
            streams of many documents.

    Flags:
        to_json: when this flag is used all the other mongo flags are ignored
            and nothing is imported to the DB.
        from_json: when this flag is used, all the other importing flags are
            ignored and no data is computed from source, just pulled from the
            json file.
    """

    logging.basicConfig(level='INFO')

    extra_args = {'collection_name': collection_name}

    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    _define_flags_args(func, parser, extra_args)

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
    parser.add_argument(
        '--fail_on_diff', action='store_true',
        help='Fail if there are differences between the old and the new datasets')
    parser.add_argument(
        '--check-args', action='store_true', help='Only check that the args are valid.')

    flags = parser.parse_args(args)

    if flags.check_args:
        # The script was only called to check that the call above to parse_args did not fail.
        return

    if flags.mongo_collection:
        extra_args['collection_name'] = flags.mongo_collection

    importer = Importer(flags, out=out)
    check_error: Optional[Exception] = None

    if flags.from_json:
        with open(flags.from_json) as input_file:
            # TODO(cyrille): Fix data type to Iterable[JsonType].
            data = json.load(input_file)
    else:
        try:
            data = _exec_from_flags(func, flags, extra_args)
        except InvalidValueError as error:
            data = error.invalid_value
            check_error = error

    if flags.filter_ids:
        match_id = re.compile(flags.filter_ids)
        data = (
            document for document in data
            if match_id.match(document.get('_id', '')))

    if flags.to_json:
        with open(flags.to_json, 'w') as output_file:
            json.dump(
                data, output_file,
                indent=1, sort_keys=True, ensure_ascii=False, cls=_IterEncoder)
            # End the file with a new line.
            output_file.write('\n')
    else:
        importer.import_in_collection(data, collection_name, count_estimate, check_error)


class _IterableAsList(List[_AType]):
    """Used to trick JSON encoder (dump) into serializing iterators."""

    # pylint: disable=super-init-not-called
    def __init__(self, iterable: Iterable[_AType]) -> None:
        self.iterator = iter(iterable)
        try:
            self.firstitem = next(self.iterator)
            self.truthy = True
        except StopIteration:
            self.truthy = False

    def __iter__(self) -> Iterator[_AType]:
        if not self.truthy:
            return iter([])
        return itertools.chain([self.firstitem], self.iterator)

    def __len__(self) -> NoReturn:
        raise NotImplementedError('Iterable as list has unknown length')

    def __getitem__(self, item: Union[int, slice]) -> NoReturn:
        raise NotImplementedError('Iterable as list has no getitem')

    def __setitem__(self, item: Union[int, slice], value: Any) -> NoReturn:
        raise NotImplementedError('Iterable as list has no setitem')

    def __bool__(self) -> bool:
        return self.truthy


class _IterEncoder(json.JSONEncoder):
    """
    JSON Encoder that encodes iterators as well.
    Write directly to file to use minimal memory
    """

    def default(self, o: Any) -> Any:
        if isinstance(o, collections.abc.Iterable):
            return _IterableAsList(o)
        return super().default(o)


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
        json_format.ParseDict(document, proto)
    except json_format.ParseError as error:
        raise json_format.ParseError(
            f'Error while parsing item {id}: {error}\n{json.dumps(document, indent=2)}')
    return proto


def _compute_diff(
        list_a: List[JsonType],
        list_b: List[JsonType],
        key: str = '_id') -> Dict[Any, Any]:
    dict_a = collections.OrderedDict((str(value.get(key)), value) for value in list_a)
    dict_b = collections.OrderedDict((str(value.get(key)), value) for value in list_b)

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
