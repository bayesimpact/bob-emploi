"""Email blasts for the MayDay operation."""

import collections
import logging
from urllib import parse

from bson import objectid
from google.protobuf import json_format
import unidecode

from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import auth
from bob_emploi.frontend.server import french
from bob_emploi.frontend.server import now
from bob_emploi.frontend.server import proto
from bob_emploi.frontend.server.asynchronous.mail import campaign
from bob_emploi.frontend.server.asynchronous.mail import match_coffee


_TRAIN_ALGO_TYPEFORM_BASE_URL = 'https://bayes.typeform.com/to/rXBGDh'


def _bob_actions_help_vars(user, **unused_kwargs):
    """A campaign to get volunteers from our users to be helped by #BobAction."""

    return dict(campaign.get_default_vars(user), **{
        'emailInUrl': parse.quote(user.profile.email),
        'userId': user.user_id,
    })


def _get_unsubscribe_url(helper):
    return '{}/api/mayday/unsubscribe?userId={}'.format(campaign.BASE_URL, helper.user_id)


def _confirm_helper_vars(helper, **unused_kwargs):
    action_kind = next(
        (helper_pb2.HelperActionKind.Name(promise.kind) for promise in helper.promises), None)
    if not action_kind:
        logging.warning('Helper %s has no promise kind.', str(helper.user_id))
        return None

    if helper.email_confirmed:
        confirm_url = ''
    else:
        confirm_url = '{}/api/mayday/confirm?userId={}&redirect={}'.format(
            campaign.BASE_URL, helper.user_id, parse.quote(
                '{}/BobAction/{}#merci'.format(campaign.BASE_URL, action_kind)))

    return {
        'confirmUrl': confirm_url,
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }


def _match_cv_helper_vars(helper, users_database=None, **unused_kwargs):
    return _match_docs_helper_vars(
        helper, users_database, helper_pb2.HELP_RESUME, review_pb2.DOCUMENT_RESUME)


def _match_cover_helper_vars(helper, users_database=None, **unused_kwargs):
    return _match_docs_helper_vars(
        helper, users_database, helper_pb2.HELP_COVER_LETTER, review_pb2.DOCUMENT_COVER_LETTER)


_DOCUMENTS_TO_REVIEW = proto.MongoCachedCollection(
    review_pb2.DocumentToReview, 'cvs_and_cover_letters', query={
        'numPendingReviews': {'$not': {'$gte': 2}},
        'numDoneReviews': {'$not': {'$gte': 2}},
    }
)


def _match_docs_helper_vars(helper, users_database, help_kind, doc_kind):
    promise_index, promise = next(
        ((i, p) for (i, p) in enumerate(helper.promises)
         if p.kind == help_kind and not p.is_fulfilled),
        (None, None))
    if not promise:
        logging.warning('Mongo match did not filter properly, no promise matching found.')
        return None

    docs_to_review = {}
    if promise.documents_by_owner_name:
        # The promise already holds documents to be reviewed, however the
        # promise is not fulfilled so let's send them again.
        reviewed_docs = users_database.cvs_and_cover_letters.find({
            '_id': {'$in': [
                objectid.ObjectId(d) for d in promise.documents_by_owner_name.values()
            ]},
        })
        for reviewed_doc in reviewed_docs:
            name = unidecode.unidecode(reviewed_doc.get('name').lower())
            doc_to_review = proto.create_from_mongo(reviewed_doc, review_pb2.DocumentToReview)
            doc_to_review.user_id = promise.documents_by_owner_name[name]
            docs_to_review[name] = doc_to_review
            if len(docs_to_review) >= 3:
                break
    if len(docs_to_review) < 3:
        known_names = {
            owner_name
            for promise in helper.promises
            for owner_name in promise.documents_by_owner_name
        }
        for doc_id, reviewable_doc in _DOCUMENTS_TO_REVIEW.get_collection(users_database).items():
            if reviewable_doc.kind != doc_kind or reviewable_doc.num_pending_reviews >= 2:
                continue
            name = unidecode.unidecode(reviewable_doc.name.lower())
            # Prevent sending different documents that have the same first name.
            if not name or name in known_names:
                continue
            reviewable_doc.user_id = doc_id
            # Update document in cache to have more realistic result on 'list' action.
            reviewable_doc.num_pending_reviews += 1
            docs_to_review[name] = reviewable_doc
            known_names.add(name)
            if len(docs_to_review) >= 3:
                break
        if len(docs_to_review) < 3:
            logging.warning('Not enough CVs to review')
            return None

    all_vars = {
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }
    for i, review in enumerate(docs_to_review.values()):
        all_vars['firstname{}'.format(i + 1)] = review.name
        all_vars['upperFirstname{}'.format(i + 1)] = review.name.upper()
        all_vars['docUrl{}'.format(i + 1)] = review.anonymized_url
    # This is only for the _confirm_cv_reviewed method, it's not accessed in the template.
    all_vars['documents'] = {
        first_name: doc.user_id for first_name, doc in docs_to_review.items()}
    all_vars['promiseIndex'] = promise_index
    all_vars['isSendingAgain'] = bool(promise.documents_by_owner_name)
    return all_vars


