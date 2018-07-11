"""Endpoints for the mayday app."""

import collections
import datetime
import hashlib
import html
import logging
import os
import re
from urllib import parse

from bson import objectid
import flask
import requests
import unidecode

from google.protobuf import json_format

from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import mail
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import privacy
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import user_pb2

# A Slack WebHook URL to send final reports to. Defined in the Incoming
# WebHooks of https://bayesimpact.slack.com/apps/manage/custom-integrations
_SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL')

app = flask.Blueprint('mayday', __name__)  # pylint: disable=invalid-name

_MAILJET_CONFIRMATION_TEMPLATE = '370931'
_MAILJET_THANK_YOU_REVIEW_TEMPLATE = '376874'
_MAILJET_DOC_REVIEW_TEMPLATE = '386770'

_SERVER_TAG = {'_server': os.getenv('SERVER_VERSION', 'dev')}

_EXCLUDE_FROM_ANALYTICS_REGEXP = re.compile(
    os.getenv('EXCLUDE_FROM_ANALYTICS_REGEXP', r'@(bayes.org|bayesimpact.org|example.com)$'))

_WHITELIST_CONFIRMATION_EMAIL_REGEXP = re.compile(
    os.getenv('WHITELIST_CONFIRMATION_EMAIL_REGEXP', r'@bayes(impact)?\.org$'))


def _use_redirect_param_or(fallback):
    redirect = flask.request.args.get('redirect')
    if redirect:
        return flask.redirect(redirect)
    return fallback


class _CachedValue(object):

    def __init__(self, getter, cache_duration):
        self._getter = getter
        self._cache_duration = cache_duration
        self._cache = None
        self._cached_valid_until = None

    def get_value(self):
        """Get the cached value or fetch and cache an updated value."""

        instant = now.get()
        if not self._cache or self._cached_valid_until < instant:
            self._cached_valid_until = instant + self._cache_duration
            self._cache = self._getter()
        return self._cache

    def clear_cache(self):
        """Clear the cache."""

        self._cache = None


@app.route('/user', methods=['POST'])
@proto.flask_api(in_type=helper_pb2.Helper, out_type=helper_pb2.Helper)
def update_helper(user_data):
    """Save the helper (user) data sent by client.

    Input:
        * Body: A dictionary with attributes of the user data.
    Returns: The user data as it was saved.
    """

    if user_data.user_id:
        # Only updating certain fields.
        user_id = user_data.user_id
        user_data.user_id = ''
        user_dict = json_format.MessageToDict(user_data)
        user_dict.update(_SERVER_TAG)
        user_db = flask.current_app.config['USER_DATABASE']
        user_db.helper.update_one({'_id': _safe_object_id(user_id)}, {'$set': user_dict})

    existing_user_json = flask.current_app.config['USER_DATABASE'].helper.find_one(
        {'email': user_data.email})
    if existing_user_json:
        user_id = existing_user_json.pop('_id')
        existing_user = proto.create_from_mongo(existing_user_json, helper_pb2.Helper)
        instant = now.get()
        for new_promise in user_data.promises:
            promise = existing_user.promises.add(kind=new_promise.kind)
            promise.registered_at.FromDatetime(instant)
            # No need to pollute our DB with super precise timestamps.
            promise.registered_at.nanos = 0
            promise.promise_id = str(_get_unguessable_object_id())
            # TODO(pascal): Also send a slack notification for new promises.
        _save_helper(existing_user, user_id=user_id)
        return existing_user

    promise = next((p for p in user_data.promises), None)
    if promise and _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={
            'text': ':tada: A new helper for {}'.format(
                helper_pb2.HelperActionKind.Name(promise.kind)),
        })
    # TODO(pascal): Also set registered_at for the first promise.
    created_user, user_id = _save_helper(user_data)
    _send_confirmation_email(user_id, user_data)
    return created_user


