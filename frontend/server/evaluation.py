"""Endpoints for the evaluation tool."""

import os
import random
import re
import typing

from bson import objectid
import flask
from google.protobuf import json_format
import pymongo
from pymongo import errors

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import diagnostic
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import use_case_pb2

app = flask.Blueprint('evaluation', __name__)  # pylint: disable=invalid-name

_EMAILS_PATTERN = os.getenv('EMAILS_FOR_EVALUATIONS', '@bayesimpact.org')


@app.route('/authorized', methods=['GET'])
@auth.require_google_user(_EMAILS_PATTERN)
def get_is_authorized() -> typing.Tuple[str, int]:
    """Returns a 204 empty message if the user is an evaluator."""

    return '', 204


@app.route('/use-case-pools', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCasePools)
@auth.require_google_user(_EMAILS_PATTERN)
def fetch_use_case_pools() -> use_case_pb2.UseCasePools:
    """Retrieve a list of the available pools of anonymized user examples."""

    use_case_pools = use_case_pb2.UseCasePools()
    use_case_pool_dicts = flask.current_app.config['EVAL_DATABASE'].use_case.aggregate([
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
        proto.parse_from_mongo(use_case_pool_dict, use_case_pool_proto, 'name')

    return use_case_pools


@app.route('/use-cases/<pool_name>', methods=['GET'])
@proto.flask_api(out_type=use_case_pb2.UseCases)
@auth.require_google_user(_EMAILS_PATTERN)
def fetch_use_cases(pool_name: str) -> use_case_pb2.UseCases:
    """Retrieve a list of anonymized user examples from one pool."""

    use_cases = use_case_pb2.UseCases()
    use_case_dicts = flask.current_app.config['EVAL_DATABASE'].use_case\
        .find({'poolName': pool_name}).sort('indexInPool', 1)
    for use_case_dict in use_case_dicts:
        use_case_proto = use_cases.use_cases.add()
        proto.parse_from_mongo(use_case_dict, use_case_proto, 'use_case_id')
    return use_cases


@app.route('/use-case/<use_case_id>', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseEvaluation)
@auth.require_google_user(_EMAILS_PATTERN, email_kwarg='evaluator_email')
def evaluate_use_case(
        use_case: use_case_pb2.UseCaseEvaluation, use_case_id: str, evaluator_email: str = '') \
        -> str:
    """Evaluate a use case."""

    use_case.evaluated_at.GetCurrentTime()
    use_case.by = evaluator_email
    # No need to pollute our DB with super precise timestamps.
    use_case.evaluated_at.nanos = 0
    flask.current_app.config['EVAL_DATABASE'].use_case.update_one(
        {'_id': use_case_id},
        {'$set': {'evaluation': json_format.MessageToDict(use_case)}})
    return ''


def _log_request(email: str, requester_email: str, database: pymongo.database.Database) -> None:
    try:
        # Log that we've tried to access to a specific user.
        database.email_requests.insert_one({
            'email': email,
            'registeredAt': proto.datetime_to_json_string(now.get()),
            'requesterEmail': requester_email,
        })
    except errors.OperationFailure:
        flask.abort(401, "Vous n'avez pas accès en écriture à la base de données.")


@app.route('/use-case/create', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseCreateRequest, out_type=use_case_pb2.UseCase)
@auth.require_google_user(_EMAILS_PATTERN, email_kwarg='requester_email')
def create_use_case(request: use_case_pb2.UseCaseCreateRequest, requester_email: str) \
        -> use_case_pb2.UseCase:
    """Create a use case from a user."""

    database = flask.current_app.config['EVAL_DATABASE']
    user_database = flask.current_app.config['USER_DATABASE']

    if request.email:
        _log_request(request.email, requester_email, database)
        query = {'hashedEmail': auth.hash_user_email(request.email)}
    else:
        query = {'_id': objectid.ObjectId(request.user_id)}

    # Find user.
    user_dict = user_database.user.find_one(query)
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

    if not request.pool_name:
        return use_case_proto
    # Save use case.
    use_case = json_format.MessageToDict(use_case_proto)
    use_case['_id'] = use_case.pop('useCaseId')
    database.use_case.insert_one(use_case)

    return use_case_proto


_MAX_SEARCHED_USE_CASES = 100

_MAX_MATCHING_USE_CASES = 20


# Regex for use cases automatically generated in the daily task using
# frontend/server/asynchronous/create_pool.py.
_AUTOMATIC_EVAL_USE_CASE_ID_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}')


def _match_filters_for_use_case(
        filters: typing.Iterable[str], use_case: use_case_pb2.UseCase) -> bool:
    user = use_case.user_data
    if not user.projects:
        return False
    scoring_project = scoring.ScoringProject(
        user.projects[0], user.profile, user.features_enabled, flask.current_app.config['DATABASE'])
    return scoring_project.check_filters(filters, force_exists=True)


@app.route('/use-case/filters', methods=['POST'])
@proto.flask_api(in_type=use_case_pb2.UseCaseFiltersRequest, out_type=use_case_pb2.UseCases)
@auth.require_google_user(_EMAILS_PATTERN)
def list_use_cases_from_filters(request: use_case_pb2.UseCaseFiltersRequest) \
        -> use_case_pb2.UseCases:
    """Fetch a list of recent use cases satisfying a given list of filters."""

    request.max_count = request.max_count or _MAX_MATCHING_USE_CASES
    request.max_search_count = request.max_search_count or _MAX_SEARCHED_USE_CASES

    use_cases = use_case_pb2.UseCases()
    use_case_iterator = flask.current_app.config['EVAL_DATABASE'].use_case.find(
        {'_id': _AUTOMATIC_EVAL_USE_CASE_ID_REGEX}
    ).sort([('_id', -1)]).limit(request.max_search_count)
    for use_case_json in use_case_iterator:
        use_case = use_cases.use_cases.add()
        proto.parse_from_mongo(use_case_json, use_case, 'use_case_id')
        try:
            if not _match_filters_for_use_case(request.filters, use_case):
                del use_cases.use_cases[-1]
        except KeyError as err:
            flask.abort(404, str(err))
        if len(use_cases.use_cases) >= request.max_count:
            break
    return use_cases


_MAX_DISTRIBUTION_EXAMPLES = 4


def _make_diagnostic_category_distribution(
        use_cases: typing.Iterator[use_case_pb2.UseCase],
        database: pymongo.database.Database,
        categories: typing.Iterable[diagnostic_pb2.DiagnosticCategory]) \
        -> use_case_pb2.UseCaseDistribution:
    """Give the distribution and examples for each diagnostic category on a pool of use cases."""

    distribution = use_case_pb2.UseCaseDistribution()
    if not categories:
        distribution.categories.extend(diagnostic.list_categories(database))
    for use_case in use_cases:
        distribution.total_count += 1
        category = diagnostic.find_category(
            use_case.user_data, categories=categories, database=database)
        if category:
            this_category = distribution.distribution[category.category_id]
        else:
            this_category = distribution.missing_use_cases
        this_category.count += 1
        examples = this_category.examples
        # Implementation of reservoir sampling https://en.wikipedia.org/wiki/Reservoir_sampling
        if len(examples) < _MAX_DISTRIBUTION_EXAMPLES:
            examples.extend([use_case])
            continue
        next_place = random.randrange(this_category.count)
        if next_place < _MAX_DISTRIBUTION_EXAMPLES:
            examples[next_place].CopyFrom(use_case)
    return distribution


@app.route('/category/distribution', methods=['POST'])
@proto.flask_api(
    in_type=use_case_pb2.UseCasesDistributionRequest, out_type=use_case_pb2.UseCaseDistribution)
@auth.require_google_user(_EMAILS_PATTERN)
def make_diagnostic_category_distribution(request: use_case_pb2.UseCasesDistributionRequest) \
        -> use_case_pb2.UseCaseDistribution:
    """See how use cases are distributed in the different diagnostic categories."""

    use_case_iterator = (
        typing.cast(
            use_case_pb2.UseCase,
            proto.create_from_mongo(use_case_json, use_case_pb2.UseCase, 'use_case_id'))
        for use_case_json in flask.current_app.config['EVAL_DATABASE'].use_case.find(
            {'_id': _AUTOMATIC_EVAL_USE_CASE_ID_REGEX}
        ).sort([('_id', -1)]).limit(request.max_use_cases or _MAX_SEARCHED_USE_CASES))
    return _make_diagnostic_category_distribution(
        use_case_iterator, flask.current_app.config['DATABASE'], request.categories)


@app.route('/use-case/categories', methods=['POST'])
@proto.flask_api(
    in_type=use_case_pb2.UseCase, out_type=diagnostic_pb2.DiagnosticCategories)
@auth.require_google_user(_EMAILS_PATTERN)
def get_relevant_categories(use_case: use_case_pb2.UseCase) -> diagnostic_pb2.DiagnosticCategories:
    """Analyse a use case for each category, and return whether the category is relevant for it."""

    result = diagnostic_pb2.DiagnosticCategories()
    result.categories.extend(diagnostic.set_categories_relevance(
        use_case.user_data, database=flask.current_app.config['DATABASE']))
    return result
