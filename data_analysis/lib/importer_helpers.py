"""TODO: add docstring."""

import typing
from typing import Union

import pandas

# Average number of days per month.
DAYS_PER_MONTH = 30.5
_QUANTILES = {'min': 0.35, 'median': 0.5, 'max': 0.65}


def unemployment_estimation(duration: pandas.DataFrame) -> dict[str, Union[str, int]]:
    """TODO: add docstring."""

    quantiles_values = list(_QUANTILES.values())
    quantiles = duration.quantile(quantiles_values)
    estimation: dict[str, Union[str, int]] = {}
    for name, quantile in _QUANTILES.items():
        estimation[f'{name}Days'] = int(typing.cast(float, quantiles.loc[quantile]))
    return finalize_duration_estimation(estimation)


def finalize_duration_estimation(estimation: dict[str, Union[str, int]]) \
        -> dict[str, Union[str, int]]:
    """Finalize the data for a DurationEstimation proto.

    Args:
        estimation: a dict with min/max/medianDays. This dict will be modified.

    Returns:
        The input dict with additional fields to be displayed.
    """

    num_month = round(typing.cast(int, estimation['medianDays']) / DAYS_PER_MONTH)
    estimation['shortText'] = f'{num_month:d} mois'
    return estimation