def _save_helper(user_data, user_id=None):

    user_db = flask.current_app.config['USER_DATABASE']
    if not user_id:
        if _EXCLUDE_FROM_ANALYTICS_REGEXP.search(user_data.email):
            user_data.exclude_from_analytics = True
        user_data.registered_at.FromDatetime(now.get())
        # No need to pollute our DB with super precise timestamps.
        user_data.registered_at.nanos = 0
        for promise in user_data.promises:
            promise.registered_at.CopyFrom(user_data.registered_at)
            promise.promise_id = str(_get_unguessable_object_id())

    user_dict = json_format.MessageToDict(user_data)
    user_dict.update(_SERVER_TAG)
    if user_id:
        user_db.helper.replace_one({'_id': user_id}, user_dict)
    else:
        user_id = _get_unguessable_object_id()
        user_dict['_id'] = user_id
        user_db.helper.insert_one(user_dict)

    return user_data, user_id


# TODO(marielaure): Refactor this with server.
def _safe_object_id(_id):
    try:
        return objectid.ObjectId(_id)
    except objectid.InvalidId:
        # Switch to raising an error if you move this function in a lib.
        flask.abort(
            400, 'L\'identifiant "{}" n\'est pas un identifiant MongoDB valide.'.format(_id))


def _get_unguessable_object_id():
    """Hash the ObjectID with our salt to avoid that new UserIds can easily be guessed.

    See http://go/bob:security for details.
    """

    guessable_object_id = objectid.ObjectId()
    salter = hashlib.sha1()
    salter.update(str(guessable_object_id).encode('ascii'))
    salter.update(auth.SECRET_SALT)
    return objectid.ObjectId(salter.hexdigest()[:24])


def _send_confirmation_email(user_id, user_data):
    """Sends an email to mayday helper to make sure they want to keep their promise."""

    if not _WHITELIST_CONFIRMATION_EMAIL_REGEXP.search(user_data.email):
        return False

    action_kind = next(
        (helper_pb2.HelperActionKind.Name(promise.kind) for promise in user_data.promises), None)
    if not action_kind:
        logging.warning('Helper %s has no promise kind.', str(user_id))
        return False
    base_url = parse.urljoin(flask.request.base_url, '/')
    template_vars = {
        'confirmUrl': '{}api/mayday/confirm?userId={}&redirect={}'.format(
            base_url, str(user_id), parse.quote(
                '{}BobAction/{}#merci'.format(base_url, action_kind))),
        'unsubscribeUrl': '{}api/mayday/unsubscribe?userId={}'.format(base_url, str(user_id)),
    }
    result = mail.send_template(_MAILJET_CONFIRMATION_TEMPLATE, user_data, template_vars)
    if result.status_code >= 400:
        logging.warning('Failed to send an email with MailJet:\n %s', result.text)
        return False

    email_sent = mail.create_email_sent_proto(result)
    email_sent.mailjet_template = _MAILJET_CONFIRMATION_TEMPLATE
    email_sent.campaign_id = 'mayday-confirmation'
    flask.current_app.config['USER_DATABASE'].helper.update_one(
        {'_id': user_id}, {'$push': {'emailsSent': json_format.MessageToDict(email_sent)}})
    return True


def _get_helper_counts():
    aggregation = flask.current_app.config['USER_DATABASE'].helper.aggregate([
        {'$match': {'excludeFromAnalytics':  {'$ne': True}}},
        {'$unwind': '$promises'},
        {'$group': {'_id': '$promises.kind', 'total': {'$sum': 1}}},
    ])
    return {action['_id']: action['total'] for action in aggregation}


_HELPER_COUNT = _CachedValue(_get_helper_counts, datetime.timedelta(minutes=10))


def clear_helper_count_cache():
    """Clear cache on the helper count value."""

    _HELPER_COUNT.clear_cache()


@app.route('/count', methods=['GET'])
@proto.flask_api(out_type=helper_pb2.MaydayInfo)
def count_helpers():
    """Returns the number of helpers registered, with a little hack to get things started.

    Counts are given separately for each action, while the hack is only made on the total.
    """

    real_counts = _HELPER_COUNT.get_value()
    promise_count = collections.defaultdict(int)
    total_count = 0
    for action_id, count in real_counts.items():
        total_count += count
        promise_count[action_id] = count
    return helper_pb2.MaydayInfo(total_helper_count=total_count, action_helper_count=promise_count)


