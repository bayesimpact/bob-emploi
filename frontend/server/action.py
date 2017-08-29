"""Module to handle actions logic."""
import itertools
import logging
import random
import re
import time
from urllib import parse

import unidecode

from bob_emploi.frontend import companies
from bob_emploi.frontend import now
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import user_pb2

# Matches a title that is about "any company that...", e.g. "Postuler à une
# entreprise".
_ANY_COMPANY_REGEXP = re.compile('^(.*) une entreprise')


def instantiate(action, user_proto, project, template, for_email=False):
    """Instantiate a newly created action from a template.

    Args:
        action: the action to be populated from the template.
        user_proto: the whole user data.
        project: the whole project data.
        template: the action template to instantiate.
        for_email: whether the action is to be sent in an email.
    Returns:
        the populated action for chaining.
    """
    action.action_id = '%s-%s-%x-%x' % (
        project.project_id,
        template.action_template_id,
        round(time.time()),
        random.randrange(0x10000))
    action.action_template_id = template.action_template_id
    action.title = template.title
    action.title_feminine = template.title_feminine
    action.short_description = template.short_description
    action.short_description_feminine = template.short_description_feminine
    action.link = populate_template(
        template.link, project.mobility.city, project.target_job)
    action.how_to = template.how_to
    action.status = action_pb2.ACTION_UNREAD
    action.created_at.FromDatetime(now.get())
    action.image_url = template.image_url
    if for_email:
        if template.email_title:
            action.title = template.email_title
        action.link_label = template.email_link_label
        action.keyword = template.email_subject_keyword

    if (template.special_generator == action_pb2.LA_BONNE_BOITE and
            user_proto.features_enabled.lbb_integration == user_pb2.ACTIVE):
        _get_company_from_lbb(project, action.apply_to_company)
        if action.apply_to_company.name:
            title_match = _ANY_COMPANY_REGEXP.match(action.title)
            if title_match:
                company_name = action.apply_to_company.name
                if action.apply_to_company.city_name:
                    company_name += ' (%s)' % action.apply_to_company.city_name
                else:
                    logging.warning(
                        'LBB Action %s is missing a city name (user %s).',
                        action.action_id, user_proto.user_id)
                action.title = title_match.group(1) + ' l\'entreprise : ' + company_name
            else:
                logging.warning(
                    'LBB Action %s does not have a title that can be updated (user %s).',
                    action.action_id, user_proto.user_id)

    return action


def populate_template(template, city, job):
    """Populate a template with project variables.

    Args:
        template: a string that may or may not contain placeholders e.g.
            %romeId, %departementId.
        city: the city to target.
        job: the job to target.
    Returns:
        A string with the placeholder replaced by actual values.
    """
    if '%' not in template:
        return template
    project_vars = {
        '%cityId': city.city_id,
        '%cityName': parse.quote(city.name),
        '%latin1CityName': parse.quote(city.name.encode('latin-1', 'replace')),
        '%departementId': city.departement_id,
        '%postcode': city.postcodes.split('-')[0] or (
            city.departement_id + '0' * (5 - len(city.departement_id))),
        '%regionId': city.region_id,
        '%romeId': job.job_group.rome_id,
        '%jobId': job.code_ogr,
        '%jobGroupNameUrl': parse.quote(unidecode.unidecode(
            job.job_group.name.lower().replace(' ', '-').replace('\'', '-'))),
        '%masculineJobName': parse.quote(job.masculine_name),
        '%latin1MasculineJobName': parse.quote(job.masculine_name.encode('latin-1', 'replace')),
    }
    pattern = re.compile('|'.join(project_vars.keys()))
    return pattern.sub(lambda v: project_vars[v.group(0)], template)


def _get_company_from_lbb(project, company):
    lbb_companies = companies.get_lbb_companies(project)
    apply_to_companies = set(
        action.apply_to_company.siret
        for action in itertools.chain(project.actions, project.past_actions)
        if action.apply_to_company.siret)
    try:
        lbb_company = next(c for c in lbb_companies if c.get('siret') not in apply_to_companies)
    except StopIteration:
        logging.warning(
            'Could not find any companies with LBB:\nCity: %s\nJob group: %s\nApplied: %s',
            project.mobility.city.city_id, project.target_job.job_group, apply_to_companies)
        return False
    company.MergeFrom(companies.to_proto(lbb_company))
    return True