def _confirm_doc_reviewed(helper, template_vars=None, user_database=None, **unused_kwargs):
    if template_vars.get('isSendingAgain'):
        return

    promise_index = template_vars['promiseIndex']
    # Update the helper's promise with the document reviewed.
    user_database.helper.update_one(
        {'_id': objectid.ObjectId(helper.user_id)},
        {'$set':  {
            'promises.{:d}.documentsByOwnerName.{}'.format(promise_index, first_name): document_id
            for first_name, document_id in template_vars.get('documents').items()
        }},
    )

    # Update the document to review with the pending reviews.
    review = review_pb2.DocumentReview(reviewer_id=helper.user_id, status=review_pb2.REVIEW_SENT)
    review.sent_at.FromDatetime(now.get())
    review.sent_at.nanos = 0
    review_dict = json_format.MessageToDict(review)

    user_database.cvs_and_cover_letters.update_many(
        {'_id': {'$in': [objectid.ObjectId(d) for d in template_vars['documents'].values()]}},
        {
            '$push': {'reviews': review_dict},
            '$inc': {'numPendingReviews': 1},
        },
    )


def get_first_unfulfilled_promise(helper, kind=None):
    """The first unfulfilled promise of a helper.

    If a kind is given, restricts to promises of the given kind.
    Returns a promise_id or None"""

    return next((
        promise.promise_id for promise in helper.promises
        if not promise.is_fulfilled and (not kind or promise.kind == kind)), None)


def _ask_for_coffee(helper, **unused_kwargs):
    promise_id = get_first_unfulfilled_promise(helper, helper_pb2.HELP_COFFEE)
    if not promise_id:
        return None
    return {
        'coffeePageUrl': '{}/BobAction/formulaire-cafe?helperId={}'.format(
            campaign.BASE_URL, helper.user_id),
        'fulfillPromiseUrl': '{}/api/mayday/fulfill?userId={}&promiseId={}'.format(
            campaign.BASE_URL, helper.user_id, promise_id),
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }


def _algo_questions_vars(helper, **unused_kwargs):
    promise_id = get_first_unfulfilled_promise(helper, helper_pb2.HELP_TRAIN_ALGO)
    if not promise_id:
        return None
    return {
        'algoPageUrl': '{}/api/mayday/fulfill?userId={}&promiseId={}&redirect={}'.format(
            campaign.BASE_URL, helper.user_id, promise_id, parse.quote(
                '{}?userid={}'.format(_TRAIN_ALGO_TYPEFORM_BASE_URL, helper.user_id))),
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }


def _collect_coverage(helpers):
    coffee_helpers = helpers.find({
        'emailConfirmed': True,
        'promises': {'$elemMatch': {
            'kind': 'HELP_COFFEE',
            'isFulfilled': {'$ne': True},
        }},
        'domains': {'$exists': True},
    }, {'domains': 1, 'isAvailableRemotely': 1, 'cities': 1})
    coverage = collections.defaultdict(lambda: collections.defaultdict(list))
    for helper_dict in coffee_helpers:
        helper_id = str(helper_dict.pop('_id'))
        helper = proto.create_from_mongo(helper_dict, helper_pb2.Helper)
        helper.user_id = helper_id
        departement_ids = {city.departement_id for city in helper.cities}
        for domains in helper.domains:
            for domain in domains.split(','):
                for departement_id in departement_ids:
                    coverage[domain.strip()][departement_id].append(helper)
                if helper.is_available_remotely:
                    coverage[domain.strip()][None].append(helper)
    return coverage


