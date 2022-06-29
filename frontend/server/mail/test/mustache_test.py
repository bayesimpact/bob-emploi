"""Tests for the mail.mustache module."""

# TODO(pascal): Move to a place where we test common.


import unittest

from bob_emploi.common.python import mustache


class MustacheTests(unittest.TestCase):
    """Unit tests for the instantiate function."""

    def test_string(self) -> None:
        """A template with no mustache."""

        result = mustache.instantiate('A simple string', {})
        self.assertEqual('A simple string', result)

    def test_vars(self) -> None:
        """A template containing mustached var."""

        result = mustache.instantiate('A string with {{var:myVar}}', {'myVar': 'a mustache'})
        self.assertEqual('A string with a mustache', result)

    def test_default_value(self) -> None:
        """A var using a default value."""

        result = mustache.instantiate('I am {{var:ready:"not ready"}}', {'ready': 'ready'})
        self.assertEqual('I am ready', result)
        result = mustache.instantiate('I am {{var:ready:"not ready"}}', {})
        self.assertEqual('I am not ready', result)

    def test_tag_error(self) -> None:
        """A template containing a mustached var with a typo."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate('A string with {{var:myVar} }', {'myVar': 'a mustache'})

    def test_if_block(self) -> None:
        """A template containing a simple if block."""

        result = mustache.instantiate('I am{%if var:ready%} ready{%endif%}', {'ready': True})
        self.assertEqual('I am ready', result)
        result = mustache.instantiate('I am{%if var:ready%} ready{%endif%}', {'ready': False})
        self.assertEqual('I am', result)

    def test_unexpected_endif(self) -> None:
        """A template containing an unexpected endif."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate('A string with {%endif%}', {'myVar': 'a mustache'})

    def test_missing_endif(self) -> None:
        """A template missing an endif."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate('A string with {%if var:myVar%}b{%else%}c', {'myVar': 'a'})

    def test_syntax_error_in_unused_branch(self) -> None:
        """A template with a syntax error in branch not used in the output."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate(
                'A string with {%if var:myVar%}b{%else%}c{%irf%}{%endif%}',
                {'myVar': True})

    def test_spurious_else(self) -> None:
        """A template containing an unexpected else."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate('A string with {%else%}', {})

    def test_multiple_elses(self) -> None:
        """A template containing multiple else tokens in an if."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate(
                'A string with {%if var:a%}a{%else%}b{%else%}c{%endif%}', {'a': True})

    def test_else(self) -> None:
        """A template containing an if block with an else branch."""

        result = mustache.instantiate('A string with {%if var:a%}a{%else%}b{%endif%}', {'a': True})
        self.assertEqual('A string with a', result)

    def test_elseif(self) -> None:
        """A template containing an if block with an elseif branch."""

        result = mustache.instantiate(
            'A string with {%if var:a%}a{%elseif var:b%}b{%else%}c{%endif%}.', {'a': True})
        self.assertEqual('A string with a.', result)

    def test_unknown_statement(self) -> None:
        """A template containing an unexpected statement."""

        with self.assertRaises(mustache.SyntaxTemplateError):
            mustache.instantiate('A string with {%now%}', {})

    def test_for_block(self) -> None:
        """A template containing a simple for block."""

        result = mustache.instantiate(
            'I want{%for fruit in var:fruits%} {{fruit}},{%endfor%} and more',
            {'fruits': ['apples', 'bananas']})
        self.assertEqual('I want apples, bananas, and more', result)

    def test_escape(self) -> None:
        """A template using the Escape function."""

        result = mustache.instantiate(
            'I am "{{Escape(var:firstname)}}"', {'firstname': 'The "Dude"'})
        self.assertEqual('I am "The &quot;Dude&quot;"', result)

    def test_equal_operator(self) -> None:
        """A template using an equal operator."""

        result = mustache.instantiate(
            'I am {%if var:firstname=="Bruce"%}almighty{%else%}{{var:firstname}}{%endif%}',
            {'firstname': 'Bruce'})
        self.assertEqual('I am almighty', result)

        result = mustache.instantiate(
            'I am {%if var:firstname=="Bruce"%}almighty{%else%}{{var:firstname}}{%endif%}',
            {'firstname': 'Groot'})
        self.assertEqual('I am Groot', result)

    def test_nested_var(self) -> None:
        """A template containing a mustached nested var."""

        result = mustache.instantiate(
            'A string with {{var:myVar.a}}', {'myVar': {'a': 'a mustache'}})
        self.assertEqual('A string with a mustache', result)

    def test_numeric_literal(self) -> None:
        """A template containing an expression based on a numeric literal."""

        result = mustache.instantiate(
            'I am {%if var:score > 10%}A {%endif%}OK', {'score': 12})
        self.assertEqual('I am A OK', result)

    def test_loose_syntax(self) -> None:
        """A template containing mustached var with white spaces."""

        with self.assertRaises(mustache.StrictSyntaxTemplateError):
            mustache.instantiate(
                'A string with {{ var:myVar }}', {'myVar': 'a mustache'}, use_strict_syntax=True)

        result = mustache.instantiate(
            'A string with {{ var:myVar }}', {'myVar': 'a mustache'}, use_strict_syntax=False)
        self.assertEqual('A string with a mustache', result)


if __name__ == '__main__':
    unittest.main()
