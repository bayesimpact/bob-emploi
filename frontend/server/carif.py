"""Module to get information on companies."""
import logging
import requests
import xmltodict

from bob_emploi.frontend.api import training_pb2

_CARIF_URL = 'http://www.intercariforef.org/serviceweb2/offre-info/?versionLHEO=2.2&typeListe=max'


def _make_key(title, city):
    """Create a unique key for a training."""
    return title + city


def get_trainings(rome_id, departement_id):
    """Helper function to get trainings from the CARIF API.

    Carif sends us multiple trainings that have the same city and title, this function only return
    one training per city/title.
    """
    no_trainings = []

    try:
        xml = requests.get(
            _CARIF_URL, params={'idsMetiers': rome_id, 'code-departement': departement_id})
    except requests.exceptions.ConnectionError as error:
        logging.warning('XML request for intercarif failed:\n%s', error)
        return no_trainings

    trainings = []

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

    offers = []
    try:
        offers = info['lheo-index']['resumes-offres']['resume-offre']
    except KeyError:
        return no_trainings

    # Since our goal is not to give a super tool to find all the precise training and their
    # differences, we just show one, and dedup them on a key composed of city and name.
    trainings_keys = set()

    for offer in offers:
        try:
            formacodes = offer['domaine-formation']['code-FORMACODE']
            if not isinstance(formacodes, list):
                formacodes = [formacodes]

            name = offer['intitule-formation'].replace('\n', ' ')
            city_name = offer['ville']
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
