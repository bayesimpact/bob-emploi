"""Helper for the mail campaign modules."""

import collections
import datetime
import os
from urllib import parse

from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import jobs


# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

'''A Named tuple to define a campaign for blasting mails.

    - mailjet_template: the mailjet ID for the template.
    - mongo_filters: A filter on the mongoDB table for users, to select those that may receive this
      campaign.
    - get_vars: a function to retrieve the template variables from a user and a database.
      This should be of the form get_vars(user, db) and return a dict that can be converted to JSON
      object, that can be accepted by MailJet templating API:
      https://dev.mailjet.com/template-language/reference/
      If a given user should not be sent the campaign, return None.
    - sender_name: the human readable name for the sender of this campaign.
    - sender_email: an email address for the sender of this email.
      Should be <something>@bob-emploi.fr
'''
Campaign = collections.namedtuple('Campaign', [
    'mailjet_template', 'mongo_filters', 'get_vars', 'sender_name', 'sender_email'])


_CAMPAIGNS = {}


def register_campaign(campaign_id, campaign):
    """Registers an email campaign."""

    if campaign_id in _CAMPAIGNS:
        raise ValueError('The campaign "{}" already exists.'.format(campaign_id))
    _CAMPAIGNS[campaign_id] = campaign


def get_campaign(campaign_id):
    """Fetch an email campaign."""

    return _CAMPAIGNS[campaign_id]


def list_all_campaigns():
    """Fetch all available campaign IDs."""

    return _CAMPAIGNS.keys()


def as_template_boolean(truth):
    """puts truth value of input as 'True' or '' in template vars."""

    return 'True' if truth else ''


def get_status_update_link(user_id, profile):
    """Make link with token from user ID for RER status update."""

    survey_token = parse.quote(auth.create_token(user_id, role='employment-status'))
    return '{}/statut/mise-a-jour?user={}&token={}&gender={}{}'.format(
        BASE_URL,
        user_id,
        survey_token,
        user_pb2.Gender.Name(profile.gender),
        '&can_tutoie=true' if profile.can_tutoie else '')


# TODO(cyrille): Fix this to account for same mode in different FAPs.
def get_application_modes(rome_id, database):
    """Fetch all possible application modes for all FAP corresponding to the given ROME."""

    job_group_info = jobs.get_group_proto(database, rome_id)
    if not job_group_info:
        return None
    application_modes = job_group_info.application_modes.values()
    fap_modes = [fap_modes.modes for fap_modes in application_modes if fap_modes.modes]
    if not fap_modes:
        return None
    return [mode for modes in fap_modes for mode in modes]


def get_french_months_ago(instant):
    """Duration in months from given instant to now, in a French phrase.
    If duration is negative, returns None.
    """

    duration_since_instant = datetime.datetime.now() - instant
    month_since_instant = round(duration_since_instant.days / 30.5)
    if month_since_instant < 1:
        return None
    if month_since_instant > 6:
        return 'plus de six'
    try:
        return french.try_stringify_number(month_since_instant)
    except NotImplementedError:
        return 'quelques'


def create_logged_url(user_id, path=''):
    """Returns a route with given path and necessary query parameters for authentication."""

    auth_token = parse.quote(auth.create_token(user_id, role='auth', is_using_timestamp=True))
    return '{}{}?user={}&authToken={}'.format(BASE_URL, path, user_id, auth_token)


def job_search_started_months_ago(project):
    """Number of months since project started until now. If project has not started, return -1."""

    if project.job_search_has_not_started\
            or not project.HasField('job_search_started_at'):
        # TODO(pascal): Clean this up when this field is fully redundant in the DB.
        if project.job_search_length_months and project.HasField('created_at'):
            delta = datetime.datetime.now() - project.created_at.ToDatetime()
            return project.job_search_length_months + (delta.days / 30.5)
        return -1
    delta = datetime.datetime.now() - project.job_search_started_at.ToDatetime()
    return delta.days / 30.5


def get_default_vars(user):
    """Compute default variables used in all emails: firstName, gender and unsubscribeLink."""

    unsubscribe_token = parse.quote(auth.create_token(user.profile.email, role='unsubscribe'))
    return {
        'firstName': french.cleanup_firstname(user.profile.name),
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'unsubscribeLink': '{}/unsubscribe.html?email={}&auth={}'.format(
            BASE_URL, parse.quote(user.profile.email),
            unsubscribe_token),
    }
