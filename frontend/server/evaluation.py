"""Endpoints for the evaluation tool."""

import os

import flask
from google.protobuf import json_format
import pymongo

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.api import use_case_pb2

app = flask.Blueprint('evaluation', __name__)  # pylint: disable=invalid-name

_EMAILS_PATTERN = os.getenv('EMAILS_FOR_EVALUATIONS', '@bayesimpact.org')


@app.route('/authorized', methods=['GET'])
@auth.require_google_user(_EMAILS_PATTERN)
def get_is_authorized():
    """Returns a 204 empty message if the user is an evaluator."""

    return '', 204


@app.route('/use-case-pools', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCasePools)
@auth.require_google_user(_EMAILS_PATTERN)
def fetch_use_case_pools():
    """Retrieve a list of the available pools of anonymized user examples."""

    use_case_pools = use_case_pb2.UseCasePools()
    use_case_pool_dicts = flask.current_app.config['DATABASE'].use_case.aggregate([
        {'$group': {
            '_id': '$poolName',
            'useCaseCount': {'$sum': 1},
            'evaluatedUseCaseCount': {'$sum': {'$cond': [{'$gt': ['$evaluation', None]}, 1, 0]}},
            'lastUserRegisteredAt': {'$max': '$userData.registeredAt'},
        }},
        {'$sort': {'lastUserRegisteredAt': -1}},
    ])
    for use_case_pool_dict in use_case_pool_dicts:
        use_case_pool_proto = use_case_pools.use_case_pools.add()
        use_case_pool_proto.name = use_case_pool_dict.pop('_id')
        proto.parse_from_mongo(use_case_pool_dict, use_case_pool_proto)

    return use_case_pools


@app.route('/use-cases/<pool_name>', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCases)
@auth.require_google_user(_EMAILS_PATTERN)
def fetch_use_cases(pool_name):
    """Retrieve a list of anonymized user examples from one pool."""

    use_cases = use_case_pb2.UseCases()
    use_case_dicts = flask.current_app.config['DATABASE'].use_case\
        .find({'poolName': pool_name}).sort('indexInPool', 1)
    for use_case_dict in use_case_dicts:
        use_case_proto = use_cases.use_cases.add()
        use_case_proto.use_case_id = use_case_dict.pop('_id')
        proto.parse_from_mongo(use_case_dict, use_case_proto)
        for project in use_case_proto.user_data.projects:
            if project.HasField('mobility') and not project.HasField('city'):
                project.city.CopyFrom(project.mobility.city)
                project.area_type = project.mobility.area_type

    return use_cases


@app.route('/use-case/<use_case_id>', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseEvaluation)
@auth.require_google_user(_EMAILS_PATTERN, email_kwarg='evaluator_email')
def evaluate_use_case(use_case, use_case_id, evaluator_email=''):
    """Evaluate a use case."""

    use_case.evaluated_at.GetCurrentTime()
    use_case.by = evaluator_email
    # No need to pollute our DB with super precise timestamps.
    use_case.evaluated_at.nanos = 0
    flask.current_app.config['DATABASE'].use_case.update_one(
        {'_id': use_case_id},
        {'$set': {'evaluation': json_format.MessageToDict(use_case)}})
    return ''


@app.route('/use-case/create', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseCreateRequest, out_type=use_case_pb2.UseCase)
@auth.require_google_user(_EMAILS_PATTERN)
def create_use_case(request):
    """Create a use case from a user."""

    database = flask.current_app.config['DATABASE']
    user_database = flask.current_app.config['USER_DATABASE']

    # Find user.
    user_dict = user_database.user.find_one({'profile.email': request.email})
    if not user_dict:
        flask.abort(
            404, 'Aucun utilisateur avec l\'email "{}" n\'a été trouvé.'.format(request.email))

    # Find next free index in use case pool.
    last_use_case_in_pool = database.use_case.find(
        {'poolName': request.pool_name},
        {'_id': 0, 'indexInPool': 1},
    ).sort('indexInPool', pymongo.DESCENDING).limit(1)
    next_index = next((u.get('indexInPool', 0) for u in last_use_case_in_pool), -1) + 1

    # Convert user to use case.
    use_case_proto = privacy.user_to_use_case(user_dict, request.pool_name, next_index)
    if not use_case_proto:
        flask.abort(500, 'Impossible to read user data.')

    # Save use case.
    use_case = json_format.MessageToDict(use_case_proto)
    use_case['_id'] = use_case.pop('useCaseId')
    database.use_case.insert_one(use_case)

    return use_case_proto