class _CoffeeCoverage(object):

    def __init__(self):
        self._cache = None
        self._collection = None

    def _get_domain_helpers(self, rome_id):
        for prefix_len in (3, 2, 1):
            domain_helpers = self._cache.get(rome_id[0:prefix_len])
            if domain_helpers:
                return domain_helpers
        return None

    def get_helpers(self, collection, user):
        """Get helpers ready to have a coffee with a given user."""

        if collection != self._collection:
            self._cache = _collect_coverage(collection)
            self._collection = collection

        try:
            project = next(p for p in user.projects if not p.is_incomplete)
        except StopIteration:
            return None

        domain_helpers = self._get_domain_helpers(project.target_job.job_group.rome_id)
        if not domain_helpers:
            return None

        departement_id = project.city.departement_id or project.mobility.city.departement_id
        local_helpers = {h.user_id for h in domain_helpers[departement_id]}
        return domain_helpers[departement_id] + \
            [h for h in domain_helpers[None] if h.user_id not in local_helpers]


_COFFEE_COVERAGE = _CoffeeCoverage()


_DOMAIN_NAMES = [
    {'name': "de l'agriculture", 'value': 'A'},
    {'name': "de l'artisanat", 'value': 'B'},
    {'name': "de la banque, des assurances et de l'immobilier", 'value': 'C'},
    {'name': 'du commerce et de la grande distribution', 'value': 'D'},
    {'name': 'du communication et des médias', 'value': 'E'},
    {'name': 'de la construction et du BTP', 'value': 'F'},
    {'name': 'du tourisme et des loisirs', 'value': 'G11,G12,G13'},
    {'name': "de l'hôtellerie et de la restauration", 'value': 'G14,G15,G16,G17,G18'},
    {'name': "de l'industrie", 'value': 'H'},
    {'name': "de l'installation et de la maintenance", 'value': 'I'},
    {'name': 'de la santé', 'value': 'J'},
    {'name': 'du social', 'value': 'K11,K12,K13,K14,K15,K18,K26'},
    {'name': 'des arts et de la culture', 'value': 'K16,L11,L12,L13,L15'},
    {'name': 'de la défense et de la sécurité', 'value': 'K17,K25'},
    {'name': 'du droit', 'value': 'K19'},
    {'name': 'de la formation', 'value': 'K21'},
    {'name': 'du nettoyage et de la propreté', 'value': 'K22,K23'},
    {'name': 'de la recherche', 'value': 'K24'},
    {'name': 'du sport', 'value': 'L14'},
    {'name': "du support à l'entreprise", 'value': 'M11,M13,M14,M16'},
    {'name': 'de la comptabilité', 'value': 'M12'},
    {'name': 'des ressources humaines', 'value': 'M15'},
    {'name': 'du marketing', 'value': 'M17'},
    {'name': "de l'informatique", 'value': 'M18'},
    {'name': 'de la logistique', 'value': 'N1'},
    {'name': 'du transport aérien et des activités aéroportuaires', 'value': 'N2'},
    {'name': 'du transport maritime et fluvial et des activités portuaires', 'value': 'N3'},
    {'name': 'du transport routier', 'value': 'N4'},
]
_ROME_PREFIX_TO_DOMAIN_NAME = {
    prefix.strip(): domain_name['name']
    for domain_name in _DOMAIN_NAMES
    for prefix in domain_name['value'].split(',')
}


