"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""

import locale
import logging
import os
from typing import Any, Iterable, Iterator, Mapping, Optional, Set, Tuple
from urllib import parse

import mailjet_rest

from bob_emploi.common.python import now
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.server import auth_token as token
from bob_emploi.frontend.server.mail import campaign
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import email_pb2
from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


def maybe_advise(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: mongo.NoPiiMongoDatabase,
        base_url: str = 'http://localhost:3000') -> None:
    """Check if a project needs advice and populate all advice fields if not.

    Args:
        user: the full user info.
        project: the project to advise. This proto will be modified.
    """

    if project.is_incomplete:
        return
    if _maybe_recommend_advice(user, project, database) and project.advices:
        try:
            _send_activation_email(user, project, database, base_url)
        except mailjet_rest.client.ApiError as error:
            logging.warning('Could not send the activation email: %s', error)


def maybe_send_late_activation_emails(
        user: user_pb2.User,
        database: mongo.NoPiiMongoDatabase,
        base_url: str) -> None:
    """Send activation emails for projects already advised but that had no email at the time."""

    for project in user.projects:
        if project.advices:
            try:
                _send_activation_email(user, project, database, base_url)
            except mailjet_rest.client.ApiError as error:
                logging.warning('Could not send the activation email: %s', error)


def _maybe_recommend_advice(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: mongo.NoPiiMongoDatabase) -> bool:
    if user.features_enabled.advisor == features_pb2.CONTROL:
        return False
    scoring_project = scoring.ScoringProject(project, user, database, now=now.get())
    if user.features_enabled.action_plan == features_pb2.ACTIVE and not project.actions:
        compute_actions_for_project(scoring_project)
    if project.advices:
        return False
    advices = compute_advices_for_project(scoring_project)
    for piece_of_advice in advices.advices:
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
    project.advices.extend(advices.advices[:])
    return True


def compute_advices_for_project(
        scoring_project: scoring.ScoringProject,
        scoring_timeout_seconds: float = 3) -> project_pb2.Advices:
    """Advise on a user project.

    Args:
        user: the user's data, mainly used for their profile and features_enabled.
        project: the project data. It will not be modified.
        database: access to the MongoDB with market data.
        scoring_timeout_seconds: how long we wait to compute each advice scoring model.
    Returns:
        an Advices protobuffer containing a list of recommendations.
    """

    advice_modules = _advice_modules(scoring_project.database)
    advices = project_pb2.Advices()
    advices.advices.extend(advice for advice, _ in compute_available_methods(
        scoring_project, advice_modules, scoring_timeout_seconds))
    return advices


def compute_available_methods(
        scoring_project: scoring.ScoringProject,
        method_modules: Iterable[advisor_pb2.AdviceModule],
        scoring_timeout_seconds: float = 3) \
        -> Iterator[Tuple[project_pb2.Advice, frozenset[str]]]:
    """Advise on a user project.

    Args:
        scoring_project: the user's data.
        advice_modules: a list of modules, from which we want to derive the advices.
        scoring_timeout_seconds: how long we wait to compute each advice scoring model.
    Returns:
        an Iterator of recommendations, each with a list of fields that would help improve
        the process.
    """

    ready_modules = {
        module.advice_id: module.trigger_scoring_model
        for module in method_modules
        if module.is_ready_for_prod or scoring_project.features_enabled.alpha
    }

    scores: Mapping[str, float] = {}
    reasons: Mapping[str, tuple[str, ...]] = {}
    missing_fields: Mapping[str, frozenset[str]] = {}

    if scoring_project.user.features_enabled.all_modules:
        scores = {key: 3 for key in ready_modules}
    else:
        scores, reasons, missing_fields = scoring_project.score_and_explain_all(
            ready_modules.items(), scoring_timeout_seconds=scoring_timeout_seconds)

    modules = sorted(
        method_modules,
        key=lambda m: (scores.get(m.advice_id, 0), m.advice_id),
        reverse=True)
    incompatible_modules: Set[str] = set()
    has_module = False
    for module in modules:
        score = scores.get(module.advice_id)
        if not score:
            # We can break as others will have 0 score as well.
            break
        if module.airtable_id in incompatible_modules and \
                not scoring_project.user.features_enabled.all_modules:
            continue
        piece_of_advice = project_pb2.Advice(
            advice_id=module.advice_id,
            num_stars=score,
            is_for_alpha_only=not module.is_ready_for_prod)
        piece_of_advice.explanations.extend(
            scoring_project.populate_template(reason)
            for reason in reasons.get(module.advice_id, []))

        incompatible_modules.update(module.incompatible_advice_ids)

        _maybe_override_advice_data(piece_of_advice, module, scoring_project)
        has_module = True
        yield piece_of_advice, missing_fields.get(module.advice_id, frozenset())

    if not has_module and method_modules:
        logging.warning(
            'We could not find *any* advice for a project:\nModules tried:\n"%s"\nProject:\n%s',
            '", "'.join(m.advice_id for m in method_modules),
            scoring_project)


