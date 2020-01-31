"""Blueporint for the A-Li endpoints."""

import logging
from typing import Any, Dict

import flask
import requests

from bob_emploi.frontend.api import ali_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import proto

app = flask.Blueprint('ali', __name__)  # pylint: disable=invalid-name


def _send_email(
        mail_template: str, user_profile: 'mail._Recipient',
        template_vars: Dict[str, Any]) -> bool:
    mail_result = mail.send_template(mail_template, user_profile, template_vars)
    try:
        mail_result.raise_for_status()
    except requests.exceptions.HTTPError as error:
        logging.error('Failed to send an email with MailJet:\n %s', error)
        return False
    return True


# TODO(marielaure): Maybe return which email has been sent.
def _send_data_by_email(user_data: ali_pb2.User) -> ali_pb2.EmailStatuses:
    user_email = user_data.user_email
    user_profile = user_pb2.UserProfile(email=user_email)
    counselor_email = user_data.counselor_email
    mails_sent = ali_pb2.EmailStatuses()
    template_vars = {
        'counselorEmail': counselor_email,
        'counselorName': user_data.counselor_name,
        'directLink': user_data.results_url,
        'userEmail': user_email,
    }

    if user_profile.email:
        mails_sent.has_user_email = _send_email('1107108', user_profile, template_vars)
    if counselor_email:
        counselor_profile = user_pb2.UserProfile(email=counselor_email)
        mails_sent.has_counselor_email = _send_email('1109007', counselor_profile, template_vars)
    return mails_sent


@app.route('/user', methods=['POST'])
@proto.flask_api(in_type=ali_pb2.User, out_type=ali_pb2.EmailStatuses)
def send_ali_user(user_data: ali_pb2.User) -> ali_pb2.EmailStatuses:
    """Send A-Li user data back by email."""

    if not user_data.user_email:
        flask.abort(400, "Impossible d'envoyer ses données à l'utilisateur·rice sans email.")
    return _send_data_by_email(user_data)
