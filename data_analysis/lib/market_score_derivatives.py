"""Helper functions for building fields in local stats or job group info related to market score.

All the functions here take a dataframe as first argument, with the following columns:
- job_group the ROME/SOC ID that is relevant to the market score
TODO(cyrille): Replace with area_id.
- district_id an ID of the geographic district (county, departement, ...)
    where the market score is relevant
- local_id = <district_id>:<job_group>
- market_score an integer value that describes the market stress in the given job and district.
    smaller values mean a more stressed market.
"""

import itertools
import typing
from typing import Any, Dict, Iterator, List, Optional, TypedDict

import pandas as pd


class _BetterMarket(TypedDict):
    target_job_group: str
    market_score_target: int


def _less_stressful_job_groups(
        job_group_prefix: str, market_scores: pd.DataFrame, career_jumps: pd.DataFrame) \
        -> Dict[str, List[_BetterMarket]]:
    """Compute the less stressful job groups locally.

    Assumes market_scores has columns 'Area', 'local_id', 'job_group' and 'market_score'.
    """

    career_jumps = career_jumps[career_jumps.job_group.str.startswith(job_group_prefix)]
    all_changes = career_jumps\
        .merge(market_scores, on='job_group')\
        .merge(
            market_scores[['job_group', 'market_score', 'district_id']],
            left_on=['target_job_group', 'district_id'], right_on=['job_group', 'district_id'],
            suffixes=('', '_target'))
    local_stats = \
        all_changes[all_changes.market_score * 1.5 < all_changes.market_score_target]\
        .sort_values('market_score_target', ascending=False)[[
            'local_id', 'market_score_target', 'target_job_group']]\
        .groupby(['local_id'])\
        .apply(lambda x: x[:5].to_dict(orient='records'))
    return typing.cast(Dict[str, List[_BetterMarket]], local_stats.to_dict())


def local_diagnosis(
        market_score_frame: pd.DataFrame,
        career_jumps: Optional[pd.DataFrame] = None, prefix_length: int = 0,
        job_group_names: Optional[Dict[str, str]] = None) \
        -> Iterator[Dict[str, Any]]:
    """Add the lessStressfulJobGroups and numLessStressfulDepartements to the local diagnosis.

    career_jumps is a DataFrame with columns 'job_group', 'target_job_group'.
    prefix_length is a cursor to avoid doing joins on large table. Smaller values use more memory,
        but less time.
    """

    local_stats = market_score_frame[[
        'market_score', 'job_group', 'district_id', 'local_id']]\
        .sort_values(['job_group', 'market_score'], ascending=False)
    local_stats['numLessStressfulDepartements'] = local_stats\
        .groupby(['job_group'])\
        .cumcount()
    for job_group_prefix, markets in itertools.groupby(
            local_stats.itertuples(),
            lambda market: typing.cast(str, market.job_group[:prefix_length])):
        better_job_groups = _less_stressful_job_groups(
            job_group_prefix, local_stats, career_jumps) if career_jumps is not None else {}
        for market in markets:
            yield {
                '_id': market.local_id,
                'imt': {
                    'yearlyAvgOffersPer10Candidates': market.market_score,
                },
                'lessStressfulJobGroups': [{
                    'jobGroup': {
                        'romeId': jg['target_job_group'],
                        'name':
                        job_group_names.get(jg['target_job_group'], '') if job_group_names else '',
                    },
                    'mobilityType': 'CLOSE',
                    'localStats': {
                        'imt': {'yearlyAvgOffersPer10Candidates': jg['market_score_target']},
                    },
                } for jg in better_job_groups.get(market.local_id, [])],
                'numLessStressfulDepartements': market.numLessStressfulDepartements,
            }


def _zero_to_minus_one(val: int) -> int:
    return val if val else -1


def get_less_stressful_districts(market_scores: pd.DataFrame, max_districts: int = 0) \
        -> pd.Series:
    """Create a list of the best districts by job group, market-wise.

    Returns a Series indexed by job groups, with array values.
    """

    scores = market_scores.sort_values(['job_group', 'market_score'], ascending=False)

    return pd.Series({
        job_group: [{
            'departementId': local_market.district_id,
            'localStats': {'imt': {
                'yearlyAvgOffersPer10Candidates':
                _zero_to_minus_one(local_market.market_score),
            }},
        } for local_market in (
            itertools.islice(markets, max_districts) if max_districts else markets)]
        for job_group, markets in itertools.groupby(
            scores.itertuples(), lambda t: typing.cast(str, t.job_group))})
