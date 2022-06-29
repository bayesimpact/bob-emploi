"""Tests on forms JSON definitions."""

import itertools
import json
import os
import typing
from typing import Any
import unittest

from bob_emploi.data_analysis.radar import config as radar_config


def _read_json(filename: str) -> dict[str, Any]:
    with open(filename, 'r', encoding='utf-8') as file:
        return typing.cast(dict[str, Any], json.load(file))


_FORM_PATH = os.path.join(os.path.dirname(__file__), '../forms')
_FORMS = {
    name.replace('.json', ''): _read_json(os.path.join(_FORM_PATH, name))
    for name in os.listdir(_FORM_PATH)
}
_FIRST_FORM = next(v for v in _FORMS.values())


class FormDefinitions(unittest.TestCase):
    """Sanity checks on Typeform definitions."""

    def _assert_same_structure(
            self, def_a: dict[str, Any], def_b: dict[str, Any], *, msg: str,
            uses_same_descriptions: bool = False) -> None:
        self.assertEqual(set(def_a), set(def_b), msg=msg)
        for key, value_a in def_a.items():
            value_b = def_b[key]
            if key in {'_links', 'href', 'id'}:
                continue
            if not uses_same_descriptions and key in {'description', 'title'}:
                continue
            if isinstance(value_a, dict):
                self._assert_same_structure(
                    value_a, value_b, msg=f'{msg}/{key}',
                    uses_same_descriptions=uses_same_descriptions)
            elif isinstance(value_a, (list, tuple)):
                for index, item_a in enumerate(value_a):
                    if isinstance(item_a, dict):
                        self._assert_same_structure(
                            item_a, value_b[index], msg=f'{msg}/{key}/{index}',
                            uses_same_descriptions=uses_same_descriptions)
                    else:
                        self.assertEqual(item_a, value_b[index], msg=f'{msg}/{key}/{index}')
            else:
                self.assertEqual(value_a, def_b[key], msg=f'{msg}/{key}')

    def test_diff_structure(self) -> None:
        """Test that all forms have the same structure."""

        for name, form in _FORMS.items():
            if form == _FIRST_FORM:
                continue
            self._assert_same_structure(_FIRST_FORM, form, msg=name)

    def test_multiple_choices(self) -> None:
        """Check the multiple choice answers."""

        # We only check the first form as others have the same structure or the test_diff_structure
        # will fail.

        config = radar_config.from_json5_file()

        domain_ids = []
        for section in _FIRST_FORM['fields'][:-1]:
            domain_id = section['ref']
            domain_ids.append(domain_id)
            self.assertEqual('group', section['type'])
            self.assertIn(
                '[Dossier du jeune : {{hidden:dossier_id}}](https://portail.i-milo.fr/dossier/'
                '{{hidden:dossier\\_id}})',
                section['properties']['description'])
            skill_ids = []
            for question in section['properties']['fields']:
                self.assertEqual('picture_choice', question['type'])
                ref = question['ref']
                self.assertTrue(ref.startswith(f'{domain_id}-'))
                skill_id = ref[len(f'{domain_id}-'):]
                skill_ids.append(skill_id)
                for level, answer in enumerate(question['properties']['choices']):
                    self.assertEqual(f'Niveau {level}', answer['label'])
                    self.assertEqual(f'{domain_id}-{skill_id}-{level}', answer['ref'])
            self.assertEqual(config['skillIds'], skill_ids)

        self.assertCountEqual(config['domainIds'], domain_ids)

    def test_link_to_imilo(self) -> None:
        """Check that each page contains a link to i-milo."""

        link_to_imilo = r'[Dossier du jeune : {{hidden:dossier_id}}](https://portail.i-milo.fr/dossier/{{hidden:dossier\_id}})'

        for form_name, form in _FORMS.items():
            for section in itertools.chain(form['fields'], form['welcome_screens']):
                self.assertIn(
                    link_to_imilo,
                    section['properties']['description'],
                    msg=f'{form_name}/{section["title"]}')


if __name__ == '__main__':
    unittest.main()