def _fix_total_count(real_total_count, old_counts):
    operation_start = datetime.datetime(2018, 4, 25)
    time_elapsed = max(
        datetime.timedelta(), min(
            datetime.timedelta(days=3),
            now.get() - operation_start))
    # One fake user every 10 minutes in the first three days.
    fake_total_count = int(200 + time_elapsed.total_seconds() / 600)
    if real_total_count < fake_total_count:
        return fake_total_count
    if not old_counts or sum(old_counts.values()) < fake_total_count:
        logging.warning(
            'Total count of helpers is above the expected value. No need for a fake value anymore.')
    return real_total_count


# TODO(pascal): Add auth tokens for the following endpoints.


@app.route('/confirm', methods=['GET'])
def confirm_email():
    """Confirm a helper's email."""

    args = flask.request.args
    user_id = args.get('userId')
    if not user_id:
        flask.abort(422, 'Utilisateur manquant.')

    user_db = flask.current_app.config['USER_DATABASE']
    user_db.helper.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': {'emailConfirmed': True}},
        upsert=False,
    )

    return _use_redirect_param_or('')


@app.route('/fulfill', methods=['GET'])
def fulfill_promise():
    """Fulfill a given promise for a given user."""

    args = flask.request.args
    user_id = args.get('userId')
    if not user_id:
        flask.abort(422, 'Utilisateur manquant.')
    promise_id = args.get('promiseId')
    if not promise_id:
        flask.abort(422, 'Promesse manquante.')
    user_db = flask.current_app.config['USER_DATABASE']
    user_db.helper.update_one(
        {
            '_id': _safe_object_id(user_id),
            'promises': {'$elemMatch': {
                'isFulfilled': {'$ne': True},
                'promiseId': promise_id,
            }},
        },
        {'$set': {
            'promises.$.isFulfilled': True,
            'promises.$.fulfilledAt': proto.datetime_to_json_string(now.get()),
        }})

    if _SLACK_WEBHOOK_URL:
        requests.post(_SLACK_WEBHOOK_URL, json={
            'text': ':tada: A #BobAction promise was fulfilled',
        })

    return _use_redirect_param_or('Vous avez tenu votre promesse !')


@app.route('/promise', methods=['GET'])
def add_promise():
    """Add a promise from a direct link to a given helper."""

    args = flask.request.args
    user_id = args.get('user')
    if not user_id:
        flask.abort(422, 'Utilisateur manquant')
    kind = args.get('kind')
    try:
        promise = helper_pb2.Promise(kind=helper_pb2.HelperActionKind.Value(kind))
    except ValueError:
        flask.abort(422, "Type d'action invalide")
    promise.registered_at.GetCurrentTime()
    promise.registered_at.nanos = 0
    promise.promise_id = str(_get_unguessable_object_id())
    flask.current_app.config['USER_DATABASE'].helper.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$push': {'promises': json_format.MessageToDict(promise)}},
    )

    return _use_redirect_param_or(promise)


@app.route('/unsubscribe', methods=['GET'])
def unsubscribe():
    """Unsubscribe a helper."""

    args = flask.request.args
    user_id = args.get('userId')
    if not user_id:
        flask.abort(422, 'Utilisateur manquant.')
    filter_user = {'_id': _safe_object_id(user_id)}

    user_db = flask.current_app.config['USER_DATABASE']
    existing_user_json = user_db.helper.find_one(filter_user)
    existing_user = proto.create_from_mongo(existing_user_json, helper_pb2.Helper)
    try:
        privacy.redact_proto(existing_user)
    except TypeError:
        logging.exception('Cannot delete account %s', user_id)
        flask.abort(500, 'Erreur serveur, impossible de supprimer le compte.')
    existing_user.deleted_at.FromDatetime(now.get())

    user_db.helper.replace_one(filter_user, json_format.MessageToDict(existing_user))

    return 'Votre compte a été supprimé.'


