# encoding: utf-8
"""Module to compute salary-based recommendations using 1 - CDF (CDF =
Cumulative Distribution Function).
Design doc : https://docs.google.com/document/d/1WjyjxYOzC0_98ULXVr4nsmGwcDsN2qm-sXuTb__1nkE

The recommendation can be summed up in several steps:
Step 1 : Check for each available salaries, how many offers we would have
    access to if we would decrease our salary by X% (X = 1, 2, .., 10)
Step 2 : Compute a maping : salary -> how many offers with -1%, -2%, -X% ...

Then we got two approaches:
    Approach 1 (compute_recommendation_cdf):
        We select the best recommendation for each salary i.e. the one that produce the best raise
            in job offers for a percent decrease in salary.
        Returns : [(from_salary=18000, salary_decrease='1percent_salary_decrease'),
         (from_salary=19000, salary_decrease='5percent_salary_decrease'),
         (from_salary=20000, salary_decrease='1percent_salary_decrease'), ..].
        NOTE: '1percent_salary_decrease' means that decreasing the salary of 1 percent is
        the best option.

    Approach 2 (compute_recommendation_score):
        We compute a score for each salary decrease and select the one that maximizes the latter.
        The score is : sqrt(delta(O))/delta(S), with 'delta(O)' the variation of number of offers
        and 'delta(S)' the respective variation of salary.
        Returns : [(from_salary=18000, gained_offers=0.33), (from_salary=19000, gained_offers=0.25),
        (from_salary=20000, gained_offers=0.26), ..].
        NOTE: (from_salary=18000, gained_offers=0.33) means that from salary 18000, the best
        recommendation will increase job offers of +33%.
"""
import collections
import numpy as np
import pandas as pd

_MAX_SALARY_DECREASE_CDF = 10
_RecoScore = collections.namedtuple('RecoScore', ['from_salary', 'gained_offers'])
_RecoCDF = collections.namedtuple('RecoCDF', ['from_salary', 'salary_decrease'])


def compute_recommendation_cdf(table_offers):
    """Approach 1: compute the salary recommendation based on the CDF, it was designed to be
    called in a groupby.

    Args:
        table_offers: pandas Dataframe containing every offers of
        a single job group.

    Returns:
        a list of namedtuple containing each recommendations in a way that is easy
        to look-up for value. e.g.:
        [(from_salary=18000, salary_decrease='1percent_salary_decrease'),
        (from_salary=19000, salary_decrease='5percent_salary_decrease'), ...]
    """
    # Step 1.
    num_offers_per_salary = _compute_job_offers_salary(table_offers)
    # Step 2.
    all_percent_decrease = _compute_percent_decrease(
        num_offers_per_salary,
        max_salary_decrease=_MAX_SALARY_DECREASE_CDF)
    # Step 3a.
    comparing_reco = _compute_comparing_reco(all_percent_decrease)
    # Compute the best recommendation we can get for each salary.
    top1reco = comparing_reco[comparing_reco > 0].idxmax(axis=1)
    top1reco.fillna('no better alternative', inplace=True)
    # Store recommendations in a list of tuple.
    top1reco.sort_index(inplace=True, ascending=True)
    reco_as_namedtuple = top1reco.loc[top1reco.shift(1) != top1reco].reset_index().apply(
        _RecoCDF._make, axis=1)

    return reco_as_namedtuple.tolist()


def compute_recommendation_score(table_offers):
    """Approach 2: compute the salary recommendation based on the score sqrt(delta(O))/delta(S),
     it was designed to be called in a groupby.

    Args:
        table_offers: pandas Dataframe containing every offers of a single job group.

    Returns:
        a list of namedtuple containing each recommendations in a way that is easy
        to look-up for value. e.g.: [(from_salary=18000, gained_offers=0.25),
        (from_salary=19000, gained_offers=0.15), (from_salary=20000, gained_offers=0.05), ..]
    """
    num_offers_with_higher_salary = _compute_job_offers_salary(table_offers)
    cumul_offers = num_offers_with_higher_salary.reset_index()

    def _scoring(idx):
        return _apply_score(cumul_offers, idx)

    cumul_offers['gained_offers'] = pd.DataFrame(cumul_offers.reset_index()['index'].map(_scoring))

    reco_as_namedtuple = cumul_offers[['annual_minimum_salary', 'gained_offers']].apply(
        _RecoScore._make, axis=1)

    return reco_as_namedtuple.tolist()


