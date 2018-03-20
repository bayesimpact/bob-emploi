"""helper functions for migrating data into the postgres database."""

import csv
import glob
import itertools
import logging
import os
import re

import pandas as pd
from sas7bdat import SAS7BDAT

_LOGGER = logging.getLogger('alembic')


def region_iteratior(base_path, file_name):
    """Iterate over all region folders.

    The data we received is split over 26 folders for the individual regions.
    This iterator helps to load a specific data file for each region and to
    extract the region ID from the path.

    base_path -- folder containing the folders for individual regions
    file_name -- which of the 12 files per folder should be loaded
    returns -- iterator of (region_id, DataFrame) tuples
    """

    input_path = os.path.join(base_path, '**', file_name)
    for f_name in glob.glob(input_path):
        region_id = re.search(r'/Reg(\d+)/', f_name).group(1)
        _LOGGER.info('>>> importing data for region %s', region_id)
        _LOGGER.info('reading from SAS file')
        if file_name.endswith('.sas7bdat'):
            data_frame = SAS7BDAT(f_name).to_data_frame()
        elif file_name.endswith('.csv'):
            data_frame = pd.DataFrame.from_csv(f_name)
        else:
            raise ValueError(
                'Expected sas7bdat or csv files only, got {}'.format(file_name))
        yield (region_id, data_frame)


def flatten_iterator(files_pattern):
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


def sample_data_frame(files_pattern, sampling=100, seed=97, limit=None):
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


def transform_categorial_vars(data_frame, codebook_or_path):
    """Transform coded categorial variables to human readable values.

    Many variables contain short codes and the explanation of it's meaning
    has to be extracted from the data dictionary. To make working with the
    data simpler, I copied the mappings from the data dicionary into
    spreadsheets that can be used for automated tranformation.
    """

    _LOGGER.info('transforming categorials')
    data_frame = data_frame.copy()

    codebook = codebook_or_path
    if isinstance(codebook, str):
        codebook = pd.read_excel(codebook_or_path, sheetname=None)

    for varname, mapping in codebook.items():
        mapping[varname] = mapping[varname].astype(str)
        for postfix in ['_english', '_french']:
            col_name = varname + postfix
            mapping_dict = mapping.set_index(varname).to_dict()[col_name]
            data_frame[col_name] = data_frame[varname].map(mapping_dict)
    return data_frame


def transform_ids(data_frame, region_id):
    """Compute a globally unique ID.

    The user IDs from the SAS files are only unique per region. Prefixing
    the IDs by the `region_id` makes them globally unique. I furthermore
    compute an `application_id`, each user can have several applications with
    PE.
    """

    _LOGGER.info('transforming IDs')
    data_frame = data_frame.copy()
    data_frame['user_id'] = (
        region_id + '_' + data_frame.IDX.astype(int).astype(str))
    data_frame.drop(['IDX'], axis=1, inplace=True)
    if 'NDEM' in data_frame.columns:
        # cast to `int` because they are currently floats
        data_frame['application_id'] = (
            data_frame.user_id + '_' + data_frame.NDEM.astype(int).astype(str))
        data_frame.drop(['NDEM'], axis=1, inplace=True)
    return data_frame


def rename_columns(data_frame, rename_dict):
    """Get rid of the cryptic column names.

    Most of the columns from the SAS files have cryptic all caps names. Rename
    all this names and also the 'translations' of transformed categorial
    variables.
    """

    _LOGGER.info('renaming columns')
    data_frame = data_frame.copy()
    rename_dict = rename_dict.copy()
    trans_columns = [
        c for c in data_frame.columns
        if c.endswith('_english') or c.endswith('_french')]
    for trans_column in trans_columns:
        var_name, suffix = trans_column.rsplit('_', 1)
        rename_dict[trans_column] = rename_dict[var_name] + '_' + suffix

    data_frame.rename(columns=rename_dict, inplace=True)
    return data_frame