def _get_reviewed_document(helper, request, user_database):
    """Find the document reviewed."""

    clean_name = unidecode.unidecode(request.document_owner_name.lower())
    for promise_index, promise in enumerate(helper.promises):
        if clean_name not in promise.documents_by_owner_name:
            continue
        document_id = _safe_object_id(promise.documents_by_owner_name[clean_name])
        document_json = user_database.cvs_and_cover_letters.find_one({'_id': document_id})
        # TODO(cyrille): If document_json is not found, log an error and abort.
        return document_id, document_json, promise_index
    # TODO(pascal): Do not abort, still send the email.
    flask.abort(404, 'Nobody with the name {} was among the users to help'.format(clean_name))


_REVIEW_OPEN_STATUS = {review_pb2.REVIEW_SENT, review_pb2.REVIEW_TIME_OUT}


@app.route('/review/done', methods=['POST'])
@proto.flask_api(in_type=review_pb2.ReviewDoneRequest, out_type=review_pb2.ReviewDoneResponse)
@auth.require_google_user('@bayesimpact.org', email_kwarg='email')
def confirm_review_done(request, email):
    """Confirm that a review was done."""

    # Find the helper.
    user_db = flask.current_app.config['USER_DATABASE']
    if request.document_id and email == request.reviewer_email:
        document = proto.create_from_mongo(user_db.cvs_and_cover_letters.find_one({
            '_id': _safe_object_id(request.document_id)
        }), review_pb2.DocumentToReview, always_create=False)
        if not document:
            flask.abort(404, 'Document with ID "{}" not found'.format(request.document_id))
        user_db.cvs_and_cover_letters.update_one(
            {'_id': _safe_object_id(request.document_id)},
            {'$inc': {'numDoneReviews': 1}},
        )
        if _SLACK_WEBHOOK_URL:
            requests.post(_SLACK_WEBHOOK_URL, json={
                'text': ':tada: A {} was reviewed by team member {}'.format(
                    review_pb2.DocumentKind.Name(document.kind), email.split('@')[0])
            })
        return review_pb2.ReviewDoneResponse(
            owner_email=document.owner_email,
            kind=document.kind,
            was_review_sent=_send_review(document, request),
        )
    existing_helper_json = user_db.helper.find_one({'email': request.reviewer_email})
    if not existing_helper_json:
        # TODO(pascal): Do not abort, still send the email.
        flask.abort(404, 'No helper with email {} found'.format(request.reviewer_email))
    helper_id = existing_helper_json.pop('_id')
    helper = proto.create_from_mongo(existing_helper_json, helper_pb2.Helper)
    document_id, document_json, promise_index = _get_reviewed_document(helper, request, user_db)
    document = proto.create_from_mongo(document_json, review_pb2.DocumentToReview)

    # Update the review.
    review_index = next(
        review_index for review_index, review in enumerate(document.reviews)
        if review.reviewer_id == str(helper_id)
    )
    if document.reviews[review_index].status in _REVIEW_OPEN_STATUS:
        review_count_incs = {'numDoneReviews': 1}
        if document.reviews[review_index].status == review_pb2.REVIEW_SENT:
            review_count_incs['numPendingReviews'] = -1
        user_db.cvs_and_cover_letters.update_one(
            {'_id': document_id},
            {
                '$inc': review_count_incs,
                '$set': {'reviews.{}.status'.format(review_index): 'REVIEW_DONE'},
            },
        )
    else:
        flask.abort(400, 'Review marked as "{}", maybe it was sent already'.format(
            review_pb2.ReviewStatus.Name(document.reviews[review_index].status)))
    # TODO(pascal): Maybe mark the other reviews as declined.

    # Send the thank you email.
    base_url = parse.urljoin(flask.request.base_url, '/')
    result = mail.send_template(
        _MAILJET_THANK_YOU_REVIEW_TEMPLATE, helper,
        {
            'name': document.name,
            'upperName': document.name.upper(),
            'customerSupportText': request.customer_support_text,
            'unsubscribeUrl': '{}api/mayday/unsubscribe?userId={}'.format(base_url, str(helper_id)),
        })
    if result.status_code >= 400:
        logging.warning('Failed to send an email with MailJet:\n %s', result.text)
        flask.abort('Could not send thank the you email')
    email_sent = mail.create_email_sent_proto(result)
    email_sent.mailjet_template = _MAILJET_THANK_YOU_REVIEW_TEMPLATE
    email_sent.campaign_id = 'mayday-thank-you'
    updates = {
        '$push': {'emailsSent': json_format.MessageToDict(email_sent)},
    }
    if not helper.promises[promise_index].is_fulfilled:
        updates['$set'] = {
            'promises.{}.isFulfilled'.format(promise_index): True,
            'promises.{}.fulfilledAt'.format(promise_index):
            proto.datetime_to_json_string(now.get()),
        }
        if _SLACK_WEBHOOK_URL:
            requests.post(_SLACK_WEBHOOK_URL, json={
                'text': ':tada: A #BobAction promise was fulfilled for {}'.format(
                    helper_pb2.HelperActionKind.Name(helper.promises[promise_index].kind)),
            })

    user_db.helper.update_one({'_id': helper_id}, updates)

    return review_pb2.ReviewDoneResponse(
        owner_email=document.owner_email,
        kind=document.kind,
        was_review_sent=_send_review(document, request),
    )


