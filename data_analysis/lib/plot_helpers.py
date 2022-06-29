"""Helper functions to make plots in notebooks prettier and more convenient."""

import typing
from typing import Any, Callable, Optional, Tuple

import pandas

if typing.TYPE_CHECKING:
    class _MatplotlibPatch(typing.Protocol):
        def get_height(self) -> float:
            """Get height of patch."""

        def get_width(self) -> float:
            """Get height of patch."""

        def get_x(self) -> float:
            """Get X position of patch."""

        def get_y(self) -> float:
            """Get Y position of patch."""

    class _MatplotlibAxesSubplot(typing.Protocol):
        @property
        def patches(self) -> list[_MatplotlibPatch]:
            """List of patches."""

        def annotate(
                self, label: str, pos: Tuple[float, float], offset: Tuple[float, float],
                textcoords: str) -> None:
            """Add an annotation."""


def add_bar_labels(
        axis: '_MatplotlibAxesSubplot',
        label_func: Callable[['_MatplotlibPatch'], str],
        vertical: bool = False) -> None:
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


def groups_of_at_least_n(data_frame: pandas.DataFrame, col: str, group_size: int) \
        -> pandas.core.groupby.generic.DataFrameGroupBy:
    """Handy for limiting number of bars plotted."""

    by_columns = data_frame.groupby(col)
    return by_columns.filter(lambda x: len(x) > group_size).groupby(col)


def hist_in_range(
        series: pandas.Series, min_value: Optional[float] = None,
        max_value: Optional[float] = None, bins: int = 50) \
        -> Any:
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
    print(f'{range_perc:.2f}% of values in range')
    return series[plot_range].hist(bins=bins)