def _ask_users_for_coffee(user, users_database=None, **unused_kwargs):
    helpers = _COFFEE_COVERAGE.get_helpers(users_database.helper, user)
    if not helpers:
        return None
    project = next(p for p in user.projects if not p.is_incomplete)
    rome_id = project.target_job.job_group.rome_id
    for prefix_len in (3, 2, 1):
        domain_name = _ROME_PREFIX_TO_DOMAIN_NAME.get(rome_id[:prefix_len])
        if domain_name:
            break
    else:
        logging.error('No domain name for ROME "%s"', rome_id)
        return None
    auth_token = auth.create_token(user.user_id, 'coffee')
    return dict(campaign.get_default_vars(user), **{
        'acceptUrl': '{}/api/mayday/coffee/accept?user={}&token={}'.format(
            campaign.BASE_URL, parse.quote(user.user_id), parse.quote(auth_token)),
        'declineUrl': '{}/api/mayday/coffee/decline?user={}&token={}'.format(
            campaign.BASE_URL, parse.quote(user.user_id), parse.quote(auth_token)),
        'domain': domain_name,
        'numHelpers': len(helpers),
    })


_DOCUMENT_PROMISES = {helper_pb2.HELP_COVER_LETTER, helper_pb2.HELP_RESUME}


def _make_helper_wait(helper, **unused_kwargs):
    if not helper.email_confirmed:
        return None
    if all(promise.kind not in _DOCUMENT_PROMISES for promise in helper.promises):
        # Helper has no document promise, not concerned.
        return None
    if any(
            promise.kind in _DOCUMENT_PROMISES and promise.documents_by_owner_name
            for promise in helper.promises):
        # Helper has been sent documents at least once, not concerned.
        return None
    kinds = {
        helper_pb2.HelperActionKind.Name(promise.kind)
        for promise in helper.promises if promise.kind in _DOCUMENT_PROMISES}
    return {
        'kind': kinds.pop() if len(kinds) == 1 else 'HELP_BOTH',
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }


def _make_document_user_wait(document, **unused_kwargs):
    if document.num_done_reviews:
        return None
    return {
        'firstName': document.name,
        'kind': review_pb2.DocumentKind.Name(document.kind),
    }


def is_sent_for_doc(helper, helper_reviews, help_kind, document_kind):
    """Returns whether the reason for sending the 'mayday-more-promises' email is that the helper
    reviewed many documents of a given kind.

    Args:
        - helper: the helper proto
        - helper_reviews: a list of the document kinds the user reviewed
        - help_kind: the HelperActionKind of the promises to check
        - document_kind: the DocumentKind of the documents to check.
    """

    review_count = sum(1 for kind in helper_reviews if kind == document_kind)
    promise_count = sum(
        1 for promise in helper.promises if promise.is_fulfilled and promise.kind == help_kind)
    return review_count >= 3 and review_count > promise_count


def _get_why_resend(helper, users_database):
    if any(
            promise.is_fulfilled and promise.kind == helper_pb2.HELP_COFFEE
            for promise in helper.promises):
        return 'HELP_COFFEE'
    all_reviews = users_database.cvs_and_cover_letters.find({'reviews.reviewerId': helper.user_id})
    helper_reviews = [
        review_pb2.DocumentKind.Value(document['kind'])
        for document in all_reviews
        for review in document.get('reviews', [])
        if review.get('reviewerId') == helper.user_id
        if review.get('status') == 'REVIEW_DONE'
    ]
    if is_sent_for_doc(helper, helper_reviews, helper_pb2.HELP_RESUME, review_pb2.DOCUMENT_RESUME):
        return 'HELP_RESUME'
    if is_sent_for_doc(
            helper, helper_reviews, helper_pb2.HELP_COVER_LETTER, review_pb2.DOCUMENT_COVER_LETTER):
        return 'HELP_COVER_LETTER'
    return None


def _get_more_promises_vars(helper, database, users_database):
    why = _get_why_resend(helper, users_database)
    if not why:
        return None

    # Get name of a helped user for coffee.
    coffee_helpee_name = None
    if why == 'HELP_COFFEE':
        coffee_helpee = users_database.user.find_one({'mayday.coffeeHelperId': helper.user_id})
        if not coffee_helpee:
            return None
        coffee_helpee_name = coffee_helpee.get('profile', {}).get('name')
        if not coffee_helpee_name:
            return None

    # Check if we can have a match for coffee.
    has_coffee_match = (helper.cities or helper.is_available_remotely) and helper.domains and \
        match_coffee.get_matching_user(helper, users_database, database)
    return {
        # This should be used with e.g. "{{var:addPromise}}HELP_COFFEE".
        'addPromiseUrl': '{}/api/mayday/promise?redirect={}&user={}&kind='.format(
            campaign.BASE_URL,
            parse.quote('{}/BobAction/merci'.format(campaign.BASE_URL)),
            helper.user_id),
        'coffeeHelpeeName': coffee_helpee_name if coffee_helpee_name else '',
        'hasCoffeeMatch': campaign.as_template_boolean(has_coffee_match),
        'unsubscribeUrl': _get_unsubscribe_url(helper),
        'why': why,
    }


