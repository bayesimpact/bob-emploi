"""Module to instantiate Mailjet templates using mustache syntax.

The full reference is here: https://dev.mailjet.com/email/template-language/reference/
"""

import abc
import itertools
import logging
import html
import json
import operator
import re
from typing import Any, Iterable, Iterator, List, Literal, Mapping, Optional, Tuple


# Regexp to match MJML tags e.g. {{var:foo}}, {%endif%} etc.
_MJML_TAG_PATTERN = re.compile(
    r'([ \n]*\n[ \n]*|{{[^}]*}}|{%[^{}]*%})', re.MULTILINE)
# Regexp to match for statements, e.g. "for user in var:users"
_FOR_PATTERN = re.compile(r'^for +(\w+) +in +(.*)$')
# Regexp to match a variable, e.g. var:fruit:"apple", var:user
_VAR_PATTERN = re.compile(
    r'^(?P<var_name>(?:var:)?[a-zA-Z][\w.]*)(?::(?P<default_value>"[^"]*"))?$')
# Regexp to match a function call, e.g. Escape(var:fruit)
_FUNC_PATTERN = re.compile(r'^(?P<func_name>[A-Z]\w+)\((?P<arg>[^\)]+)\)$')
# Regexp to match an operation, e.g. var:fruit == "apple"
_OPERATOR_PATTERN = re.compile(
    r'^(?P<operand_1>.*[^=<>!])\s*(?P<operator>!=|==?|<=?|>=?)\s*(?P<operand_2>[^=<>!].*)$')

_TokenType = Literal['content', 'expression', 'statement']

_OPERATORS = {
    '<': operator.lt,
    '>': operator.gt,
    '<=': operator.le,
    '>=': operator.ge,
    '=': operator.eq,
    '==': operator.eq,
    '===': operator.eq,
    '!=': operator.ne,
    '<>': operator.ne,
}


class SyntaxTemplateError(ValueError):
    """A syntax template error."""


class _ReachingElse(SyntaxTemplateError):
    """Usually not an error, just a control signal when reaching an "else" token."""

    def __init__(self, token: str) -> None:
        super().__init__(f'Unexpected {{%{token}%}} found')
        self._token = token

    @property
    def token(self) -> str:
        """The token that was encountered."""

        return self._token


# TODO(pascal): Add a mode where we are stricter about whitespaces.
def _tokenize_mustache(template: str) -> Iterator[Tuple[str, _TokenType]]:
    """Breaks a mustache template soup into token: tags and content."""

    try:
        tokens = _MJML_TAG_PATTERN.split(template)
    except TypeError:
        logging.debug(template)
        raise
    for token in tokens:
        if not token:
            continue

        clean_token = token.strip()
        if clean_token.startswith('{{') or clean_token.startswith('{%'):
            token_value = clean_token[2:-2].strip()
            if clean_token.startswith('{{'):
                yield token_value, 'expression'
                continue
            yield token_value, 'statement'
            continue

        for tag in ('{{', '}}', '{%', '%}'):
            if tag in token:
                raise SyntaxTemplateError(f'Lonely "{tag}" found in template')

        yield token, 'content'


def _resolve(expression: str, context: Mapping[str, Any]) -> Any:
    func_match = _FUNC_PATTERN.match(expression)
    if func_match:
        func_name = func_match.group('func_name')
        arg = _resolve(func_match.group('arg'), context)
        if func_name == 'Escape':
            return html.escape(arg)
        raise NotImplementedError(f'Function "{func_name}" not implemented')

    var_match = _VAR_PATTERN.match(expression)
    if var_match:
        var_name = var_match.group('var_name')
        if var_match.group('default_value'):
            try:
                default_value = json.loads(var_match.group('default_value'))
            except Exception as err:
                raise ValueError(expression) from err
            return context.get(var_name, default_value)
        value = context
        try:
            for piece in var_name.split('.'):
                value = value[piece]
        except KeyError as error:
            raise ValueError(f'Error while resolving "{expression}"') from error
        return value

    operator_match = _OPERATOR_PATTERN.match(expression)
    if operator_match:
        try:
            operator_func = _OPERATORS[operator_match.group('operator')]
            operand_1 = _resolve(operator_match.group('operand_1').strip(), context)
            operand_2 = _resolve(operator_match.group('operand_2').strip(), context)
            return operator_func(operand_1, operand_2)
        except Exception as error:
            raise ValueError(f'Error while resolving"{expression}"') from error

    try:
        return json.loads(expression)
    except json.decoder.JSONDecodeError:
        ...

    raise NotImplementedError(f'Does not handle the expression "{expression}" yet')


