"""Module to handle actions logic."""
import datetime
import itertools
import logging
import os
import random
import re
import time
from urllib import parse

import emploi_store
import unidecode

from bob_emploi.frontend import now
from bob_emploi.frontend import proto
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import user_pb2

_EMPLOI_STORE_DEV_CLIENT_ID = os.getenv('EMPLOI_STORE_CLIENT_ID')
_EMPLOI_STORE_DEV_SECRET = os.getenv('EMPLOI_STORE_CLIENT_SECRET')

# Matches a title that is about "any company that...", e.g. "Postuler à une
# entreprise".
_ANY_COMPANY_REGEXP = re.compile('^(.*) une entreprise')


def instantiate(
        action, user_proto, project, template, activated_chantiers, database,
        all_chantiers):
    """Instantiate a newly created action from a template.

    Args:
        action: the action to be populated from the template.
        user_proto: the whole user data.
        project: the whole project data.
        template: the action template to instantiate.
        activated_chantiers: a set of chantier IDs that are active.
        database: access to the Mongo DB.
        all_chantiers: a dict of all chantiers.
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

    if user_proto.features_enabled.sticky_actions == user_pb2.ACTIVE:
        action.goal = template.goal
        action.sticky_action_incentive = template.sticky_action_incentive
        sticky_action_steps = _sticky_action_steps(database)
        action.steps.extend([
            sticky_action_steps.get(step_id)
            for step_id in template.step_ids
            if sticky_action_steps.get(step_id)])
        for i, step in enumerate(action.steps):
            step.step_id = '%s-%x' % (action.action_id, i)
            # Populate all string fields as templates.
            for field_descriptor in step.DESCRIPTOR.fields:
                if field_descriptor.type != field_descriptor.TYPE_STRING:
                    continue
                field_name = field_descriptor.name
                field = getattr(step, field_name)
                if field:
                    setattr(step, field_name, populate_template(
                        field, project.mobility.city, project.target_job))

    if (template.special_generator == action_pb2.LA_BONNE_BOITE and
            user_proto.features_enabled.lbb_integration == user_pb2.ACTIVE):
        _get_company_from_lbb(project, action.apply_to_company, database)
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
                action.title = title_match.group(1) + " l'entreprise : " + company_name
            else:
                logging.warning(
                    'LBB Action %s does not have a title that can be updated (user %s).',
                    action.action_id, user_proto.user_id)

    for chantier_id in activated_chantiers & set(template.chantiers):
        chantier = action.chantiers.add()
        chantier.chantier_id = chantier_id
        chantier.kind = all_chantiers[chantier_id].kind
        chantier.title = all_chantiers[chantier_id].title
        chantier.title_first_person = all_chantiers[chantier_id].title_first_person

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
            job.job_group.name.lower().replace(' ', '-').replace("'", '-'))),
        '%masculineJobName': parse.quote(job.masculine_name),
        '%latin1MasculineJobName': parse.quote(job.masculine_name.encode('latin-1', 'replace')),
    }
    pattern = re.compile('|'.join(project_vars.keys()))
    return pattern.sub(lambda v: project_vars[v.group(0)], template)


def stop(action, database):
    """Mark an action as stopped and handle its cool down time."""
    if action.HasField('stopped_at'):
        return
    action.stopped_at.FromDatetime(now.get())
    if action.status == action_pb2.ACTION_SNOOZED:
        action.end_of_cool_down.FromDatetime(now.get())
        return
    if action.status in (
            action_pb2.ACTION_UNREAD, action_pb2.ACTION_CURRENT, action_pb2.ACTION_STUCK):
        # This action was not completed, so we will show it later, but not for
        # the next 2 days so that actions change every day.
        action.end_of_cool_down.FromDatetime(now.get() + datetime.timedelta(days=2))
        return
    if action.status not in (action_pb2.ACTION_DONE, action_pb2.ACTION_STICKY_DONE):
        return
    action_template = templates(database).get(action.action_template_id)
    if not action_template or action_template.cool_down_duration_days == 0:
        return
    action.end_of_cool_down.FromDatetime(
        now.get() + datetime.timedelta(days=action_template.cool_down_duration_days))


def clear_cache():
    """Clear all caches for this module."""
    _ACTION_TEMPLATES.clear()
    _STICKY_ACTION_STEPS.clear()


def _get_company_from_lbb(project, company, database):
    if not _EMPLOI_STORE_DEV_CLIENT_ID or not _EMPLOI_STORE_DEV_SECRET:
        logging.warning('Missing Emploi Store Dev identifiers.')
        return False
    client = emploi_store.Client(
        client_id=_EMPLOI_STORE_DEV_CLIENT_ID,
        client_secret=_EMPLOI_STORE_DEV_SECRET)
    city_proto = geo_pb2.FrenchCity()
    if not proto.parse_from_mongo(
            database.cities.find_one({'_id': project.mobility.city.city_id}), city_proto):
        logging.warning('No coordinates for city %s', project.mobility.city.city_id)
        return False
    try:
        lbb_companies = client.get_lbb_companies(
            latitude=city_proto.latitude, longitude=city_proto.longitude,
            rome_codes=[project.target_job.job_group.rome_id])
    except IOError as error:
        logging.error('Error while calling LBB API: %s\n%s', error, project)
        return False
    apply_to_companies = set(
        action.apply_to_company.siret
        for action in itertools.chain(project.actions, project.past_actions)
        if action.apply_to_company.siret)
    try:
        lbb_company = next(c for c in lbb_companies if c.get('siret') not in apply_to_companies)
    except IOError as error:
        logging.error('Error while calling LBB API: %s\n%s', error, project)
        return False
    except StopIteration:
        logging.warning('Could not find any companies with LBB:\n%s', project)
        return False
    company.name = lbb_company.get('name', '')
    company.siret = lbb_company.get('siret', '')
    company.city_name = lbb_company.get('city', '')
    company.activity_sector_name = lbb_company.get('naf_text', '')
    company.headcount_text = lbb_company.get('headcount_text', '')
    return True


# Cache (from MongoDB) of known sticky action steps.
_STICKY_ACTION_STEPS = {}


def _sticky_action_steps(database):
    """Returns a dict of known sticky action steps keyed by ID."""
    return proto.cache_mongo_collection(
        database.sticky_action_steps.find, _STICKY_ACTION_STEPS, action_pb2.StickyActionStep)


# Cache (from MongoDB) of known action templates.
_ACTION_TEMPLATES = {}


def templates(database):
    """Returns a list of known action templates as protos."""
    return proto.cache_mongo_collection(
        database.action_templates.find, _ACTION_TEMPLATES, action_pb2.ActionTemplate)
