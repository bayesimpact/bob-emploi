"""Functions to compute optimal buckets on job postings table.
Basically we have a set of buckets we would want if we had enough data.
When it's not the case, we fuse buckets together. Here are the main steps:
1. We count number of offers in each of the buckets we want (OPTIMAL_BUCKETS)
2. We iterate over buckets and where there is not enough offers (< _MIN_PER_BIN)
we fuse bucket with the preceding one.
3. We use a couple of functions to reconstruct the new buckets and get labels
4. We use one last function that give, from one given experience,
the associated bucket.
5. We compute all these steps inside a function, and put this function inside
a closure in order to apply it to the each offers of each job groups.

Warning about 2: if we got only offers requiring 12 months of experience
for instance, we'll have only a [0, 999] bucket (instead of [12, 999]).
It means that we'll still give a reco for a user of 3 months of experience,
even if there is no offer under 12 months of experience. It's a choice.
"""

import typing
from typing import Callable, Iterable, List, Sequence

import pandas as pd

# Boundaries of the experience buckets/bins we would want if we had enough
# data. The values are expressed in number of months.
# e.g. [0, 1[, [1, 6[, ..., [120, 999[
# They match the levels of seniority we ask to users in our app (see
# ProjectSeniority in frontend/server/api/project.proto).
OPTIMAL_BUCKETS = [0, 1, 24, 72, 120, 999]
# At least 10 job offers per buckets.
_MIN_PER_BIN = 10


def create_bucketizer(optimal_buckets: Sequence[int], min_per_bin: int = _MIN_PER_BIN) \
        -> Callable[[pd.DataFrame], pd.DataFrame]:
    """Creates a bucketizer function from experience_min_duration in exp_bucket.

    Args:
        optimal_buckets: boundaries of the experience buckets we would want if
            we had enough data. The values are epxressed in number of months.
        min_per_bin: minimal number of data point per bucket, for smaller
            buckets we try to cluster them.
    Returns:
        A function designed to be used in an apply operation after a groupby:
        it only takes a DataFrame and modifies it before returning it.
    """

    def _apply(table_offers: pd.DataFrame) -> pd.DataFrame:
        t_final_buckets = _apply_optimal_buckets(
            table_offers, optimal_buckets, min_per_bin)

        def _bucketize(experience: int) -> str:
            """Give optimal buckets considering the experience."""

            return _find_bucket_from_exp(t_final_buckets, exp=experience)

        table_offers['exp_bucket'] = table_offers.experience_min_duration.map(
            _bucketize)
        return table_offers

    return _apply


def _apply_optimal_buckets(
        table_offers: pd.DataFrame, optimal_buckets: Sequence[int], min_per_bin: int) \
        -> pd.DataFrame:
    """Find the optimal buckets and return only the bucket label corresponding
    to experience.

    Args:
        table_offers: pandas Dataframe containing every offers of a single
            job group.
        optimal_buckets: list of the bins we want to have
        min_per_bin (int.): minimum wanted offers by buckets

    Returns:
        The bucket label corresponding to exp.
    """

    group_indexes = _merge_buckets_too_small(
        table_offers=table_offers,
        optimal_buckets=optimal_buckets,
        min_per_bin=min_per_bin)

    t_buckets = _intermediary_buckets_table(
        optimal_buckets=optimal_buckets,
        group_indexes=group_indexes)
    t_final_buckets = _compute_final_buckets_table(t_buckets)

    return t_final_buckets


def _count_num_offers_in_bin(table_offers: pd.DataFrame, optimal_buckets: Sequence[int]) \
        -> List[int]:
    """Get the number of offers available considering an experience
    interval.

    Args:
        table_offers: pandas Dataframe containing every offers of
            a single job group.
        optimal_buckets: list of the bins we want to have

    Returns:
        A list containing the number of offers of every buckets
        (extracted from optimal_buckets).
    """

    out = pd.cut(
        table_offers.experience_min_duration,
        bins=optimal_buckets, include_lowest=True, right=False)
    counts = out.value_counts()
    counts = counts.reindex(out.cat.categories)

    return typing.cast(List[int], counts.values.tolist())


