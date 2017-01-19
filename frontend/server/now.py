"""Wrapper for the datetime builtin module to ease testing."""
import datetime


def get():
    """Returns the current date and time."""
    return datetime.datetime.now()
