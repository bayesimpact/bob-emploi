"""Script to fix projects of users with very old field values.

See TODOs in the server module for "Update existing users and get rid of…".
"""
import os
import datetime

from google.protobuf import json_format
import pymongo

from bob_emploi.frontend import proto
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()
_DRY_RUN = not os.getenv('NO_DRY_RUN', '')


TRAINING_ESTIMATION = {
    project_pb2.FULFILLED: project_pb2.ENOUGH_DIPLOMAS,
    project_pb2.NOT_FULFILLED: project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
    project_pb2.FULFILLMENT_NOT_SURE: project_pb2.TRAINING_FULFILLMENT_NOT_SURE,
    project_pb2.NOTHING_REQUIRED: project_pb2.NO_TRAINING_REQUIRED,
}


def fix_project(project, user_profile):
    """Fix a project with old fields.

    Args:
        project: a Project proto for the project that will be modified if needed.
        user_profile: a UserProfile proto, this will not be modified.
    Returns:
        whether the project was modified.
    """
    updated = False
    if not project.training_fulfillment_estimate and project.diploma_fulfillment_estimate:
        project.training_fulfillment_estimate = TRAINING_ESTIMATION.get(
            project.diploma_fulfillment_estimate, project_pb2.UNKNOWN_TRAINING_FULFILLMENT)
        updated = True

    if project.kind == project_pb2.FIND_JOB:
        if user_profile.situation == user_pb2.LOST_QUIT:
            project.kind = project_pb2.FIND_A_NEW_JOB
        elif user_profile.situation == user_pb2.FIRST_TIME:
            project.kind = project_pb2.FIND_A_FIRST_JOB
        else:
            project.kind = project_pb2.FIND_ANOTHER_JOB
        updated = True

    if not (project.job_search_started_at.seconds or project.job_search_has_not_started) \
            and project.job_search_length_months:
        if project.job_search_length_months < 0:
            project.job_search_has_not_started = True
        else:
            job_search_length_days = 30.5 * project.job_search_length_months
            job_search_length_duration = datetime.timedelta(days=job_search_length_days)
            project.job_search_started_at.FromDatetime(
                project.created_at.ToDatetime() - job_search_length_duration)
            project.job_search_started_at.nanos = 0
        updated = True

    project.ClearField('diploma_fulfillment_estimate')
    if project.actions_generated_at.seconds:
        project.ClearField('actions_generated_at')
        updated = True

    return updated


def main(user_db, dry_run=True):
    """Fix projects with very old field values."""
    if dry_run:
        print('Running in dry mode, no changes will be pushed to MongoDB.')
    # TODO(pascal): Also run this fix on other projects with old fields:
    #  - the ones with kind == FIND_JOB
    #  - the ones with no jobSearchStartedAt nor jobSearchHasNotStarted
    #  - the ones with actionsGeneratedAt
    users_to_fix = user_db.find({
        'projects.diplomaFulfillmentEstimate': {'$exists': True},
        'projects.trainingFulfillmentEstimate': {'$exists': False},
    })
    user_count = 0
    for user_dict in users_to_fix:
        user_id = user_dict.pop('_id')
        user = user_pb2.User()
        proto.parse_from_mongo(user_dict, user)

        updated = False
        for project in user.projects:
            if not fix_project(project, user.profile):
                continue

            updated = True
            if dry_run:
                print('Would change project for', user_id, project.project_id)
            else:
                user_db.update_one(
                    {'_id': user_id, 'projects.projectId': project.project_id},
                    {'$set': {'projects.$': json_format.MessageToDict(project)}},
                )

        if updated:
            user_count += 1
    print('{} users updated'.format(user_count))


if __name__ == '__main__':
    main(_DB.user, _DRY_RUN)
