"""Mail modules for holiday (christmas, new year, ...) mailings."""

import datetime
from typing import Any
from urllib import parse

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server.mail import campaign

# TODO(pascal): Add year to the templates once the new var is deployed in prod, then turn those
# campaigns in coaching campaigns.


def _christmas_vars(
        user: user_pb2.User, *, now: datetime.datetime,
        database: mongo.NoPiiMongoDatabase,
        **unused_kwargs: Any) -> dict[str, str]:
    """Compute all variables required for the Christmas campaign."""

    if now.month != 12 and not user.features_enabled.alpha:
        raise campaign.DoNotSend('Only send christmas email in December')

    project = next((p for p in user.projects), project_pb2.Project())

    job_search_started_months_ago = campaign.job_search_started_months_ago(project, now)
    if job_search_started_months_ago < 0:
        started_searching_since = ''
    elif job_search_started_months_ago < 2:
        started_searching_since = 'depuis peu'
    else:
        try:
            num_months = french.try_stringify_number(round(job_search_started_months_ago))
            started_searching_since = f'depuis {num_months} mois'
        except NotImplementedError:
            started_searching_since = 'depuis un moment'

    # A city to commute to.
    commute_city = next((city for a in project.advices for city in a.commute_data.cities), '')
    if commute_city:
        commute_city = french.in_city(commute_city)
    commute_advice_url = campaign.get_deep_link_advice(user.user_id, project, 'commute')
    if not commute_advice_url:
        commute_city = ''

    # A departement to relocate to.
    relocate_departement = next(
        (departement.name for a in project.advices
         for departement in a.relocate_data.departement_scores),
        '')
    if relocate_departement:
        try:
            departement_id = geo.get_departement_id(database, relocate_departement)
            relocate_departement = geo.get_in_a_departement_text(database, departement_id)
        except KeyError:
            relocate_departement = ''
    relocate_advice_url = campaign.get_deep_link_advice(user.user_id, project, 'relocate')
    if not relocate_advice_url:
        relocate_departement = ''

    # Whether the job may have freelancers.
    job_group_info = jobs.get_group_proto(database, project.target_job.job_group.rome_id)
    could_freelance = job_group_info and job_group_info.has_freelancers

    return campaign.get_default_coaching_email_vars(user) | {
        'adviceUrlBodyLanguage':
        campaign.get_deep_link_advice(user.user_id, project, 'body-language'),
        'adviceUrlCommute': commute_advice_url,
        'adviceUrlCreateYourCompany':
        campaign.get_deep_link_advice(user.user_id, project, 'create-your-company'),
        'adviceUrlExploreOtherJobs':
        campaign.get_deep_link_advice(user.user_id, project, 'explore-other-jobs'),
        'adviceUrlImproveInterview':
        campaign.get_deep_link_advice(user.user_id, project, 'improve-interview'),
        'adviceUrlRelocate': relocate_advice_url,
        'adviceUrlVolunteer':
        campaign.get_deep_link_advice(user.user_id, project, 'volunteer'),
        'couldFreelance': campaign.as_template_boolean(could_freelance),
        'emailInUrl': parse.quote(user.profile.email),
        'inCommuteCity': commute_city,
        'inRelocateDepartement': relocate_departement,
        'nextYear': str(now.year + 1),
        'startedSearchingSince': started_searching_since,
        'year': str(now.year),
    }


def _new_year_vars(
    user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any,
) -> dict[str, str]:
    """Compute all variables required for the New Year campaign."""

    if now.month != 1 and not user.features_enabled.alpha:
        raise campaign.DoNotSend('Only send new-year email in January')

    project = next((p for p in user.projects), project_pb2.Project())
    if project.passionate_level > project_pb2.PASSIONATING_JOB:
        goal = 'trouver un poste qui vous épanouira'
    elif project.kind == project_pb2.FIND_ANOTHER_JOB:
        goal = 'décrocher un nouveau poste'
    else:
        goal = 'décrocher votre prochain emploi'

    return campaign.get_default_coaching_email_vars(user) | {
        'goal': goal,
        'numberUsers': '250\u00A0000',
        'lastYear': str(now.year - 1),
        'year': str(now.year),
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='christmas',
    mongo_filters={},
    get_vars=_christmas_vars,
    is_coaching=True,
    is_big_focus=True,
    sender_name=i18n.make_translatable_string('Joanna de {{var:productName}}'),
    sender_email='joanna@bob-emploi.fr',
))
campaign.register_campaign(campaign.Campaign(
    campaign_id='new-year',
    mongo_filters={},
    get_vars=_new_year_vars,
    sender_name=i18n.make_translatable_string('Joanna de {{var:productName}}'),
    sender_email='joanna@bob-emploi.fr',
))
