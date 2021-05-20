"""Unit tests for the extract_mailjet_strings module."""

from os import path
import textwrap
import unittest

from bob_emploi.frontend.server.asynchronous.i18n import extract_mailjet_strings


class BreaksOuterTagsHtmlTests(unittest.TestCase):
    """Unit tests for the breaks_outer_tags_html function."""

    def test_no_tag(self) -> None:
        """Breaks outer tags but no tags."""

        res = extract_mailjet_strings.breaks_outer_tags_html('A text with no tag')
        self.assertEqual(('', 'A text with no tag', ''), res)

    def test_simple_tag(self) -> None:
        """Breaks outer tags with one simple tag."""

        res = extract_mailjet_strings.breaks_outer_tags_html('<p>A text with a tag</p>')
        self.assertEqual(('<p>', 'A text with a tag', '</p>'), res)

    def test_tag_with_attributes(self) -> None:
        """Breaks outer tags with a tag including attributes."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p style="margin-top: 10px">A text with a tag</p>',
        )
        self.assertEqual(('<p style="margin-top: 10px">', 'A text with a tag', '</p>'), res)

    def test_multiple_outer_tags(self) -> None:
        """Breaks outer tags with multiple outer tags."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p style="margin-top: 10px"><a><strong><em>A text with 4 tags</em></strong></a></p>',
        )
        self.assertEqual(
            (
                '<p style="margin-top: 10px"><a><strong><em>',
                'A text with 4 tags',
                '</em></strong></a></p>',
            ), res)

    def test_multiple_inner_tags(self) -> None:
        """Breaks outer tags with multiple inner tags."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p style="margin-top: 10px">A text with a tag</p><p>Another text</p>',
        )
        self.assertEqual(
            (
                '',
                '<p style="margin-top: 10px">A text with a tag</p><p>Another text</p>',
                '',
            ), res)

    def test_self_closing_tag_br(self) -> None:
        """Breaks outer tags when using self closing tag implicitely."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p>A text with<br>a tag</p>',
        )
        self.assertEqual(
            (
                '<p>',
                'A text with<br>a tag',
                '</p>',
            ), res)

    def test_multiple_inner_tags_and_an_outer_tag(self) -> None:
        """Breaks outer tags with multiple inner tags and an outer tag."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p>Prefix<span>Some content</span><span></span><span>Other content</span></p>',
        )
        self.assertEqual(
            (
                '<p>',
                'Prefix<span>Some content</span><span></span><span>Other content</span>',
                '</p>',
            ), res)

    def test_multiline_tag(self) -> None:
        """Breaks outer tags with one simple tag on multiplie lines and indentations."""

        res = extract_mailjet_strings.breaks_outer_tags_html('<p>\n  A text with a tag\n</p>')
        self.assertEqual(('<p>\n  ', 'A text with a tag', '\n</p>'), res)

    def test_with_moustache(self) -> None:
        """Breaks outer tag when the text contains a mustache var."""

        res = extract_mailjet_strings.breaks_outer_tags_html('<p>Hello {{var:firstName}}</p>')
        self.assertEqual(('<p>', 'Hello {{var:firstName}}', '</p>'), res)

    def test_siblings_moustache(self) -> None:
        """Don't break sibling tags when the text contains a mustache var."""

        res = extract_mailjet_strings.breaks_outer_tags_html(
            '<p>Hello {{var:firstName}}</p><p>Happy to see you!')
        self.assertEqual(('', '<p>Hello {{var:firstName}}</p><p>Happy to see you!', ''), res)


class ItemizeHtmlTagsTests(unittest.TestCase):
    """Unit tests for the itemize_html_tags function."""

    def test_no_html(self) -> None:
        """Itemize HTML tags with no tags."""

        self.assertEqual(
            'No tags', extract_mailjet_strings.itemize_html_and_mjml_tags('No tags')[0])

    def test_simple_html_tag(self) -> None:
        """Itemize HTML tags with one tag."""

        self.assertEqual(
            ('One <0>tag</0>', {'0': 'span style="font-weight: 500"'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags(
                'One <span style="font-weight: 500">tag</span>'))

    def test_self_closing_tag(self) -> None:
        """Itemize HTML tags with a self closing tag."""

        self.assertEqual(
            ('One <0/>self closing tag', {'0': 'br /'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags('One <br />self closing tag'))

    def test_br_tag(self) -> None:
        """Itemize HTML tags with a br tag implicitely self closing."""

        self.assertEqual(
            ('One <0/>self closing tag', {'0': 'br'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags('One <br>self closing tag'))

    def test_multiple_tags(self) -> None:
        """Itemize HTML tags with multiple nested tags."""

        self.assertEqual(
            ('<0>Multiple <1>nested</1><2/>tags</0>', {'0': 'p', '1': 'strong', '2': 'br /'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags(
                '<p>Multiple <strong>nested</strong><br />tags</p>'))

    def test_mjml_branch_tag(self) -> None:
        """Itemize MJML branch tag."""

        self.assertEqual(
            ('{0}Hello{1}Hi{2} you', {'0': '%if var:foo="bar"%', '1': '%else%', '2': '%endif%'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags(
                '{%if var:foo="bar"%}Hello{%else%}Hi{%endif%} you'))

    def test_moustache_tag(self) -> None:
        """Itemize moustache tags."""

        self.assertEqual(
            ('Hello {0}', {'0': '{var:firstName:"Marie"}'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags('Hello {{var:firstName:"Marie"}}'))

    def test_identical_tags(self) -> None:
        """Itemize HTML tags with multiple identical tags."""

        self.assertEqual(
            ('<0>Multiple <1>inner</1><2/><1>tags</1></0>', {'0': 'p', '1': 'strong', '2': 'br /'}),
            extract_mailjet_strings.itemize_html_and_mjml_tags(
                '<p>Multiple <strong>inner</strong><br /><strong>tags</strong></p>'))


class ExtractTests(unittest.TestCase):
    """Unit tests for the main function of extract_mailjet_strings module."""

    def test_simple_usage(self) -> None:
        """Basic usage of the extract tool."""

        output = extract_mailjet_strings.main(
            (path.join(path.dirname(__file__), 'testdata/reset-password'), ),
        )
        self.assertTrue(output.startswith(
            textwrap.dedent('''\
                #
                msgid ""
                msgstr ""

            ''')), msg=output)
        self.assertIn(textwrap.dedent('''
            msgid "Modifier le mot de passe"
            msgstr ""

        '''), output)
        self.assertIn(textwrap.dedent('''
            msgid ""
            "<0>Bonjour {1},</0><0>Vous avez demandé à changer votre mot de passe, vous "
            "pouvez maintenant le modifier en cliquant sur le bouton suivant.</0>"
            msgstr ""
        '''), output)
        self.assertIn('msgid "Modifiez votre mot de passe Bob Emploi"', output)
        self.assertIn('msgid "http://r.bob-emploi.fr/tplimg/6u2u/b/p43g/2vro0.png"', output)
        self.assertIn('msgid "https://www.google.com?hl=fr"', output)
        self.assertIn('msgid "https://www.google.com?q={0}&amp;hl=fr"', output)
        self.assertIn('msgid "{0}/home"', output)


if __name__ == '__main__':
    unittest.main()
