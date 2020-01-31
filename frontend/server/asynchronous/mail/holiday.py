"""Mail modules for holiday (christmas, new year, ...) mailings."""

import datetime
from typing import Any, Dict, Optional
from urllib import parse

import pymongo

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import geo
from bob_emploi.frontend.server import jobs
from bob_emploi.frontend.server.asynchronous.mail import campaign


def christmas_vars(
        user: user_pb2.User, now: datetime.datetime,
        database: Optional[pymongo.database.Database] = None,
        **unused_kwargs: Any) -> Optional[Dict[str, str]]:
    """Compute all variables required for the Christmas campaign."""

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
    assert database
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

    return dict(campaign.get_default_vars(user), **{
        'adviceUrlBodyLanguage':
        campaign.get_deep_link_advice(user.user_id, project, 'body-language'),
        'adviceUrlCommute': commute_advice_url,
        'adviceUrlCreateYourCompany':
        campaign.get_deep_link_advice(user.user_id, project, 'create-your-company'),
        'adviceUrlImproveInterview':
        campaign.get_deep_link_advice(user.user_id, project, 'improve-interview'),
        'adviceUrlRelocate': relocate_advice_url,
        'couldFreelance': campaign.as_template_boolean(could_freelance),
        'emailInUrl': parse.quote(user.profile.email),
        'inCommuteCity': commute_city,
        'inRelocateDepartement': relocate_departement,
        'startedSearchingSince': started_searching_since,
    })


def new_year_vars(user: user_pb2.User, **unused_kwargs: Any) -> Optional[Dict[str, str]]:
    """Compute all variables required for the New Year campaign."""

    project = next((p for p in user.projects), project_pb2.Project())
    if project.passionate_level > project_pb2.PASSIONATING_JOB:
        goal = 'trouver un poste qui vous épanouira'
    elif project.kind == project_pb2.FIND_ANOTHER_JOB:
        goal = 'décrocher un nouveau poste'
    else:
        goal = 'décrocher votre prochain emploi'

    return dict(campaign.get_default_vars(user), goal=goal)


campaign.register_campaign('christmas', campaign.Campaign(
    mailjet_template='279688',
    mongo_filters={},
    get_vars=christmas_vars,
    sender_name='Joanna de Bob',
    sender_email='joanna@bob-emploi.fr',
))
campaign.register_campaign('new-year', campaign.Campaign(
    mailjet_template='293296',
    mongo_filters={},
    get_vars=new_year_vars,
    sender_name='Joanna de Bob',
    sender_email='joanna@bob-emploi.fr',
))
