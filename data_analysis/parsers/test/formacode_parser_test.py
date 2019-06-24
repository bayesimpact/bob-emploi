"""Tests for the bob_emploi.formacode_parser module."""

import io
from os import path
import typing
import unittest

from bob_emploi.data_analysis.parsers import formacode_parser


class FormacodeParserTestCase(unittest.TestCase):
    """Tests for the bob_emploi.formacode_parser module."""

    pdf_dump = path.join(
        path.dirname(__file__), 'testdata/Correspondance_Rome_Formacode.txt')

    def test_main(self) -> None:
        """End-to-end test of the formacode_parser."""

        out = io.StringIO()
        formacode_parser.main(['formacode_parser.py', self.pdf_dump], out)
        output = out.getvalue().split('\n')
        self.assertEqual('rome,formacode', output[0])
        self.assertLess(
            set(['H2101,215 98', 'H2101,215 99', 'G1101,426 95']),
            set(output[1:]))

    def test_main_no_arguments(self) -> None:
        """Test the parser without arguments."""

        out = io.StringIO()
        self.assertRaises(
            SystemExit, formacode_parser.main, ['formacode_parser.py'], out)

    def test_parse_line(self) -> None:
        """Unit test for the parse_rome_formacode_line."""

        mappings = _parse_line(
            '• découpe des viande H2101 _____ bOuChERiE 215 99')
        self.assertEqual([('H2101', '215 99')], mappings)

    def test_parse_line_no_info(self) -> None:
        """Test that lines without any IDs are ignored."""

        mappings = _parse_line(
            'Dans ce document figure la correspondance')
        self.assertFalse(mappings)

    def test_parse_line_missing_rome_id(self) -> None:
        """Test that lines with a Formacode but no Rome ID raise an error."""

        self.assertRaises(
            ValueError, _parse_line,
            '• découpe des viandeS2101 _____ bOuChERiE 215 99')

    def test_parse_line_multiple_rome_id(self) -> None:
        """Test that lines with multiple Rome IDs raise an error."""

        self.assertRaises(
            ValueError, _parse_line,
            '• découpe des viandes H2101 _____ bOuChERiE 215 99 K1301 auxiL')

    def test_parse_line_missing_formacode(self) -> None:
        """Test that lines with a Rome ID but no Formacode raise an error."""

        self.assertRaises(
            ValueError, _parse_line,
            '• découpe des viandes H2101 _____ bOuChERiE')


def _parse_line(line: str) -> typing.List[typing.Tuple[str, str]]:
    """Test helper to parse all mappings in one line."""

    return [m for m in formacode_parser.parse_rome_formacode_line(line)]


if __name__ == '__main__':
    unittest.main()
