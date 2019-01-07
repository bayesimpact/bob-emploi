"""Module to ease interaction with MongoDB."""

import collections
import datetime
import inspect
import json
import re
import sys
import time
import typing

import pymongo
from pymongo import database
import tqdm

from google.protobuf import json_format
from google.protobuf import message

import gflags

_GET_NOW = datetime.datetime.now

JsonType = typing.Dict[str, typing.Any]
_FlagableCallable = typing.Callable[..., typing.List[JsonType]]


# TODO(cyrille): Replace gflags with argparse.
class Importer(object):
    """A helper to import data in a MongoDB collection."""

    def __init__(
            self,
            flag_values: gflags.FlagValues = gflags.FLAGS,
            out: typing.TextIO = sys.stdout) -> None:
        self.flag_values = flag_values
        self.out = out

        gflags.DEFINE_string(
            'mongo_url', None,
            'URL of the mongo server, e.g. mongodb://host:port/database_name.',
            flag_values=flag_values)
        gflags.DEFINE_string(
            'mongo_collection', None, 'Name of the collection to access.',
            flag_values=flag_values)
        gflags.DEFINE_string(
            'chunk_size', '10000', 'Import data in chunks of chunk_size.',
            flag_values=flag_values)

    def _print(self, arg: typing.Any) -> None:
        self.out.write('{}\n'.format(arg))

    def import_in_collection(
            self,
            items: typing.List[JsonType],
            collection_name: str) -> None:
        """Import items in a MongoDB collection."""

        real_collection = self._collection_from_flags(collection_name)
        has_old_data = bool(real_collection.estimated_document_count())

        if has_old_data and not self.review_diff(items, real_collection):
            return

        unique_suffix = '_{:x}'.format(round(time.time() * 1e6))
        collection = self._collection_from_flags(
            collection_name, suffix=unique_suffix)
        collection.drop()
        collection = typing.cast(
            typing.Iterator[JsonType], collection.database.get_collection(collection.name))
        chunk_size = int(self.flag_values.chunk_size or 0)
        total = len(items)
        try:
            # Splitting in chunk is only done to display progress, as pymongo
            # already cut it in small pieces:
            # https://api.mongodb.com/python/current/examples/bulk.html
            if not chunk_size or chunk_size >= total:
                self._print('Inserting all {:d} objects at once.'.format(total))
                collection.insert_many(items)
            else:
                self._print('Inserting {:d} objects in chunks of {}'.format(total, chunk_size))
                for pos in tqdm.tqdm(range(0, total, chunk_size), file=sys.stdout):
                    try:
                        collection.insert_many(items[pos:pos + chunk_size])
                    except pymongo.errors.BulkWriteError as error:
                        self._print(error.details)
                        raise
        except Exception:
            collection.drop()
            raise

        # Archive current content if any.
        if has_old_data:
            today = _GET_NOW().date().isoformat()
            archive_collection = self._collection_from_flags(
                collection_name, suffix='.{}{}'.format(today, unique_suffix))
            real_collection.aggregate([{'$out': archive_collection.name}])
            # Drop old archives (exclude the ones archived today and keep only one additional).
            old_versions = sorted(
                name for name in real_collection.database.list_collection_names()
                if name.startswith(real_collection.name + '.') and
                not name.startswith(real_collection.name + '.{}'.format(today))
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
            collection_name_from_flags: bool = True) -> database.Collection:
        if collection_name_from_flags and self.flag_values.mongo_collection:
            collection_name = self.flag_values.mongo_collection
        client = pymongo.MongoClient(self.flag_values.mongo_url)
        _database = client.get_default_database()
        return typing.cast(
            typing.Iterator[JsonType], _database.get_collection(collection_name + suffix))

    def review_diff(
            self,
            new_list: typing.List[JsonType],
            old_mongo_collection: database.Collection) -> bool:
        """Review the difference between an old and new dataset."""

        if len(new_list) > 1000:
            return True

        old_list = list(old_mongo_collection.find())

        diff = _compute_diff(old_list, new_list)
        if not diff:
            self._print('The data is already up to date.')
            return False

        self._print(json.dumps(diff, indent=2))
        while True:
            answer = input('Do you approve this diff? Y/N ').upper()
            if answer == 'Y':
                return True
            if answer == 'N':
                return False


def _get_doc_section(docstring: str, section_name: str) -> typing.Optional[str]:
    for doc_part in docstring.split('\n\n'):
        if doc_part.strip().startswith(section_name + ':\n'):
            return doc_part
    return None


def _remove_left_padding(lines: typing.List[str], min_padding: int) -> typing.Iterator[str]:
    if not lines:
        return []
    padding = len(lines[0]) - len(lines[0].lstrip())
    if padding < min_padding:
        return []
    for line in lines:
        if len(line) < padding or line[:padding].strip():
            return
        yield line[padding:]