def _merge_buckets_too_small(
        table_offers: pd.DataFrame,
        optimal_buckets: Sequence[int],
        min_per_bin: int = _MIN_PER_BIN) -> List[int]:
    """Decide which bucket we need to merge together.

    Args:
        table_offers: pandas Dataframe containing every offers of
            a single job group.
        optimal_buckets: list of the bins we want to have
        min_per_bin (int.): minimum wanted offers by buckets

    Returns:
        list containing bucket ID that should be merged together (same number)
        in order to guarantee at least `min_per_bin` offers in each buckets.
    """

    n_bins = len(optimal_buckets)
    current_group = 0
    group_indexes: List[int] = []
    current_number_of_offers = 0
    num_offers_in_bins = _count_num_offers_in_bin(table_offers, optimal_buckets)
    for num_offer_in_bin in num_offers_in_bins:
        group_indexes.append(current_group)
        current_number_of_offers += num_offer_in_bin

    # If we have enough, we close the bin.
        if current_number_of_offers >= min_per_bin:
            current_group += 1  # change group
            current_number_of_offers = 0  # Reset number of offers.

    # If not enough in last bin, we re-group the last group with the one
    # before.
    if current_number_of_offers < min_per_bin:
        for i in range(n_bins - 1):
            if group_indexes[i] == current_group:
                group_indexes[i] = current_group - 1
    return group_indexes


def _intermediary_buckets_table(
        optimal_buckets: Sequence[int], group_indexes: Iterable[int]) -> pd.DataFrame:
    """Put bins & group_indexes into the same dataframe.

    Args:
        optimal_buckets: list of the bins we want to have
        group_indexes: list containing bins we have to merge together
            (same number)

    Returns:
        pandas dataframe contaning bins, group_indexes and corresponding
        buckets
    """

    dict_bins_buckets = {
        min_bucket: (min_bucket, optimal_buckets[i + 1])
        for i, min_bucket in enumerate(optimal_buckets)
        if i < len(optimal_buckets) - 1
    }
    t_buckets = pd.DataFrame(
        {'buckets': optimal_buckets[:-1], 'group_indexes': group_indexes})
    t_buckets['real_buckets'] = t_buckets.buckets.map(dict_bins_buckets)

    return t_buckets


def _compute_final_buckets_table(t_buckets: pd.DataFrame) -> pd.DataFrame:
    """Compute buckets from bins and construct labels.
    Args:
        t_buckets : pandas dataframe contaning bins, group_indexes
            and corresponding buckets

    Returns:
        a pandas Dataframe containing every buckets and labels.
    """

    final_buckets = t_buckets.groupby('group_indexes')['real_buckets'].aggregate(
        ['min', 'max'])
    final_buckets['LB'] = [x[0] for x in final_buckets['min']]
    final_buckets['UP'] = [y[1] for y in final_buckets['max']]
    final_buckets['bucket_label'] = '[' + \
        final_buckets.LB.astype(str) + ', ' + \
        final_buckets.UP.astype(str) + '['

    return final_buckets[['LB', 'UP', 'bucket_label']]


def _find_bucket_from_exp(final_buckets: pd.DataFrame, exp: int) -> str:
    """Compute buckets from bins and construct labels.

    Args:
        final_bucket: pandas DataFrame contaning every buckets/buckets labels.
        exp (int.): number of month of experience.

    Returns:
        The corresponding labels corresponding to exp.
    """

    exp_mask = (exp >= final_buckets.LB) & (exp < final_buckets.UP)
    bucket_label = typing.cast(str, final_buckets.loc[exp_mask].bucket_label.iloc[0])
    return bucket_label