def _send_review(document, request):
    if not document.owner_email or not request.review_content:
        return False
    html_review = html.escape(request.review_content).replace('\n', '<br/>\n')
    result = mail.send_template(
        _MAILJET_DOC_REVIEW_TEMPLATE,
        helper_pb2.Helper(email=document.owner_email, name=document.name),
        {
            'name': document.name,
            'review': html_review,
        })
    if result.status_code >= 400:
        logging.warning('Failed to send an email with MailJet:\n %s', result.text)
        return False
    return True


_CoffeeAccepted = collections.namedtuple('CoffeeAccepted', ['optional_bool', 'text'])
_MAYDAY_COFFEE_ACCEPTED_FROM_ANSWER = {
    'accept': _CoffeeAccepted(
        optional_bool=user_pb2.TRUE,
        text='Nous vous recontacterons par email avec le contact de la personne volontaire.',
    ),
    'decline': _CoffeeAccepted(
        optional_bool=user_pb2.FALSE,
        text='Bonne journée.',
    ),
}


@app.route('/coffee/<answer_keyword>', methods=['GET'])
@auth.require_user_in_args('coffee')
def answer_coffee(answer_keyword, user_id):
    """Mark the answer of a user to a coffee request."""

    try:
        answer = _MAYDAY_COFFEE_ACCEPTED_FROM_ANSWER[answer_keyword]
    except KeyError:
        flask.abort(422, 'Réponse inconnue: "{}"'.format(answer_keyword))

    user_db = flask.current_app.config['USER_DATABASE']
    user_db.user.update_one(
        {'_id': _safe_object_id(user_id)},
        {'$set': {'mayday.hasAcceptedCoffee': user_pb2.OptionalBool.Name(answer.optional_bool)}}
    )
    return 'Merci pour votre réponse. {}'.format(answer.text)


@app.route('/interested', methods=['GET'])
def say_is_interested():
    """Mark helper as interested in future campaigns from us."""

    args = flask.request.args
    user_id = _safe_object_id(args.get('user'))
    user_db = flask.current_app.config['USER_DATABASE']
    helper = user_db.helper.find_one({'_id': user_id}, {'email': 1})
    if not helper or helper.get('email', 'REDACTED') == 'REDACTED':
        flask.abort(404, "L'utilisateur n'existe pas ou a déjà été supprimé.")
    user_db.volunteer.insert_one({'email': helper.get('email')})

    return _use_redirect_param_or('Votre demande a bien été enregistrée.')
