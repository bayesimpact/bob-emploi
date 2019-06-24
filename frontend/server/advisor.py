"""Server part of the Advisor, handling mostly the Trigger logic.

See http://go/bob:advisor-design.
"""

import locale
import logging
import threading
import typing
from urllib import parse

from pymongo.database import Database
import mailjet_rest

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


def maybe_advise(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: Database,
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


def _maybe_recommend_advice(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: Database) -> bool:
    if user.features_enabled.advisor == user_pb2.CONTROL or project.advices:
        return False
    advices = compute_advices_for_project(user, project, database)
    for piece_of_advice in advices.advices:
        piece_of_advice.status = project_pb2.ADVICE_RECOMMENDED
    project.advices.extend(advices.advices[:])
    return True


def compute_advices_for_project(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: Database,
        scoring_timeout_seconds: float = 3) -> project_pb2.Advices:
    """Advise on a user project.

    Args:
        user: the user's data, mainly used for their profile and features_enabled.
        project: the project data. It will not be modified.
        database: access to the MongoDB with market data.
    Returns:
        an Advices protobuffer containing a list of recommendations.
    """

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    scores: typing.Dict[str, float] = {}
    reasons: typing.Dict[str, typing.List[str]] = {}
    advice_modules = _advice_modules(database)
    advice = project_pb2.Advices()
    for module in advice_modules:
        if not module.is_ready_for_prod and not user.features_enabled.alpha:
            continue
        scoring_model = scoring.get_scoring_model(module.trigger_scoring_model)
        if scoring_model is None:
            logging.warning(
                'Not able to score advice "%s", the scoring model "%s" is unknown.',
                module.advice_id, module.trigger_scoring_model)
            continue
        if user.features_enabled.all_modules:
            scores[module.advice_id] = 3
        else:
            thread = threading.Thread(
                target=_compute_score_and_reasons,
                args=(scores, reasons, module, scoring_model, scoring_project))
            thread.start()
            # TODO(pascal): Consider scoring different models in parallel.
            thread.join(timeout=scoring_timeout_seconds)
            if thread.is_alive():
                logging.warning(
                    'Timeout while scoring advice "%s" for:\n%s',
                    module.trigger_scoring_model, scoring_project)

    modules = sorted(
        advice_modules,
        key=lambda m: (scores.get(m.advice_id, 0), m.advice_id),
        reverse=True)
    incompatible_modules: typing.Set[str] = set()
    for module in modules:
        score = scores.get(module.advice_id)
        if not score:
            # We can break as others will have 0 score as well.
            break
        if module.airtable_id in incompatible_modules and not user.features_enabled.all_modules:
            continue
        piece_of_advice = advice.advices.add()
        piece_of_advice.advice_id = module.advice_id
        piece_of_advice.num_stars = score
        piece_of_advice.explanations.extend(
            scoring_project.populate_template(reason)
            for reason in reasons.get(module.advice_id, []))
        if not module.is_ready_for_prod:
            piece_of_advice.is_for_alpha_only = True

        incompatible_modules.update(module.incompatible_advice_ids)

        _maybe_override_advice_data(piece_of_advice, module, scoring_project)

    if not advice.advices:
        logging.warning(
            'We could not find *any* advice for a project:\n%s', scoring_project)

    return advice


def _compute_score_and_reasons(
        scores: typing.Dict[str, float],
        reasons: typing.Dict[str, typing.List[str]],
        module: advisor_pb2.AdviceModule,
        scoring_model: scoring.ModelBase,
        scoring_project: scoring.ScoringProject) -> None:
    try:
        scores[module.advice_id], reasons[module.advice_id] = \
            scoring_model.score_and_explain(scoring_project)
    except Exception:  # pylint: disable=broad-except
        logging.exception(
            'Scoring "%s" crashed for:\n%s', module.trigger_scoring_model, scoring_project)


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


def _send_activation_email(
        user: user_pb2.User,
        project: project_pb2.Project,
        database: Database,
        base_url: str) -> None:
    """Send an email to the user just after we have defined their diagnosis."""

    if '@' not in user.profile.email:
        return

    # Set locale.
    locale.setlocale(locale.LC_ALL, 'fr_FR.UTF-8')

    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    auth_token = parse.quote(auth.create_token(user.user_id, is_using_timestamp=True))
    settings_token = parse.quote(auth.create_token(user.user_id, role='settings'))
    data = {
        'changeEmailSettingsUrl':
            '{}/unsubscribe.html?user={}&auth={}&coachingEmailFrequency={}'.format(
                base_url, user.user_id,
                settings_token, user_pb2.EmailFrequency.Name(
                    user.profile.coaching_email_frequency)),
        'date': now.get().strftime('%d %B %Y'),
        'firstName': user.profile.name,
        'gender': user_pb2.Gender.Name(user.profile.gender),
        'loginUrl': '{}?userId={}&authToken={}'.format(base_url, user.user_id, auth_token),
        'ofJob': scoring_project.populate_template('%ofJobName', raise_on_missing_var=True),
    }
    # https://app.mailjet.com/template/636862/build
    response = mail.send_template('636862', user.profile, data)
    if response.status_code != 200:
        logging.warning(
            'Error while sending diagnostic email: %s\n%s', response.status_code, response.text)


def _translate_tip(
        tip: action_pb2.ActionTemplate,
        scoring_project: scoring.ScoringProject) -> action_pb2.ActionTemplate:
    is_feminine = scoring_project.user_profile.gender == user_pb2.FEMININE

    title = (is_feminine and tip.title_feminine) or tip.title
    short_description = (is_feminine and tip.short_description_feminine) or tip.short_description

    result = action_pb2.ActionTemplate()
    result.MergeFrom(tip)
    result.ClearField('title_feminine')
    result.ClearField('short_description_feminine')
    result.title = scoring_project.translate_string(title)
    result.short_description = scoring_project.translate_string(short_description)

    return result


def list_all_tips(
        user: user_pb2.User,
        project: project_pb2.Project,
        piece_of_advice: project_pb2.Advice,
        database: Database) -> typing.List[action_pb2.ActionTemplate]:
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
    scoring_project = scoring.ScoringProject(
        project, user.profile, user.features_enabled, database, now=now.get())
    filtered_tips = scoring.filter_using_score(
        tip_templates, lambda t: t.filters, scoring_project)

    return [_translate_tip(tip, scoring_project) for tip in filtered_tips]


# Cache (from MongoDB) of known advice module.
_ADVICE_MODULES: proto.MongoCachedCollection[advisor_pb2.AdviceModule] = \
    proto.MongoCachedCollection(advisor_pb2.AdviceModule, 'advice_modules')


def _advice_modules(database: Database) -> proto.CachedCollection[advisor_pb2.AdviceModule]:
    return _ADVICE_MODULES.get_collection(database)


def get_advice_module(advice_id: str, database: Database) \
        -> typing.Optional[advisor_pb2.AdviceModule]:
    """Get a module by its ID."""

    return next((a for a in _advice_modules(database) if a.advice_id == advice_id), None)


# Cache (from MongoDB) of known tip templates.
_TIP_TEMPLATES: proto.MongoCachedCollection[action_pb2.ActionTemplate] = \
    proto.MongoCachedCollection(action_pb2.ActionTemplate, 'tip_templates')


def _tip_templates(database: Database) -> proto.CachedCollection[action_pb2.ActionTemplate]:
    """Returns a list of known tip templates as protos."""

    return _TIP_TEMPLATES.get_collection(database)