class _Node:

    @abc.abstractmethod
    def resolve(self, context: Mapping[str, Any]) -> str:
        """Resolve the node to a string using the context."""


class _ContentLeaf(_Node):

    def __init__(self, content: str) -> None:
        self._content = content

    def resolve(self, context: Mapping[str, Any]) -> str:
        return self._content


class _ExpressionLeaf(_Node):

    def __init__(self, expression: str) -> None:
        self._expression = expression

    def resolve(self, context: Mapping[str, Any]) -> str:
        return str(_resolve(self._expression, context))


class _IfNode(_Node):

    def __init__(
            self, condition: str, then_branch: Iterable[_Node], else_branch: Iterable[_Node]) \
            -> None:
        self._condition = condition
        self._then_branch = then_branch
        self._else_branch = else_branch

    def resolve(self, context: Mapping[str, Any]) -> str:
        if _resolve(self._condition, context):
            branch = self._then_branch
        else:
            branch = self._else_branch
        return ''.join(node.resolve(context) for node in branch)


class _ForNode(_Node):

    def __init__(self, var_name: str, expression: str, branch: Iterable[_Node]) -> None:
        self._var_name = var_name
        self._expression = expression
        self._branch = list(branch)

    def resolve(self, context: Mapping[str, Any]) -> str:
        values = _resolve(self._expression, context)
        return ''.join(
            ''.join(
                node.resolve(dict(context, **{self._var_name: value}))
                for node in self._branch
            )
            for value in values
        )


def _parse_tree(tokens: Iterator[Tuple[str, _TokenType]], block_start: str) -> Iterator[_Node]:

    for token, token_type in tokens:
        if token_type == 'content':
            yield _ContentLeaf(token)
            continue

        if token_type == 'expression':
            yield _ExpressionLeaf(token)
            continue

        # Statements.

        if token.startswith('end'):
            if token == f'end{block_start}':
                return
            if block_start:
                expecting = f', expecting "end{block_start}'
            else:
                expecting = ''
            raise SyntaxTemplateError(f'Unexpected "{token}" found{expecting}')

        if token == 'else' or token.startswith('elseif '):
            raise _ReachingElse(token)

        if token.startswith('if '):
            condition = token[3:].strip()
            then_branch: List[_Node] = []
            else_branch: List[_Node] = []
            try:
                for node in _parse_tree(tokens, 'if'):
                    then_branch.append(node)
            except _ReachingElse as stop:
                if stop.token == 'else':
                    else_branch.extend(_parse_tree(tokens, 'if'))
                else:
                    else_branch.extend(_parse_tree(
                        itertools.chain([(stop.token[len('else'):], 'statement')], tokens),
                        'elseif'))
            yield _IfNode(condition, then_branch, else_branch)
            if block_start == 'elseif':
                return
            continue

        if token.startswith('for '):
            match = _FOR_PATTERN.match(token)
            if not match:
                raise SyntaxTemplateError(f'Syntax error while parsing a for statement: "{token}"')
            var_name = match.group(1)
            expression = match.group(2)
            yield _ForNode(var_name, expression, _parse_tree(tokens, 'for'))
            continue

        raise SyntaxTemplateError(f'Unknown statement "{token}"')

    if block_start:
        raise SyntaxTemplateError(f'Missing "end{block_start}"')


def instantiate(template: str, template_vars: Optional[Mapping[str, Any]] = None) -> str:
    """Instantiate a Mailjet template with the given vars."""

    context = {
        f'var:{key}': value
        for key, value in (template_vars or {}).items()}

    tokens = _tokenize_mustache(template)
    tree = _parse_tree(tokens, '')
    return ''.join(node.resolve(context) for node in tree)


def check_syntax(template: str) -> None:
    """Parse a Mailjet template to check it has a correct syntax."""

    tokens = _tokenize_mustache(template)
    list(_parse_tree(tokens, ''))
