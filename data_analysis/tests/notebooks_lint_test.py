"""Linter for notebooks."""
import fnmatch
import inspect
import json
import os
from os import path
import unittest


class NotebookLintCase(unittest.TestCase):
    """Linter for notebooks."""

    @classmethod
    def setUpClass(cls):
        super(NotebookLintCase, cls).setUpClass()
        src = path.dirname(path.dirname(__file__))
        cls.files = []
        for root, unused_dirnames, filenames in os.walk(src):
            if '/.ipynb_checkpoints' in root:
                continue
            for filename in fnmatch.filter(filenames, '*.ipynb'):
                cls.files.append(os.path.join(root, filename))

        cls.notebooks = []
        for filename in cls.files:
            with open(filename) as notebook_file:
                cls.notebooks.append((filename, json.load(notebook_file)))

    def test_num_notebooks(self):
        """Check that we are indeed linting notebooks."""
        self.assertGreater(len(self.__class__.files), 13)

    def test_import_in_first_code_cell(self):
        """Check that imports are only in first code cell."""
        for file_name, notebook in self.__class__.notebooks:
            coding_cells = [
                c for c in notebook.get('cells', [])
                if c.get('cell_type') == 'code']
            for i, coding_cell in enumerate(coding_cells[1:]):
                for line in coding_cell.get('source', []):
                    msg = (
                        'Imports should be only in first coding cell, but in '
                        'file "%s", coding cell %d' % (file_name, i + 1))
                    self.assertNotRegex(line, '^import ', msg=msg)
                    self.assertNotRegex(line, '^from .* import ', msg=msg)

    def test_at_least_one_cell(self):
        """Check that each notebook contains at least one cell."""
        for file_name, notebook in self.__class__.notebooks:
            msg = '%s has no cells' % file_name
            self.assertGreater(len(notebook.get('cells', [])), 1, msg=msg)

    def test_first_cell_contains_author(self):
        """Check that the first cell is a markdown cell with the author."""
        for file_name, notebook in self.__class__.notebooks:
            cells = notebook.get('cells', [])
            if not cells:
                continue
            first_cell = cells[0]
            msg = (
                'First cell of %s should be a markdown cell containing the '
                "original author's name" % file_name)
            self.assertEqual('markdown', first_cell.get('cell_type'), msg=msg)
            author_found = False
            for line in first_cell.get('source', []):
                if line.startswith('Author: ') or line.startswith('Authors: '):
                    author_found = True
                    break
            self.assertTrue(author_found, msg=msg)

    def test_python3(self):
        """Check that the notebooks are using Python 3 kernel only."""
        for file_name, notebook in self.__class__.notebooks:
            kernel = notebook['metadata']['kernelspec'].get('name')
            msg = (
                'The notebook %s is using kernel %s instead of python3'
                % (file_name, kernel))
            self.assertEqual('python3', kernel, msg=msg)

    def test_no_spaces_in_filenames(self):
        """Check that the notebooks names use underscores, not blank spaces."""
        for file_name, unused_notebook in self.__class__.notebooks:
            self.assertNotIn(
                ' ', path.basename(file_name), msg='Use underscore in filename %s' % file_name)

    def test_clean_execution(self):
        """Check that all code cells have been executed once in the right order."""
        for file_name, notebook in self.__class__.notebooks:
            cells = notebook.get('cells', [])
            code_cells = [c for c in cells if c.get('cell_type') == 'code']
            for index, cell in enumerate(code_cells):
                self.assertTrue(
                    cell.get('source'),
                    msg='There is an empty code cell in notebook %s' % file_name)
                self.assertEqual(
                    index + 1, cell.get('execution_count'),
                    msg='The code cells in notebook %s have not been executed '
                    'in the right order. Run "Kernel > Restart & run all" '
                    'then save the notebook.' % file_name)


class TolerantAsserter(object):
    """An asserter that refrains itself for some time before raising errors.

    It works as a wrapper around another asserter and catches N AssertionError.
    Any additional error is raised normally.

    The idea of the TolerantAsserter is to allow for a temporary lower level of
    assertion. However your goal should always be to get rid of it and restore
    all the assertions. In order to help you with that we recommend calling
    assert_exact_tolerance at the end of your test: if someone fixed one of the
    assertion this function will congratulate them and ask them to reduce the
    tolerance. If you want to take the bulls by its horns, run your tests with
    NO_TOLERANCE env variable set to 1: this will uncover all the assertions
    that were hidden by tolerant asserters.
    """

    def __init__(self, asserter, tolerance=0):
        """Wraps an asserter with tolerance.

        Args:
            asserter: the actual asserter that will do all the work.
            tolerance: the number of assertions that you are expecting.
        """
        self._asserter = asserter
        self._tolerance = tolerance
        self._errors = []

    def __getattr__(self, name):
        attr = getattr(self._asserter, name)
        if inspect.ismethod(attr):
            return self._wrap(attr)
        return attr

    def _wrap(self, method):
        def _wrapped_method(*args, **kwargs):
            try:
                method(*args, **kwargs)
            except AssertionError as error:
                if self._tolerance < len(self._errors):
                    raise
                else:
                    self._errors.append(error)
        return _wrapped_method

    def assert_exact_tolerance(self):
        """Assert that this object has used all its tolerance."""
        if self._tolerance > len(self._errors):
            raise AssertionError(
                'Thanks for cleaning up, reduce the tolerance of this object '
                'to %d.' % len(self._errors))
        if os.getenv('NO_TOLERANCE'):
            if self._errors:
                raise AssertionError(
                    'NO TOLERANCE!, we should raise all the following:\n%s'
                    % ('\n'.join(str(e) for e in self._errors)))
            else:
                raise AssertionError(
                    "NO TOLERANCE! you don't need this wrapper anymore")


if __name__ == '__main__':
    unittest.main()
