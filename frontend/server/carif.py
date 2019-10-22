"""Module to get information on companies."""

import logging
import typing
from typing import Any, Dict, List, Set, Union

import requests
import xmltodict

from bob_emploi.frontend.api import training_pb2

_CARIF_URL = 'http://www.intercariforef.org/serviceweb2/offre-info/?versionLHEO=2.2&typeListe=max'


def _make_key(title: str, city: str) -> str:
    """Create a unique key for a training."""

    return title + city


_XmlType = typing.TypeVar('_XmlType')


def _get_list_from_xml(xml: Union[_XmlType, List[_XmlType]]) -> List[_XmlType]:
    """Wrap an xml node in a list, if it is not already a list of nodes.

    When querying an xml dict, we get a list if there are sibling elements with the same tag, but
    the element itself if it has no sibling (with the same tag). This wraps the latter in a list,
    when it occurs.
    """

    if isinstance(xml, list):
        return xml
    return [xml]


def get_trainings(rome_id: str, departement_id: str) -> List[training_pb2.Training]:
    """Helper function to get trainings from the CARIF API.

    Carif sends us multiple trainings that have the same city and title, this function only return
    one training per city/title.
    """

    no_trainings: List[training_pb2.Training] = []

    try:
        xml = requests.get(
            _CARIF_URL, params={'idsMetiers': rome_id, 'code-departement': departement_id})
    except requests.exceptions.ConnectionError as error:
        logging.warning('XML request for intercarif failed:\n%s', error)
        return no_trainings

    trainings: List[training_pb2.Training] = []

    if xml.status_code != 200:
        logging.warning('XML request for intercarif failed with error code %d', xml.status_code)
        return no_trainings

    if not xml.text:
        logging.warning('XML request for intercarif failed, there is no text in the response.')
        return no_trainings

    # Intercarif does not provide an encoding in the response header which misleads the xmltodict
    # module.
    xml.encoding = 'utf-8'

    info = xmltodict.parse(xml.text)

    offers: List[Dict[str, Any]] = []
    try:
        offers = _get_list_from_xml(info['lheo-index']['resumes-offres']['resume-offre'])
    except KeyError:
        return no_trainings

    # Since our goal is not to give a super tool to find all the precise training and their
    # differences, we just show one, and dedup them on a key composed of city and name.
    trainings_keys: Set[str] = set()

    for offer in offers:
        try:
            formacodes: List[str] = _get_list_from_xml(
                offer['domaine-formation']['code-FORMACODE'])

            name = offer['intitule-formation'].replace('\n', ' ')
            city_name = offer['ville']
            # TODO(cyrille): consider allowing an offer even without a URL,
            # by redirecting to CARIF website.
            url = offer['@href']

            key = _make_key(name, city_name)
            if key in trainings_keys:
                continue

            training = training_pb2.Training(
                name=name,
                city_name=city_name,
                url=url,
                formacodes=formacodes)

            trainings_keys.add(key)
            trainings.append(training)
        except KeyError:
            # If an important field is missing, we skip this training.
            logging.info('Skipping the offer from CARIF, an important field is missing: %s', offer)
            continue

    return trainings
