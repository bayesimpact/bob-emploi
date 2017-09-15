"""Headers for OpenGraph.
    https://developers.facebook.com/docs/sharing/webmasters#markup
"""
import collections
from os import path
from urllib import parse

import flask
from flask import request


app = flask.Blueprint('opengraph', __name__)  # pylint: disable=invalid-name

_PRODUCT_NAME = 'Bob Emploi'


def _create_endpoint(endpoint_path, title, description):
    full_title = '%s - %s' % (_PRODUCT_NAME, title) if title else _PRODUCT_NAME

    def _serve_head():
        link_path = parse.urljoin(request.url_root, endpoint_path)
        return flask.render_template(
            'opengraph.tpl', url=link_path, title=full_title, description=description)

    app.add_url_rule(path.join('/', endpoint_path), endpoint=endpoint_path, view_func=_serve_head)


_EndpointDescription = collections.namedtuple('EndpointDescription', ['title', 'description'])
_ENDPOINTS = {
    '': _EndpointDescription(
        title=None,
        description="Accélérez votre recherche d'emploi avec %s." % _PRODUCT_NAME,
    ),
    'contribuer': _EndpointDescription(
        title='Contribuer',
        description='Ensemble créons le service public de demain.',
    ),
    'notre-mission': _EndpointDescription(
        title='Notre mission',
        description="Notre mission est d'utiliser le pouvoir "
        'des algorithmes pour apporter des solutions aux problèmes de société.',
    ),
    'transparence': _EndpointDescription(
        title='Transparence',
        description='Le fonctionnement et le développement de %s en '
        'toute transparence : les chiffres clés, nos financements, les plans '
        'pour la suite.' % _PRODUCT_NAME,
    ),
    'equipe': _EndpointDescription(
        title='Équipe',
        description="Voici l'équipe qui dévelope %s" % _PRODUCT_NAME,
    ),
    'vie-privee': _EndpointDescription(
        title='Vie privée',
        description='Nous nous engageons à respecter le meilleur niveau de '
        'protection en conformité avec la réglementation Informatique et Liberté.',
    ),
}


for key, endpoint in _ENDPOINTS.items():
    _create_endpoint(key, endpoint.title, endpoint.description)