def _maybe_override_advice_data(
        piece_of_advice: project_pb2.Advice,
        module: advisor_pb2.AdviceModule,
        scoring_project: scoring.ScoringProject) -> None:
    scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
    if not scoring_model:
        return
    override_data = scoring_model.get_advice_override(scoring_project, piece_of_advice)
    if not override_data:
        # Nothing to override.
        return
    piece_of_advice.MergeFrom(override_data)


# Cache (from MongoDB) of known action templates.
_ACTION_TEMPLATES: proto.MongoCachedCollection[action_pb2.ActionTemplate] = \
    proto.MongoCachedCollection(action_pb2.ActionTemplate, 'action_templates')


def compute_actions_for_project(
    scoring_project: scoring.ScoringProject,
) -> Iterable[action_pb2.Action]:
    """Compute all actions possible for a project."""

    action_templates = {
        action.action_template_id: action
        for action in _ACTION_TEMPLATES.get_collection(scoring_project.database)
    }
    if scoring_project.user.features_enabled.all_modules:
        scores: Mapping[str, float] = {key: 3 for key in action_templates}
    else:
        scores = scoring_project.score_and_explain_all(
            (key, action_template.trigger_scoring_model)
            for key, action_template in action_templates.items()).scores
    sorted_action_templates = sorted(
        action_templates.values(),
        key=lambda m: (scores.get(m.action_template_id, 0), m.action_template_id),
        reverse=True)
    deployment = os.getenv('BOB_DEPLOYMENT', 'fr')
    for action_template in sorted_action_templates:
        action_id = action_template.action_template_id
        if not (score := scores.get(action_id)) or score <= 0:
            break
        scoring_project.details.actions.add(
            action_id=action_id,
            title=scoring_project.translate_airtable_string(
                'actionTemplates', action_id, 'title', hint=action_template.title,
                is_genderized=True),
            short_description=scoring_project.translate_airtable_string(
                'actionTemplates', action_id, 'short_description',
                hint=action_template.short_description, is_genderized=True),
            tags=[
                scoring_project.translate_airtable_string('actionTemplates', 'tags', tag)
                for tag in action_template.tags],
            duration=action_template.duration,
            status=action_pb2.ACTION_UNREAD,
            advice_id=action_template.advice_id,
            resource_url=scoring_project.translate_airtable_string(
                'actionTemplates', action_id, 'resource_url',
                hint=action_template.resource_url, context=deployment),
        )
    return scoring_project.details.actions[:]