def _compute_job_offers_salary(table_offers):
    """Compute a pandas Series containing the amount of jof offers available
    for every salary (cumulative count). It relies on the hypothesis that you
    have access to every offers that propose a salary equal or above
    your actual salary.
    (Step 1)

    Args:
        table_offers: pandas Dataframe containing every offers of a single job group.

    Returns:
        Pandas Series containing the amount of job offers (value) by salary (index).
    """
    initial_salary = table_offers.copy()
    initial_salary.sort_values('annual_minimum_salary', inplace=True)
    initial_salary.reset_index(drop=True, inplace=True)
    # Cumulative counts.
    initial_salary.index.rename('num_offers_with_lower_salary', inplace=True)
    initial_salary.reset_index(inplace=True)
    initial_salary.set_index('annual_minimum_salary', inplace=True)
    initial_salary['num_offers_with_higher_salary'] = (
        len(initial_salary) - initial_salary.num_offers_with_lower_salary)
    # Necessary for identical salaries.
    initial_salary = initial_salary.groupby(initial_salary.index).max()

    return initial_salary.num_offers_with_higher_salary


def _compute_percent_decrease(num_offers_per_salary, max_salary_decrease):
    """Compute dataframe with all percent decreases until max_salary_decrease.
    (Step 2)

    Args:
        num_offers_per_salary: Pandas Series containing the amount of job offers (value)
            by salary (index)
        max_salary_decrease (int.): maximal amount of percent you agree to decrease
            your salary from.
    Returns:
        Pandas dataframe containing the amount of job offers available for each salary decrease
            from initial (columns) and for each salary (index).
    """
    percent_decreases = ((i + 1) / 100 for i in range(max_salary_decrease))
    all_percent_decreases = pd.DataFrame(num_offers_per_salary)

    for percent_decrease in percent_decreases:
        salary_offers = num_offers_per_salary.copy()
        # to get the amount of offers if we would decrease the salary by
        # percent_decrease%.
        salary_offers.index /= (1 - percent_decrease)
        salary_offers.index.name = '%dpercent_decrease' % round(percent_decrease * 100)
        salary_offers.name = '%dpercent_salary_decrease' % round(percent_decrease * 100)
        percent_decrease_df = pd.DataFrame(salary_offers)
        all_percent_decreases = pd.merge(
            all_percent_decreases,
            percent_decrease_df,
            right_index=True,
            left_index=True,
            how='outer')
    # Salaries are not aligned, so we backfill all NaN to get value for
    # every salaries.
    all_percent_decreases.fillna(method='backfill', inplace=True)
    # + fillna(0) when no offers are available (tail).
    all_percent_decreases.fillna(0, inplace=True)

    return all_percent_decreases


def _compute_comparing_reco(all_percent_decreases):
    """Calculate percentage of change in offers between salary variation.
    (Step 3a)

    Args:
        all_percent_decreases: Pandas dataframe containing the amount of job offers available
        for each salary decreases from initial (columns) and for each salary (index).

    Returns:
        a Pandas DataFrame containing the percentage of change in offers
        between each salary variation.
        """
    comparing_reco = all_percent_decreases.transpose().apply(
        lambda x: x.pct_change(1), axis=0).transpose()
    comparing_reco.replace([np.inf, -np.inf], np.nan, inplace=True)

    return comparing_reco


def _apply_score(num_offers_with_higher_salary, idx):
    """ Calculate a score for each salary of table_offers, maximize it and return the amount of
    gained offers for the optimal decrease of salary.

    Args:
        num_offers_with_higher_salary: Pandas Series containing the amount of job offers (value)
            by salary (index).
        idx: the index of the salary on which to compute the score.

    Returns:
        Gained offers (Float.)
    """
    # Cumulative count.
    cumul_offers = num_offers_with_higher_salary.reset_index()
    if idx == 0:
        return 0
    delta_salaries = _compute_delta_from_index(cumul_offers.annual_minimum_salary, idx)
    delta_offers = _compute_delta_from_index(cumul_offers.num_offers_with_higher_salary, idx)
    # Compute score.
    scores = _compute_score(delta_offers, delta_salaries)
    # Best score = max(score).
    idx_max_score = scores.idxmax()
    # Compute results.
    gained_offers = delta_offers.iloc[idx_max_score]

    return gained_offers


def _compute_score(delta_offers, delta_salaries):
    return np.sqrt(delta_offers) / delta_salaries


def _compute_delta_from_index(serie, index):
    """ Compute the variations on a specific serie and from a specific index"""
    return serie.iloc[:index] / serie.iloc[index] - 1
