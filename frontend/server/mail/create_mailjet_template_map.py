"""Create a template map in Python from the map in JSON."""

import json
import os
import sys
import textwrap
from typing import Iterable


def _create_lines(lines: Iterable[str], indent: str = '') -> str:
    return f'\n{indent}'.join(lines)


def main(json_map_filename: str) -> str:
    """Create a template map in Python code."""

    with open(json_map_filename, 'rt', encoding='utf-8') as json_map_file:
        templates = json.load(json_map_file)

    assert len({t['name'] for t in templates}) == len(templates), 'Template names are not unique'

    return textwrap.dedent(f'''\
        """Map of MailJet templates."""

        # Generated automatically.  DO NOT EDIT!
        # source: {json_map_filename}
        # pylint: disable=line-too-long

        from typing import Literal, Mapping, TypedDict


        # Root path for template folders.
        PATH = {repr(os.path.dirname(json_map_filename))}


        Id = Literal[
            {_create_lines(sorted((repr(t['name']) + ',') for t in templates), '            ')}
        ]


        class _RequiredTemplate(TypedDict):
            name: str
            mailjetTemplate: int


        class Template(_RequiredTemplate, total=False):
            """Description of a MailJet template."""

            i18n: dict[str, int]
            noI18n: bool


        MAP: Mapping[Id, Template] = {{
            {_create_lines(
                sorted((repr(t['name']) + ': ' + repr(t) + ',') for t in templates),
                '            ')}
        }}''')


if __name__ == '__main__':
    print(main(sys.argv[1]))
