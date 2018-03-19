"""TODO: add docstring."""

# Average number of days per month.
DAYS_PER_MONTH = 30.5
_QUANTILES = {'min': 0.35, 'median': 0.5, 'max': 0.65}


def unemployment_estimation(duration):
    """TODO: add docstring."""

    quantiles_values = list(_QUANTILES.values())
    quantiles = duration.quantile(quantiles_values)
    estimation = {}
    for name, quantile in _QUANTILES.items():
        estimation['{}Days'.format(name)] = int(quantiles.loc[quantile])
    return finalize_duration_estimation(estimation)


def finalize_duration_estimation(estimation):
    """Finalize the data for a DurationEstimation proto.

    Args:
        estimation: a dict with min/max/medianDays. This dict will be modified.

    Returns:
        The input dict with additional fields to be displayed.
    """

    estimation['shortText'] = '{:d} mois'.format(
        round(estimation['medianDays'] / DAYS_PER_MONTH))
    return estimation
