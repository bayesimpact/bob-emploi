"""This script runs features notebooks and reports exceptions.

Usage: `notebook_runner.py foo.ipynb bar.ipynb` for checking
        a specific file(s) in notebooks/features.
        `notebook_runner.py path/to/folder` for checking all ipython notebooks
        in this folder.

It will ignore any notebook that contains any of the words defined in SKIPWORDS
within its first cell. To exclude a notebook from being run be the tester, add

`Skip the run test [because optional explanation]`

on a single line to the first cell of a notebook.

The script will print a message for each file.
"""

import glob
import os
import sys
import typing

import nbformat
from runipy import notebook_runner
import termcolor


IPYTHON_NOTEBOOK_VERSION = 3


def main() -> None:
    """Main function to run notebooks from the command line."""

    if len(sys.argv) == 1:
        print(__doc__)
        sys.exit(1)

    if os.path.isdir(sys.argv[1]):
        notebooks_path = os.path.join(sys.argv[1], '**', '*.ipynb')
        filelist = glob.glob(notebooks_path, recursive=True)
        print('Running {:d} files'.format(len(filelist)))
        run_notebook_list(filelist)
    else:
        run_notebook_list(sys.argv[1:])


def run_notebook_list(filelist: typing.Iterable[str]) -> None:
    """Execute all notebooks given as a list of files."""

    for notebook_path in filelist:
        notebook = _load_notebook(notebook_path)
        if _test_should_be_skipped(notebook):
            # TODO: Print the skip reason.
            print('Skipping ' + notebook_path)
            continue
        try:
            _run_notebook(notebook, notebook_path)
            message = ' {} ✔.'.format(notebook_path)
            print(termcolor.colored(message, 'green'))
        except notebook_runner.NotebookError as error:
            print(error)
            message = ' {} 𝗫.'.format(notebook_path)
            print(termcolor.colored(message, 'red'))


def _run_notebook(notebook: typing.Dict[str, typing.Any], notebook_path: str) -> None:
    working_dir = os.path.dirname(notebook_path)
    runner = notebook_runner.NotebookRunner(notebook, working_dir=working_dir)
    runner.run_notebook()


def _test_should_be_skipped(notebook: typing.Dict[str, typing.Any]) -> bool:
    cells = notebook['worksheets'][0].get('cells', [])
    if not cells:
        return True
    comment_cell = cells[0].get('source', '')
    for line in comment_cell.split('\n'):
        if line.startswith('Skip the run test'):
            return True
    return False


def _load_notebook(notebook_path: str) -> typing.Dict[str, typing.Any]:
    with open(notebook_path) as notebook_file:
        return typing.cast(
            typing.Dict[str, typing.Any], nbformat.read(notebook_file, IPYTHON_NOTEBOOK_VERSION))


if __name__ == '__main__':
    main()
