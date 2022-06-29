"""Coaching email campaigns to promote spontaneous applications."""

import datetime
import locale
import logging
from typing import Any, Literal
from urllib import parse

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth_token as token
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import product
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server.mail import campaign


_CAMPAIGN_ID: Literal['activation-email'] = 'activation-email'


def _get_vars(
        user: user_pb2.User, *, now: datetime.datetime, database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:

    if not user.projects or not user.projects[0].actions:
        raise campaign.DoNotSend('User has no project or no actions yet')

    project = user.projects[0]

    most_recent_date = max(d.ToDatetime() for d in (
        user.registered_at, project.created_at, project.action_plan_started_at))
    if (now - most_recent_date).days > 7:
        raise campaign.DoNotSend('User has registered a while ago, too late to send the activation')

    # Set locale.
    user_locale = user.profile.locale.split('@', 1)[0]
    date_format = '%d %B %Y'
    if user_locale == 'fr' or not user_locale:
        locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')
    elif user_locale == 'en_UK':
        locale.setlocale(locale.LC_ALL, 'en_GB.UTF-8')
        date_format = '%B %d %Y'
    elif user_locale == 'en':
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
        date_format = '%B %d %Y'
    else:
        logging.exception('Sending an email with an unknown locale: %s', user_locale)

    scoring_project = scoring.ScoringProject(project, user, database, now=now)
    auth_token = parse.quote(token.create_token(user.user_id, is_using_timestamp=True))
    settings_token = parse.quote(token.create_token(user.user_id, role='settings'))
    coaching_email_frequency_name = \
        email_pb2.EmailFrequency.Name(user.profile.coaching_email_frequency)
    # This uses tutoiement by default, because its content adressed from the user to a third party
    # (that we assume the user is familiar enough with), not from Bob to the user.
    virality_template = parse.urlencode({
        'body': scoring_project.translate_static_string(
            'Salut,\n\n'
            "Est-ce que tu connais Bob\u00A0? C'est un site qui propose de t'aider dans ta "
            "recherche d'emploi en te proposant un diagnostic et des conseils personnalisés. "
            'Tu verras, ça vaut le coup\u00A0: en 15 minutes, tu en sauras plus sur où tu en es, '
            'et ce que tu peux faire pour avancer plus efficacement. '
            "Et en plus, c'est gratuit\u00A0!\n\n"
            '{invite_url}\n\n'
            'En tous cas, bon courage pour la suite,\n\n'
            '{first_name}',
        ).format(
            invite_url=parse.urljoin(product.bob.base_url, 'invite#vm2m'),
            first_name=user.profile.name),
        'subject': scoring_project.translate_static_string("Ça m'a fait penser à toi"),
    })
    change_email_settings_url = parse.urljoin(
        product.bob.base_url, 'unsubscribe.html?' + parse.urlencode({
            'user': user.user_id,
            'auth': settings_token,
            'coachingEmailFrequency': coaching_email_frequency_name,
            'hl': user.profile.locale,
        }))
    team_members = (
        'Tabitha',
        'Paul',
        'John',
        'Pascal',
        'Sil',
        'Cyrille',
        'Flo',
        'Nicolas',
        'Florian',
        'Lillie',
        'Benjamin',
        'Émilie',
    )

    # Selected and pending actions.
    highlighted_actions = [
        action for action in project.actions
        if action.status == action_pb2.ACTION_CURRENT]
    if len(highlighted_actions) < 2:
        highlighted_actions.extend(
            action for action in project.actions
            if action.status == action_pb2.ACTION_UNREAD)
    else:
        highlighted_actions = sorted(
            highlighted_actions, key=lambda action: action.expected_completion_at.ToDatetime())
    actions = [
        {
            'title': action.title,
            'url': parse.urljoin(
                product.bob.base_url,
                f'/projet/{project.project_id}/action/{action.action_id}'
                f'?userId={user.user_id}&authToken={auth_token}')
        }
        for action in highlighted_actions[:2]
    ]

    data: dict[str, Any] = campaign.get_default_vars(user)
    data |= {
        'actions': actions,
        'changeEmailSettingsUrl': change_email_settings_url,
        'coachingEmailFrequency':
            email_pb2.EmailFrequency.Name(user.profile.coaching_email_frequency) if
            user.profile.coaching_email_frequency and
            user.profile.coaching_email_frequency != email_pb2.EMAIL_NONE
            else '',
        'date': now.strftime(date_format),
        'firstTeamMember': team_members[0],
        'isActionPlanCompleted': project.HasField('action_plan_started_at'),
        'isCoachingEnabled':
            'True' if
            user.profile.coaching_email_frequency and
            user.profile.coaching_email_frequency != email_pb2.EMAIL_NONE
            else '',
        'loginUrl':
            parse.urljoin(product.bob.base_url, f'?userId={user.user_id}&authToken={auth_token}'),
        'numActions': len(actions),
        'numberUsers': '270\u00A0000',
        'numberTeamMembers': len(team_members),
        'ofJob':
            scoring_project.populate_template('%ofJobName', raise_on_missing_var=True)
            if project.target_job.name else '',
        'teamMembers': ', '.join(team_members[1:]),
        'viralityTemplate': f'mailto:?{virality_template}'
    }
    return data


# TODO(pascal): Add a daily mail_blast once this code is live.
campaign.register_campaign(campaign.Campaign(
    campaign_id=_CAMPAIGN_ID,
    mongo_filters={
        'projects': {'$elemMatch': {
            'jobSearchHasNotStarted': {'$ne': True},
            'isIncomplete': {'$ne': True},
            'actions.0': {'$exists': True},
        }},
        'emailsSent': {'$not': {'$elemMatch': {'campaignId': _CAMPAIGN_ID}}},
    },
    get_vars=_get_vars,
    sender_name=i18n.make_translatable_string(
        "{{var:firstTeamMember}} et l'équipe de {{var:productName}}"),
    sender_email='bob@bob-emploi.fr',
))
