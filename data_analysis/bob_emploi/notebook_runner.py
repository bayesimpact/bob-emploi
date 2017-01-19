"""This script runs features notebooks and reports exceptions.

Usage: `checkipnb.py foo.ipynb bar.ipynb` for checking
        a specific file(s) in notebooks/features.
        `checkipnp.py all` for checking all ipython notebooks
        in notebooks/features/
The script will return a message for each file.
"""

import glob
import os
import sys
import termcolor

from runipy.notebook_runner import NotebookRunner
from IPython.nbformat import read
import logging
log = logging.getLogger('youthvillages.notebookcheck')

IPYTHON_NOTEBOOK_VERSION = 3

def _run_notebook(nb):
    r = NotebookRunner(nb)
    r.run_notebook()


def run_notebook_list(filelist):
    """Execute all notebooks given as a list of files."""
    for ipynb in filelist:
        with open(ipynb) as f:
            nb = read(f, IPYTHON_NOTEBOOK_VERSION)
            fname = os.path.basename(ipynb)
            try:
                _run_notebook(nb)
                message = " %s works." % fname
                log.info(termcolor.colored(message, 'green'))
            except Exception, ex:
                print(ex)
                message = " %s is broken." % fname
                log.error(termcolor.colored(message, 'red'))


def main():
    """Main function to run notebooks from the command line."""
    filelist = []
    os.chdir(os.path.join("..", "..", "notebooks", "features"))
    if 'all' in sys.argv:
        for file in glob.glob("*.ipynb"):
            filelist += [file]
    else:
        filelist = sys.argv[1:]


if __name__ == '__main__':
    log.setLevel(logging.DEBUG)
    main()