_BEST_HELPERS = {}


def _populate_best_helpers(database):
    helpers = collections.defaultdict(int)
    promise_aggregate = database.helper.aggregate([
        {'$unwind': '$promises'},
        {'$match': {
            'promises.isFulfilled': True,
            'promises.kind': {'$in': ['HELP_COFFEE', 'HELP_TRAIN_ALGO']},
        }},
        {'$group': {'_id': '$_id', 'count': {'$sum': 1}}},
    ])
    for promise_count in promise_aggregate:
        helpers[str(promise_count.get('_id'))] += promise_count.get('count', 0)
    review_aggregate = database.cvs_and_cover_letters.aggregate([
        {'$unwind': '$reviews'},
        {'$match': {'reviews.status': 'REVIEW_DONE'}},
        {'$group': {'_id': '$reviews.reviewerId', 'count': {'$sum': 1}}},
    ])
    for review_count in review_aggregate:
        helpers[str(review_count.get('_id'))] += review_count.get('count', 0)
    sorted_helpers = sorted(helpers.keys(), key=helpers.__getitem__, reverse=True)
    _BEST_HELPERS['topTenScore'] = helpers[sorted_helpers[9]]
    _BEST_HELPERS['topThirtyScore'] = helpers[sorted_helpers[29]]
    _BEST_HELPERS['helpers'] = helpers


def _get_thank_you_vars(helper, users_database, **unused_kwargs):
    if not _BEST_HELPERS:
        _populate_best_helpers(users_database)

    help_count = _BEST_HELPERS['helpers'][helper.user_id]
    return {
        'helpCount': help_count,
        # This might be more than 10 people, but we don't care. Same below.
        'isTopTen': help_count >= _BEST_HELPERS['topTenScore'],
        'isTopThirty': help_count >= _BEST_HELPERS['topThirtyScore'],
        'isInterestedUrl': '{}/api/mayday/interested?user={}&redirect={}'.format(
            campaign.BASE_URL,
            helper.user_id,
            parse.quote('{}/BobAction/merci'.format(campaign.BASE_URL))),
        'unsubscribeUrl': _get_unsubscribe_url(helper),
    }


def _get_no_coffee_vars(user, **unused_kwargs):
    if user.mayday.coffee_helper_id or user.mayday.has_accepted_coffee != user_pb2.TRUE:
        return None
    if not user.projects:
        return None
    in_city = french.in_city(user.projects[0].city.name or user.projects[0].mobility.city.name)
    if not in_city:
        return None
    return dict(campaign.get_default_vars(user), **{
        'inCity': in_city,
        'loggedUrl': campaign.create_logged_url(user.user_id),
    })


campaign.register_campaign('mayday-confirmation', campaign.Campaign(
    mailjet_template='370931',
    mongo_filters={
        'emailConfirmed': {'$ne': True},
    },
    get_vars=_confirm_helper_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
))

campaign.register_campaign('bob-actions-help', campaign.Campaign(
    mailjet_template='384049',
    mongo_filters={},
    get_vars=_bob_actions_help_vars,
    users_collection=campaign.BOB_USERS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))

campaign.register_campaign('targeted-bob-actions-help', campaign.Campaign(
    mailjet_template='379781',
    mongo_filters={'profile.frustrations': 'RESUME'},
    get_vars=_bob_actions_help_vars,
    users_collection=campaign.BOB_USERS,
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
))

campaign.register_campaign('mayday-review-cv', campaign.Campaign(
    mailjet_template='375516',
    mongo_filters={
        'emailConfirmed': True,
        'promises': {'$elemMatch': {
            'kind': 'HELP_RESUME',
            'isFulfilled': {'$ne': True},
        }},
    },
    get_vars=_match_cv_helper_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
    on_email_sent=_confirm_doc_reviewed,
))

