"""TODO: add docstring."""

import typing

import pandas

# Average number of days per month.
DAYS_PER_MONTH = 30.5
_QUANTILES = {'min': 0.35, 'median': 0.5, 'max': 0.65}


def unemployment_estimation(duration: pandas.DataFrame) -> typing.Dict[str, typing.Union[str, int]]:
    """TODO: add docstring."""

    quantiles_values = list(_QUANTILES.values())
    quantiles = duration.quantile(quantiles_values)
    estimation: typing.Dict[str, typing.Union[str, int]] = {}
    for name, quantile in _QUANTILES.items():
        estimation['{}Days'.format(name)] = int(typing.cast(float, quantiles.loc[quantile]))
    return finalize_duration_estimation(estimation)


def finalize_duration_estimation(estimation: typing.Dict[str, typing.Union[str, int]]) \
        -> typing.Dict[str, typing.Union[str, int]]:
    """Finalize the data for a DurationEstimation proto.

    Args:
        estimation: a dict with min/max/medianDays. This dict will be modified.

    Returns:
        The input dict with additional fields to be displayed.
    """

    estimation['shortText'] = '{:d} mois'.format(
        round(typing.cast(int, estimation['medianDays']) / DAYS_PER_MONTH))
    return estimation