def _send_activation_email(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: mongo.NoPiiMongoDatabase,
        base_url: str) -> None:
    """Send an email to the user just after we have defined their diagnosis."""

    if '@' not in user.profile.email:
        return

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

    scoring_project = scoring.ScoringProject(project, user, database, now=now.get())
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
            invite_url=parse.urljoin(base_url, 'invite#vm2m'),
            first_name=user.profile.name),
        'subject': scoring_project.translate_static_string("Ça m'a fait penser à toi"),
    })
    change_email_settings_url = parse.urljoin(base_url, 'unsubscribe.html?' + parse.urlencode({
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
    data: dict[str, Any] = campaign.get_default_vars(user)
    data |= {
        'changeEmailSettingsUrl': change_email_settings_url,
        'date': now.get().strftime(date_format),
        'firstTeamMember': team_members[0],
        'isCoachingEnabled':
            'True' if
            user.profile.coaching_email_frequency and
            user.profile.coaching_email_frequency != email_pb2.EMAIL_NONE
            else '',
        'loginUrl': parse.urljoin(base_url, f'?userId={user.user_id}&authToken={auth_token}'),
        'numberUsers': '270\u00A0000',
        'numberTeamMembers': len(team_members),
        'ofJob': scoring_project.populate_template('%ofJobName', raise_on_missing_var=True),
        'teamMembers': ', '.join(team_members[1:]),
        'viralityTemplate': f'mailto:?{virality_template}'
    }
    # https://app.mailjet.com/template/636862/build
    # TODO(cyrille): Use all_campaigns.send_campaign
    response = mail_send.send_template('activation-email', user.profile, data)
    if response.status_code != 200:
        logging.warning(
            'Error while sending diagnostic email: %s\n%s', response.status_code, response.text)


def _translate_tip(
        tip: action_pb2.ActionTemplate,
        scoring_project: scoring.ScoringProject) -> action_pb2.ActionTemplate:
    result = action_pb2.ActionTemplate()
    result.MergeFrom(tip)
    result.title = scoring_project.translate_string(
        tip.title, is_genderized=True)
    result.short_description = scoring_project.translate_string(
        tip.short_description, is_genderized=True)

    return result


def list_all_tips(
        user: user_pb2.User,
        project: project_pb2.Project,
        piece_of_advice: project_pb2.Advice,
        database: mongo.NoPiiMongoDatabase) -> list[action_pb2.ActionTemplate]:
    """List all available tips for a piece of advice.

    Args:
        user: the full user info.
        project: the project to give tips for.
        piece_of_advice: the piece of advice to give tips for.
        database: access to the database to get modules and tips.
    Returns:
        An iterable of tips for this module.
    """

    try:
        module = next(
            m for m in _advice_modules(database)
            if m.advice_id == piece_of_advice.advice_id)
    except StopIteration:
        logging.warning('Advice module %s does not exist anymore', piece_of_advice.advice_id)
        return []

    # Get tip templates.
    all_tip_templates = _tip_templates(database)
    tip_templates = filter(None, (all_tip_templates.get(t) for t in module.tip_template_ids))

    # Filter tips.
    scoring_project = scoring.ScoringProject(project, user, database, now=now.get())
    filtered_tips = scoring.filter_using_score(
        tip_templates, lambda t: t.filters, scoring_project)

    return [_translate_tip(tip, scoring_project) for tip in filtered_tips]


# Cache (from MongoDB) of known advice module.
_ADVICE_MODULES: proto.MongoCachedCollection[advisor_pb2.AdviceModule] = \
    proto.MongoCachedCollection(advisor_pb2.AdviceModule, 'advice_modules')


def _advice_modules(database: mongo.NoPiiMongoDatabase) \
        -> proto.CachedCollection[advisor_pb2.AdviceModule]:
    return _ADVICE_MODULES.get_collection(database)


def get_advice_module(advice_id: str, database: mongo.NoPiiMongoDatabase) \
        -> Optional[advisor_pb2.AdviceModule]:
    """Get a module by its ID."""

    return next((a for a in _advice_modules(database) if a.advice_id == advice_id), None)


# Cache (from MongoDB) of known tip templates.
_TIP_TEMPLATES: proto.MongoCachedCollection[action_pb2.ActionTemplate] = \
    proto.MongoCachedCollection(action_pb2.ActionTemplate, 'tip_templates')


def _tip_templates(database: mongo.NoPiiMongoDatabase) \
        -> proto.CachedCollection[action_pb2.ActionTemplate]:
    """Returns a list of known tip templates as protos."""

    return _TIP_TEMPLATES.get_collection(database)