campaign.register_campaign('mayday-review-cover-letter', campaign.Campaign(
    mailjet_template='384845',
    mongo_filters={
        'emailConfirmed': True,
        'promises': {'$elemMatch': {
            'kind': 'HELP_COVER_LETTER',
            'documentsByOwnerName': {'$exists': False},
        }},
    },
    get_vars=_match_cover_helper_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
    on_email_sent=_confirm_doc_reviewed,
))

campaign.register_campaign('mayday-end-campaign', campaign.Campaign(
    mailjet_template='377453',
    mongo_filters={},
    get_vars=_confirm_helper_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
))

campaign.register_campaign('mayday-coffee-questions', campaign.Campaign(
    mailjet_template='377466',
    mongo_filters={
        'availableRemotely': {'$ne': True},
        'cities': {'$exists': False},
        'emailConfirmed': True,
        'promises': {'$elemMatch': {
            'isFulfilled': {'$ne': True},
            'kind': 'HELP_COFFEE',
        }}
    },
    get_vars=_ask_for_coffee,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
))

campaign.register_campaign('mayday-algo-questions', campaign.Campaign(
    mailjet_template='388348',
    mongo_filters={
        'emailConfirmed': True,
        'promises': {'$elemMatch': {
            'isFulfilled': {'$ne': True},
            'kind': 'HELP_TRAIN_ALGO',
        }}
    },
    get_vars=_algo_questions_vars,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
    users_collection=campaign.BOB_ACTION_HELPERS,
))

campaign.register_campaign('targeted-bob-actions-coffee', campaign.Campaign(
    mailjet_template='390485',
    mongo_filters={
        'projects': {'$elemMatch': {
            'isIncomplete': {'$ne': True},
            'targetJob.jobGroup.romeId': {'$exists': True},
        }},
        'mayday.hasAcceptedCoffee': {'$exists': False},
    },
    get_vars=_ask_users_for_coffee,
    users_collection=campaign.BOB_USERS,
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
))

campaign.register_campaign('mayday-helper-wait', campaign.Campaign(
    mailjet_template='447017',
    mongo_filters={
        'emailConfirmed': True,
        'promises': {'$not': {'$elemMatch': {
            'documentsByOwnerName': {'$exists': True},
            'kind': {'$in': ['HELP_RESUME', 'HELP_COVER_LETTER']}
        }}},
        'promises.kind': {'$in': ['HELP_RESUME', 'HELP_COVER_LETTER']},
    },
    get_vars=_make_helper_wait,
    users_collection=campaign.BOB_ACTION_HELPERS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))

campaign.register_campaign('mayday-document-wait', campaign.Campaign(
    mailjet_template='447286',
    mongo_filters={'numDoneReviews': {'$not': {'$gt': 0}}},
    get_vars=_make_document_user_wait,
    users_collection=campaign.BOB_ACTION_DOCUMENTS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))

campaign.register_campaign('mayday-more-promises', campaign.Campaign(
    mailjet_template='453248',
    mongo_filters={'promises': {
        '$not': {'$elemMatch': {'isFulfilled': {'$ne': True}}},
        '$elemMatch': {'kind': {'$ne': 'HELP_TRAIN_ALGO'}},
    }},
    get_vars=_get_more_promises_vars,
    users_collection=campaign.BOB_ACTION_HELPERS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))

campaign.register_campaign('mayday-over', campaign.Campaign(
    mailjet_template='457018',
    mongo_filters={'emailConfirmed': True},
    get_vars=_get_thank_you_vars,
    users_collection=campaign.BOB_ACTION_HELPERS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))

campaign.register_campaign('mayday-no-coffee-helper', campaign.Campaign(
    mailjet_template='469530',
    mongo_filters={
        'mayday.hasAcceptedCoffee': 'TRUE',
        'mayday.coffeeHelperId': {'$exists': False},
    },
    get_vars=_get_no_coffee_vars,
    users_collection=campaign.BOB_USERS,
    sender_name='Pascal de Bob',
    sender_email='pascal@bob-emploi.fr',
))
