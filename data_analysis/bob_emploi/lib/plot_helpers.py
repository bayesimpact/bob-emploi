"""Helper functions to make plots in notebooks prettier and more convenient."""


def add_bar_labels(axis, label_func, vertical=False):
    """Helper method to make bar graphs awesome."""
    for patch in axis.patches:
        if vertical:
            pos = (patch.get_x(), patch.get_y() + patch.get_height())
            offset = (-4, 5)
        else:
            pos = (patch.get_x() + patch.get_width(), patch.get_y())
            offset = (5, 0)

        axis.annotate(label_func(patch), pos, offset,
                      textcoords='offset points')


def groups_of_at_least_n(data_frame, col, group_size):
    """Handy for limiting number of bars plotted."""
    by_columns = data_frame.groupby(col)
    return by_columns.filter(lambda x: len(x) > group_size).groupby(col)


def hist_in_range(series, min_value=None, max_value=None, bins=50):
    """Display histogram of values in a given range.

    Arguments:
        series: pd.Series to compute the histogram on.
        min_value: Minimum value in series to be used.
        max_value: Maximum value in series to be used.
    Returns: The axes object of the plot.
    """
    min_value = min_value or series.min()
    max_value = max_value or series.max()
    plot_range = (series >= min_value) & (series <= max_value)
    range_perc = plot_range.sum() / series.count() * 100
    print('{:.2f}% of values in range'.format(range_perc))
    return series[plot_range].hist(bins=bins)
