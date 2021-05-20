"""Manipulate release notes from Github commits to make them more compact.

Gets its input from stdin, assumed in the following format:
1 line per commit, starting with "[Some subject]" and ending with "(#123456)"

Lines with the same subject will be grouped together, sorted by increasing PR number.

Commits not starting with a subject will be grouped under an empty subject.
"""

import itertools
import re
import sys
from typing import Iterator

# Matches '[Subject]' at start of line.
_SUBJECT_REGEX = re.compile(r'^\[[^\]]+\]')
# Matches '(#123456)' at end of line, and captures the number.
_PR_REGEX = re.compile(r'\(#(\d+)\)$')

_DROPPED_SUBJECTS = [f'[{subject}]' for subject in ['Clean Code', 'Small Fix', 'Easy Dev']]


def _subject_key(line: str) -> str:
    """Get the subject for the line or an empty string."""

    if subject_match := _SUBJECT_REGEX.search(line):
        return subject_match.group()
    return ''


def _pr_key(line: str) -> int:
    """Get the PR number for the line or 0."""

    if pr_match := _PR_REGEX.search(line):
        return int(pr_match.group(1))
    return 0


def compress_notes(notes: Iterator[str]) -> str:
    """Group all commit messages by subject."""

    separator = '\n\t'
    return '\n'.join(
        subject + separator + separator.join(
            line.rstrip()[len(subject):] for line in sorted_lines
        ) if len(sorted_lines := sorted(lines, key=_pr_key)) > 1 else sorted_lines[0].rstrip()
        for subject, lines in itertools.groupby(sorted(notes, key=_subject_key), key=_subject_key)
        if subject not in _DROPPED_SUBJECTS)


if __name__ == '__main__':
    print(compress_notes(sys.stdin))
