"""Module to handle actions logic."""

import random
import re
import time

from pymongo import database

from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

# Matches a title that is about "any company that...", e.g. "Postuler à une
# entreprise".
_ANY_COMPANY_REGEXP = re.compile('^(.*) une entreprise')


def instantiate(
        action: action_pb2.Action,
        user_proto: user_pb2.User,
        project: project_pb2.Project,
        template: action_pb2.ActionTemplate,
        base: database.Database) -> action_pb2.Action:
    """Instantiate a newly created action from a template.

    Args:
        action: the action to be populated from the template.
        user_proto: the whole user data.
        project: the whole project data.
        template: the action template to instantiate.
        base: a MongoDB client to get stats and info.
    Returns:
        the populated action for chaining.
    """

    action.action_id = '{}-{}-{:x}-{:x}'.format(
        project.project_id,
        template.action_template_id,
        round(time.time()),
        random.randrange(0x10000))
    action.action_template_id = template.action_template_id
    action.title = template.title
    action.title_feminine = template.title_feminine
    action.short_description = template.short_description
    action.short_description_feminine = template.short_description_feminine
    scoring_project = scoring.ScoringProject(
        project, user_proto.profile, user_proto.features_enabled, base)
    action.link = scoring_project.populate_template(template.link)
    action.how_to = template.how_to
    action.status = action_pb2.ACTION_UNREAD
    action.created_at.FromDatetime(now.get())
    action.image_url = template.image_url

    return action
