"""Endpoints for the evaluation tool."""
import flask
import pymongo

from google.protobuf import json_format

from bob_emploi.frontend import proto
from bob_emploi.frontend import privacy
from bob_emploi.frontend.api import use_case_pb2

app = flask.Blueprint('evaluation', __name__)  # pylint: disable=invalid-name


@app.route('/use-case-pool-names', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCasePoolNames)
def use_case_pools():
    """Retrieve a list of the available pools of anonymized user examples."""
    use_case_pool_dicts = flask.current_app.config['DATABASE'].use_case.aggregate([
        {'$group': {
            '_id': '$poolName',
        }},
        {'$project': {
            '_id': 0,
            'name': '$_id',
        }}
    ])
    use_case_pool_names = [pool['name'] for pool in use_case_pool_dicts if pool['name']]
    return use_case_pb2.UseCasePoolNames(
        use_case_pool_names=use_case_pool_names
    )


@app.route('/use-cases/<pool_name>', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCases)
def fetch_use_cases(pool_name):
    """Retrieve a list of anonymized user examples from one pool."""
    use_cases = use_case_pb2.UseCases()
    use_case_dicts = flask.current_app.config['DATABASE'].use_case.find({'poolName': pool_name})
    for use_case_dict in use_case_dicts:
        use_case_proto = use_cases.use_cases.add()
        use_case_proto.use_case_id = use_case_dict.pop('_id')
        proto.parse_from_mongo(use_case_dict, use_case_proto)

    use_cases.new_use_cases.extend(use_cases.use_cases[:])

    return use_cases


@app.route('/use-case/<use_case_id>', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseEvaluation)
def evaluate_use_case(use_case, use_case_id):
    """Evaluate a use case."""
    # TODO(pascal): Add authentication and access restriction.
    use_case.evaluated_at.GetCurrentTime()
    # No need to pollute our DB with super precise timestamps.
    use_case.evaluated_at.nanos = 0
    flask.current_app.config['DATABASE'].use_case.update_one(
        {'_id': use_case_id},
        {'$set': {'evaluation': json_format.MessageToDict(use_case)}})
    return ''


@app.route('/use-case/create', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseCreateRequest, out_type=use_case_pb2.UseCase)
def create_use_case(request):
    """Create a use case from a user."""
    # TODO(pascal): Add authentication and access restriction.
    database = flask.current_app.config['DATABASE']

    # Find user.
    user_dict = database.user.find_one({'profile.email': request.email})
    if not user_dict:
        flask.abort(404, 'Aucun utilisateur avec l\'email "%s" n\'a été trouvé.' % request.email)

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
