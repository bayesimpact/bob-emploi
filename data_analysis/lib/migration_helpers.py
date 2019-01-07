"""helper functions for migrating data into the postgres database."""

import csv
import glob
import itertools
import logging
import typing

import pandas as pd
from sas7bdat import SAS7BDAT

_LOGGER = logging.getLogger('alembic')


def flatten_iterator(files_pattern: str) -> typing.Iterator[typing.Dict[str, str]]:
    """Iterate over all FHS files as if they were one big file.

    It iterates through the file and yields each result separately. It adds an
    extra field at the end '__file__' which contains the filename from which the
    record was extracted.

    Args:
        files_pattern: a glob pattern for the files to flatten. They should all
            have the same schema. Must end with .csv or .sas7bdat.

    Yields:
        each record as a dict using the headers as keys.
    """

    files = glob.glob(files_pattern)
    if not files:
        raise ValueError('No files found matching {}'.format(files_pattern))

    headers = None

    print('Flattening {:d} files'.format(len(files)))

    for current_file in sorted(files):
        reader = None
        if files_pattern.endswith('sas7bdat'):
            reader = SAS7BDAT(current_file).readlines()
        elif files_pattern.endswith('csv'):
            reader = csv.reader(open(current_file))
        else:
            raise ValueError(
                'Can only process .csv and .sas7bdat files. Got pattern {}'
                .format(files_pattern))
        header_line = next(reader)
        if headers is None:
            headers = header_line + ['__file__']
        elif headers[:-1] != header_line:
            raise ValueError(
                "Headers from file {} don't match those of previous "
                'files. Was expecting:\n{}\n  got:\n{}'
                .format(
                    current_file,
                    headers[:-1],  # pylint: disable=unsubscriptable-object
                    header_line))
        for line in reader:
            yield dict(zip(headers, line + [current_file]))


def sample_data_frame(
        files_pattern: str, sampling: int = 100, seed: int = 97,
        limit: typing.Optional[int] = None) -> pd.DataFrame:
    """Create a pandas.DataFrame from a sample of a full FHS table.

    Args:
        files_pattern: a glob pattern for the files to flatten. They should all
            have the same schema.
        sampling: we examine 1 out of N jobseekers only (sampling using
            the mod of the person's index).
        seed: we will get only the values that are equal to seed modulo
            sampling.
        limit: if set, overrides sampling, and only take the first rows.

    Returns:
        a pandas.DataFrame.
    """

    seed = seed % sampling
    iterator = flatten_iterator(files_pattern)
    columns = next(iterator)
    if limit:
        data = [r for r in itertools.islice(iterator, limit)]
    else:
        data = [r for r in iterator if float(r['IDX']) % sampling == seed]
    return pd.DataFrame(data, columns=columns)


def transform_categorial_vars(
        data_frame: pd.DataFrame, codebook_or_path: typing.Union[pd.DataFrame, str]) \
        -> pd.DataFrame:
    """Transform coded categorial variables to human readable values.

    Many variables contain short codes and the explanation of it's meaning
    has to be extracted from the data dictionary. To make working with the
    data simpler, I copied the mappings from the data dicionary into
    spreadsheets that can be used for automated tranformation.
    """

    _LOGGER.info('transforming categorials')
    data_frame = data_frame.copy()

    codebook: pd.DataFrame
    if isinstance(codebook_or_path, str):
        codebook = pd.read_excel(codebook_or_path, sheet_name=None)
    else:
        codebook = codebook_or_path

    for varname, mapping in codebook.items():
        mapping[varname] = mapping[varname].astype(str)
        for postfix in ['_english', '_french']:
            col_name = varname + postfix
            mapping_dict = mapping.set_index(varname).to_dict()[col_name]
            data_frame[col_name] = data_frame[varname].map(mapping_dict)
    return data_frame