def parse_args_doc(docstring: typing.Optional[str]) -> typing.Dict[str, str]:
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


def _arg_names(func: _FlagableCallable) -> typing.Mapping[str, typing.Any]:
    """Return the tuple of a function's args."""

    return inspect.signature(func).parameters


def _define_flags_args(func: _FlagableCallable, flag_values: gflags.FlagValues) -> None:
    """Define string flags from the name and doc of a function's args."""

    args_doc = parse_args_doc(func.__doc__)
    for func_arg, param_obj in _arg_names(func).items():
        has_default_val = param_obj.default != inspect.Parameter.empty
        gflags.DEFINE_string(
            func_arg,
            param_obj.default if has_default_val else None,
            args_doc.get(func_arg),
            flag_values=flag_values)
        if not has_default_val:
            gflags.MarkFlagAsRequired(func_arg, flag_values=flag_values)


_AType = typing.TypeVar('_AType')


def _exec_from_flags(func: _FlagableCallable, flag_values: gflags.FlagValues) \
        -> typing.List[JsonType]:
    """Execute a function pulling arguments from flags."""

    args: typing.List[str] = []
    for func_arg in _arg_names(func):
        args.append(getattr(flag_values, func_arg))
    return func(*args)


def importer_main(
        func: _FlagableCallable,
        collection_name: str,
        args: typing.Optional[typing.List[str]] = None,
        flag_values: gflags.FlagValues = gflags.FLAGS,
        out: typing.TextIO = sys.stdout) -> None:
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
        flag_values: the flag set to use (mostly to ease testing).

    Flags:
        to_json: when this flag is used all the other mongo flags are ignored
            and nothing is imported to the DB.
        from_json: when this flag is used, all the other importing flags are
            ignored and no data is comupted from source, just pulled from the
            json file.
    """

    gflags.DEFINE_string(
        'to_json', None, 'Path to the JSON file to save the data in.',
        flag_values=flag_values)
    gflags.DEFINE_string(
        'from_json', None, 'Path to the JSON file from which to read data.',
        flag_values=flag_values)
    gflags.DEFINE_string(
        'filter_ids', None,
        'A regular expression to filter data before importing it. This is '
        'useful to generate fixtures or test data, but it can be dangerous as '
        'it drops the whole collection to replace it only with a subset of it',
        flag_values=flag_values)

    importer = Importer(flag_values=flag_values, out=out)
    _define_flags_args(func, flag_values=flag_values)
    if not args:
        args = sys.argv
    flag_values(args)

    if flag_values.from_json:
        with open(flag_values.from_json) as input_file:
            data = json.load(input_file)
    else:
        data = _exec_from_flags(func, flag_values=flag_values)

    if flag_values.filter_ids:
        match_id = re.compile(flag_values.filter_ids)
        data = [
            document for document in data
            if match_id.match(document.get('_id', ''))]

    if flag_values.to_json:
        with open(flag_values.to_json, 'w') as output_file:
            json.dump(
                data, output_file,
                indent=1, sort_keys=True, ensure_ascii=False)
            # End the file with a new line.
            output_file.write('\n')
    else:
        importer.import_in_collection(data, collection_name)


_ProtoType = typing.TypeVar('_ProtoType', bound=message.Message)


def collection_to_proto_mapping(
        collection: database.Collection,
        proto_type: typing.Type[_ProtoType]
) -> typing.Iterator[typing.Tuple[typing.Any, _ProtoType]]:
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

    ids: typing.Set[typing.Any] = set()
    for document in collection:
        document_id = document['_id']
        del document['_id']

        if document_id in ids:
            raise KeyError('{} is a duplicate'.format(document_id))
        ids.add(document_id)
        yield document_id, parse_doc_to_proto(document, proto_type)


def parse_doc_to_proto(document: JsonType, proto_type: typing.Type[_ProtoType]) -> _ProtoType:
    """Parse a single proto from a document."""

    proto = proto_type()
    try:
        json_format.Parse(json.dumps(document), proto)
    except json_format.ParseError as error:
        raise json_format.ParseError(
            'Error while parsing item {}: {}\n{}'.format(
                id, error, json.dumps(document, indent=2)))
    return proto


def _compute_diff(
        list_a: typing.List[JsonType],
        list_b: typing.List[JsonType],
        key: str = '_id') -> typing.Dict[typing.Any, typing.Any]:
    dict_a = collections.OrderedDict((value.get(key), value) for value in list_a)
    dict_b = collections.OrderedDict((value.get(key), value) for value in list_b)

    return _compute_dict_diff(dict_a, dict_b)


def _compute_dict_diff(
        dict_a: typing.Dict[typing.Any, typing.Any],
        dict_b: typing.Dict[typing.Any, typing.Any]) -> typing.Dict[typing.Any, typing.Any]:
    diff: typing.Dict[typing.Any, typing.Any] = collections.OrderedDict()

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
