"""Linter for notebooks."""

import fnmatch
import json
import os
from os import path
from typing import Any, Mapping, Tuple
import unittest


# TODO(émilie): Add a rule to check for master references.
class NotebookLintCase(unittest.TestCase):
    """Linter for notebooks."""

    files: list[str]
    notebooks: list[Tuple[str, Mapping[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        src = path.dirname(path.dirname(__file__))
        cls.files = []
        for root, unused_dirnames, filenames in os.walk(src):
            if '/.ipynb_checkpoints' in root:
                continue  # pragma: no cover
            for filename in fnmatch.filter(filenames, '*.ipynb'):
                cls.files.append(os.path.join(root, filename))

        cls.notebooks = []
        for filename in cls.files:
            with open(filename, encoding='utf-8') as notebook_file:
                try:
                    cls.notebooks.append((filename, json.load(notebook_file)))
                except json.decoder.JSONDecodeError as error:  # pragma: no cover
                    raise ValueError(f'"{filename}" is not a valid JSON file.') from error

    def test_num_notebooks(self) -> None:
        """Check that we are indeed linting notebooks."""

        self.assertGreater(len(self.__class__.files), 5)

    def test_code_cell_syntax(self) -> None:
        """Check some specific features are not used in code cells."""

        for file_name, notebook in self.__class__.notebooks:
            coding_cells = [
                c for c in notebook.get('cells', [])
                if c.get('cell_type') == 'code']
            for coding_cell_number, coding_cell in enumerate(coding_cells):
                for line in coding_cell.get('source', []):
                    # Forbid imports except in the first cell.
                    msg = (
                        'Imports should be only in first coding cell, but in '
                        f'file "{file_name}", coding cell {coding_cell_number:d}')
                    if coding_cell_number:
                        self.assertNotRegex(line, '^import ', msg=msg)
                        self.assertNotRegex(line, '^from .* import ', msg=msg)

                    # Forbid assignment to _.
                    self.assertNotRegex(
                        line, r'^_\s*=',
                        msg='Do not assign to the _ variable, use a trailing ; instead in '
                        f'file "{file_name}", coding cell {coding_cell_number:d}')

                    # Avoid config options that are already set by default.
                    self.assertNotEqual(
                        '%matplotlib inline', line.strip(),
                        msg=f'No need to set "%matplotlib inline", in file "{file_name}" it\'s '
                        'already in the config.')
                    self.assertNotEqual(
                        "%config InlineBackend.figure_format = 'retina'", line.strip(),
                        msg=f'No need to set this config in file "{file_name}", it\'s already in '
                        'the default config file.')

    def test_at_least_one_cell(self) -> None:
        """Check that each notebook contains at least one cell."""

        for file_name, notebook in self.__class__.notebooks:
            msg = f'{file_name} has no cells'
            self.assertGreater(len(notebook.get('cells', [])), 1, msg=msg)

    def test_first_cell_contains_author(self) -> None:
        """Check that the first cell is a markdown cell with the author."""

        for file_name, notebook in self.__class__.notebooks:
            cells = notebook.get('cells', [])
            if not cells:  # pragma: no cover
                continue
            first_cell = cells[0]
            msg = (
                f'First cell of {file_name} should be a markdown cell containing the '
                "original author's name")
            self.assertEqual('markdown', first_cell.get('cell_type'), msg=msg)
            author_found = False
            for line in first_cell.get('source', []):
                if line.startswith('Author: ') or line.startswith('Authors: '):
                    author_found = True
                    break
            self.assertTrue(author_found, msg=msg)

    def test_python3(self) -> None:
        """Check that the notebooks are using Python 3 kernel only."""

        for file_name, notebook in self.__class__.notebooks:
            kernel = notebook['metadata']['kernelspec'].get('name')
            msg = f'The notebook {file_name} is using kernel {kernel} instead of python3'
            self.assertEqual('python3', kernel, msg=msg)

    def test_no_spaces_in_filenames(self) -> None:
        """Check that the notebooks names use underscores, not blank spaces."""

        for file_name, unused_notebook in self.__class__.notebooks:
            self.assertNotIn(
                ' ', path.basename(file_name), msg=f'Use underscore in filename {file_name}')

    def test_filenames_in_lowercase(self) -> None:
        """Check that the notebooks names only use lowercases."""

        for file_name, unused_notebook in self.__class__.notebooks:
            basename = path.basename(file_name)
            self.assertEqual(
                basename.lower(), basename,
                msg=f'Use lowercase only in filename "{file_name}"')

    def test_clean_execution(self) -> None:
        """Check that all code cells have been executed once in the right order."""

        for file_name, notebook in self.__class__.notebooks:
            cells = notebook.get('cells', [])
            code_cells = [c for c in cells if c.get('cell_type') == 'code']
            for index, cell in enumerate(code_cells):
                self.assertTrue(
                    cell.get('source'),
                    msg=f'There is an empty code cell in notebook {file_name}')
                self.assertEqual(
                    index + 1, cell.get('execution_count'),
                    msg=f'The code cells in notebook {file_name} have not been executed '
                    'in the right order. Run "Kernel > Restart & run all" '
                    'then save the notebook.')


if __name__ == '__main__':
    unittest.main()
