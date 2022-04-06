"""Blueporint for the A-Li endpoints."""

import logging
from typing import Any

import flask
import requests

from bob_emploi.frontend.api import ali_pb2
from bob_emploi.frontend.api import user_profile_pb2
from bob_emploi.frontend.server import proto_flask
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.server.mail.templates import mailjet_templates

app = flask.Blueprint('ali', __name__)


def _send_email(
        campaign_id: mailjet_templates.Id, user_profile: 'mail_send._Recipient',
        template_vars: dict[str, Any]) -> bool:
    mail_result = mail_send.send_template(
        campaign_id, user_profile, template_vars, options={
            'TrackOpens': 'disabled',
            'TrackClicks': 'disabled',
        })
    try:
        mail_result.raise_for_status()
    except requests.exceptions.HTTPError as error:
        logging.error('Failed to send an email with MailJet:\n %s', error)
        return False
    return True


# TODO(sil): Maybe return which email has been sent.
def _send_data_by_email(user_data: ali_pb2.User) -> ali_pb2.EmailStatuses:
    user_email = user_data.user_email
    user_profile = user_profile_pb2.UserProfile(email=user_email)
    counselor_email = user_data.counselor_email
    mails_sent = ali_pb2.EmailStatuses()
    template_vars = {
        'counselorEmail': counselor_email,
        'counselorName': user_data.counselor_name,
        'directLink': user_data.results_url,
        # Do not link to product module as we only want to call it Bob.
        'loginUrl': 'https://www.bob-emploi.fr/?utm_source=a-li&amp;utm_medium=email',
        'productLogoUrl': 'https://t.bob-emploi.fr/tplimg/6u2u/b/oirn/2ugx1.png',
        'productName': 'Bob',
        'userEmail': user_email,
    }

    if user_profile.email:
        mails_sent.has_user_email = _send_email('ali_connect_user', user_profile, template_vars)
    if counselor_email:
        counselor_profile = user_profile_pb2.UserProfile(email=counselor_email)
        mails_sent.has_counselor_email = _send_email(
            'ali_connect_counselor', counselor_profile, template_vars)
    return mails_sent


@app.route('/user', methods=['POST'])
@proto_flask.api(in_type=ali_pb2.User, out_type=ali_pb2.EmailStatuses)
def send_ali_user(user_data: ali_pb2.User) -> ali_pb2.EmailStatuses:
    """Send A-Li user data back by email."""

    if not user_data.user_email:
        flask.abort(400, "Impossible d'envoyer ses données à l'utilisateur·rice sans email.")
    return _send_data_by_email(user_data)
