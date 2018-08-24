"""Unit tests for the Bob Actions Help variables."""

import re
import unittest
from urllib import parse

from bson import objectid
import mock
import mongomock

from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server.asynchronous.mail import mail_blast
from bob_emploi.frontend.server.asynchronous.mail.test import mail_blast_test
from bob_emploi.frontend.server.test import mailjetmock


class BobActionsHelpTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the campaign."""

    campaign_id = 'bob-actions-help'

    def test_main(self):
        """Test basic usage."""

        self.user.user_id = '5e1b910f899e9afae0a78fa6'
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.name = 'Aligaux'
        self.user.profile.email = 'aligaux@bayes.org'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        self._assert_remaining_variables({
            'emailInUrl': 'aligaux%40bayes.org',
            'firstName': 'Aligaux',
            'gender': 'FEMININE',
            'userId': '5e1b910f899e9afae0a78fa6',
        })


class MaydayAlgoHelpTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the campaing for helper who promised to help Bob Algorithm."""

    campaign_id = 'mayday-algo-questions'
    mongo_collection = 'helper'

    def test_main(self):
        """Test basic usage."""

        self.user.promises.add(
            kind=helper_pb2.HELP_TRAIN_ALGO, promise_id='123456789012345678901234')

        self._assert_user_receives_campaign()

        unsubscribe_link = self._variables.pop('unsubscribeUrl')
        algo_link = self._variables.pop('algoPageUrl')
        algo_link_redirect = parse.parse_qs(parse.urlparse(algo_link).query).get('redirect', [])
        self.assertEqual(
            unsubscribe_link,
            'https://www.bob-emploi.fr/api/mayday/unsubscribe?userId={}'.format(
                parse.quote(self.user.user_id)))
        self.assertTrue(algo_link_redirect)
        self.assertEqual(
            'userid={}'.format(self.user.user_id),
            parse.urlparse(algo_link_redirect[0]).query)


@mailjetmock.patch()
class SendCVToReviewTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the blast to send CV to be reviewed."""

    campaign_id = 'mayday-review-cv'
    mongo_collection = 'helper'

    def test_main(self):
        """Basic case."""

        del self.user.promises[:]
        self.user.promises.add(kind=helper_pb2.HELP_RESUME)

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Alice',
                'anonymizedUrl': 'http://cv.com/alice',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Bob',
                'anonymizedUrl': 'http://cv.com/bob',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Eve',
                'anonymizedUrl': 'http://cv.com/eve',
            },
        ])
        document_ids = sorted(
            str(d.get('_id')) for d in self._user_database.cvs_and_cover_letters.find())

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link('unsubscribeUrl')

        # We are too lazy to get the document ids to test it properly so we remove it for now.
        self._variables.pop('documents')
        self._assert_remaining_variables({
            'upperFirstname1': 'ALICE',
            'upperFirstname2': 'BOB',
            'upperFirstname3': 'EVE',
            'firstname1': 'Alice',
            'firstname2': 'Bob',
            'firstname3': 'Eve',
            'docUrl1': 'http://cv.com/alice',
            'docUrl2': 'http://cv.com/bob',
            'docUrl3': 'http://cv.com/eve',
            'isSendingAgain': False,
            'promiseIndex': 0,
        })

        helper_proto = self._user_database.helper.find_one()
        documents_by_owner_name = helper_proto['promises'][0]['documentsByOwnerName']
        self.assertEqual(['alice', 'bob', 'eve'], sorted(documents_by_owner_name.keys()))
        self.assertEqual(document_ids, sorted(documents_by_owner_name.values()))

        one_document = self._user_database.cvs_and_cover_letters.find_one()
        self.assertEqual(self.user.user_id, one_document['reviews'][0]['reviewerId'])
        self.assertEqual(1, one_document['numPendingReviews'])

    def test_same_name(self):
        """Test the case where several users have same name."""

        del self.user.promises[:]
        self.user.promises.add(kind=helper_pb2.HELP_RESUME)

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Alice',
                'anonymizedUrl': 'http://cv.com/alice',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Alice',
                'anonymizedUrl': 'http://cv.com/alice2',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Bob',
                'anonymizedUrl': 'http://cv.com/bob',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Bob',
                'anonymizedUrl': 'http://cv.com/bob2',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Eve',
                'anonymizedUrl': 'http://cv.com/eve',
            },
        ])

        self._assert_user_receives_campaign()

        helper_proto = self._user_database.helper.find_one()
        documents_by_owner_name = helper_proto['promises'][0]['documentsByOwnerName']
        self.assertEqual(['alice', 'bob', 'eve'], sorted(documents_by_owner_name.keys()))
        self.assertEqual(3, len(list(self._user_database.cvs_and_cover_letters.find(
            {'_id': {'$in': [
                objectid.ObjectId(doc) for doc in documents_by_owner_name.values()]}}))))

    def test_send_again(self):
        """Send the email to review CV again."""

        documents_by_owner_name = {
            'alice': '5ae71572ba168b00135fe309',
            'bob': '5ae71572ba168b00135fe310',
            'eve': '5ae71572ba168b00135fe311'}
        del self.user.promises[:]
        self.user.promises.add(
            kind=helper_pb2.HELP_RESUME, documents_by_owner_name=documents_by_owner_name)

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                '_id': objectid.ObjectId('5ae71572ba168b00135fe309'),
                'kind': 'DOCUMENT_RESUME',
                'name': 'Alice',
                'anonymizedUrl': 'http://cv.com/alice',
            },
            {
                '_id': objectid.ObjectId('5ae71572ba168b00135fe310'),
                'kind': 'DOCUMENT_RESUME',
                'name': 'Bob',
                'anonymizedUrl': 'http://cv.com/bob',
            },
            {
                '_id': objectid.ObjectId('5ae71572ba168b00135fe311'),
                'kind': 'DOCUMENT_RESUME',
                'name': 'Eve',
                'anonymizedUrl': 'http://cv.com/eve',
            },
        ])

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link('unsubscribeUrl')

        self._assert_remaining_variables({
            'upperFirstname1': 'ALICE',
            'upperFirstname2': 'BOB',
            'upperFirstname3': 'EVE',
            'firstname1': 'Alice',
            'firstname2': 'Bob',
            'firstname3': 'Eve',
            'docUrl1': 'http://cv.com/alice',
            'docUrl2': 'http://cv.com/bob',
            'docUrl3': 'http://cv.com/eve',
            'documents': {
                'alice': '5ae71572ba168b00135fe309',
                'bob': '5ae71572ba168b00135fe310',
                'eve': '5ae71572ba168b00135fe311'},
            'isSendingAgain': True,
            'promiseIndex': 0,
        })

        helper_proto = self._user_database.helper.find_one()
        documents_by_owner_name = helper_proto['promises'][0]['documentsByOwnerName']
        self.assertEqual(['alice', 'bob', 'eve'], sorted(documents_by_owner_name.keys()))

        one_document = self._user_database.cvs_and_cover_letters.find_one()
        self.assertFalse(one_document.get('reviews'), msg='Document should not be modified')


class SendCoverLetterToReviewTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the blast to send cover letter to be reviewed."""

    campaign_id = 'mayday-review-cover-letter'
    mongo_collection = 'helper'

    def test_main(self):
        """Basic case."""

        del self.user.promises[:]
        self.user.promises.add(kind=helper_pb2.HELP_COVER_LETTER)

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                'kind': 'DOCUMENT_COVER_LETTER',
                'name': 'Alice',
                'anonymizedUrl': 'http://coverletter.com/alice',
            },
            {
                'kind': 'DOCUMENT_COVER_LETTER',
                'name': 'Bob',
                'anonymizedUrl': 'http://coverletter.com/bob',
            },
            {
                'kind': 'DOCUMENT_RESUME',
                'name': 'Eve',
                'anonymizedUrl': 'http://cv.com/eve',
            },
            {
                'kind': 'DOCUMENT_COVER_LETTER',
                'name': 'Marie',
                'anonymizedUrl': 'http://coverletter.com/marie',
            },
        ])
        cover_letter_ids = sorted(
            str(d.get('_id'))
            for d in self._user_database.cvs_and_cover_letters.find()
            if d.get('kind') == 'DOCUMENT_COVER_LETTER')

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link('unsubscribeUrl')

        # We are too lazy to get the document ids to test it properly so we remove it for now.
        self._variables.pop('documents')
        self._assert_remaining_variables({
            'upperFirstname1': 'ALICE',
            'upperFirstname2': 'BOB',
            'upperFirstname3': 'MARIE',
            'firstname1': 'Alice',
            'firstname2': 'Bob',
            'firstname3': 'Marie',
            'docUrl1': 'http://coverletter.com/alice',
            'docUrl2': 'http://coverletter.com/bob',
            'docUrl3': 'http://coverletter.com/marie',
            'isSendingAgain': False,
            'promiseIndex': 0,
        })

        helper_proto = self._user_database.helper.find_one()
        documents_by_owner_name = helper_proto['promises'][0]['documentsByOwnerName']
        self.assertEqual(['alice', 'bob', 'marie'], sorted(documents_by_owner_name.keys()))
        self.assertEqual(cover_letter_ids, sorted(documents_by_owner_name.values()))

        one_document = self._user_database.cvs_and_cover_letters.find_one()
        self.assertEqual(self.user.user_id, one_document['reviews'][0]['reviewerId'])
        self.assertEqual(1, one_document['numPendingReviews'])


@mailjetmock.patch()
class CoffeeQuestionsEmailTest(unittest.TestCase):
    """Unit tests for the campaign."""

    @mock.patch(mail_blast.auth.__name__ + '.SECRET_SALT', new=b'prod-secret')
    @mock.patch(
        mail_blast.__name__ + '._USER_DB',
        new_callable=lambda: mongomock.MongoClient().user_test)
    def test_blast_helpers(self, mock_user_db):
        """Basic usage."""

        promise_id = '123456789012345678901234'
        mock_user_db.helper.insert_one({
            'email': 'helper@corpet.net',
            'emailConfirmed': True,
            'promises': [{
                'kind': 'HELP_COFFEE',
                'promiseId': promise_id,
            }],
            'registeredAt': '2018-04-15T00:00:00Z',
        })
        mail_blast.main([
            'mayday-coffee-questions', 'send',
            '--registered-from', '2018-04-01',
            '--registered-to', '2018-05-10',
            '--disable-sentry'])

        sent_messages = mailjetmock.get_all_sent_messages()
        self.assertEqual(1, len(sent_messages), msg=sent_messages)
        self.assertTrue(mock_user_db.helper.find_one().get('emailsSent'))


class TargetedBobActionsCoffeeHelpTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the targeted-bob-actions-coffee campaign."""

    campaign_id = 'targeted-bob-actions-coffee'

    def setUp(self):
        super(TargetedBobActionsCoffeeHelpTest, self).setUp()
        self._user_database.helper.insert_one({
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
            'emailConfirmed': True,
            'cities': [{
                'name': 'Lyon',
                'departementId': '69',
            }],
            'domains': ['A', 'B', 'C1,C2'],
        })

    def test_main(self):
        """Test basic usage."""

        self.user.profile.name = 'Aligaux'
        self.user.profile.gender = user_pb2.FEMININE
        self.user.profile.email = 'aligaux@bayes.org'
        self.user.user_id = '5e1b910f899e9afae0a78fa6'
        self.user.projects[0].target_job.job_group.rome_id = 'A1234'
        self.user.projects[0].mobility.city.departement_id = '69'

        self._assert_user_receives_campaign()

        self._assert_has_unsubscribe_link()

        accept_url = self._variables.pop('acceptUrl')
        decline_url = self._variables.pop('declineUrl')
        self.assertEqual(decline_url, accept_url.replace('/accept', '/decline'))

        accept_url_object = parse.urlparse(accept_url)
        self.assertEqual('/api/mayday/coffee/accept', accept_url_object.path)
        query_args = parse.parse_qs(accept_url_object.query)
        self.assertEqual({'token', 'user'}, query_args.keys())
        self.assertEqual(['5e1b910f899e9afae0a78fa6'], query_args['user'])

        self._assert_remaining_variables({
            'domain': "de l'agriculture",
            'firstName': 'Aligaux',
            'gender': 'FEMININE',
            'numHelpers': 1,
        })

    def test_no_helper_in_departement(self):
        """Nobody can help in the departement."""

        self.user.projects[0].target_job.job_group.rome_id = 'A1234'
        self.user.projects[0].mobility.city.departement_id = '75'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_no_helper_in_domain(self):
        """Nobody can help for this domain."""

        self.user.projects[0].target_job.job_group.rome_id = 'Z1234'
        self.user.projects[0].mobility.city.departement_id = '69'

        self._assert_user_receives_campaign(should_be_sent=False)

    def test_helper_available_everywhere(self):
        """The helper is not in the same département but available."""

        self.user.projects[0].target_job.job_group.rome_id = 'A1234'
        self.user.projects[0].mobility.city.departement_id = '75'
        self._user_database.helper.insert_one({
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
            'emailConfirmed': True,
            'isAvailableRemotely': True,
            'cities': [{
                'name': 'Lyon',
                'departementId': '69',
            }],
            'domains': ['A', 'B'],
        })

        self._assert_user_receives_campaign()

    def test_helper_available_everywhere_counted_once(self):
        """The helper is in the same département and available online."""

        self.user.projects[0].target_job.job_group.rome_id = 'A1234'
        self.user.projects[0].mobility.city.departement_id = '75'
        self._user_database.helper.insert_one({
            'promises': [{
                'kind': 'HELP_COFFEE',
            }],
            'emailConfirmed': True,
            'isAvailableRemotely': True,
            'cities': [{
                'name': 'Lyon',
                'departementId': '75',
                }],
            'domains': ['A', 'B'],
        })

        self._assert_user_receives_campaign()

        self.assertEqual(1, self._variables.pop('numHelpers'))

    def test_mutli_domain_helper(self):
        """The helper has a multi-valued domain."""

        self.user.projects[0].target_job.job_group.rome_id = 'C1234'
        self.user.projects[0].mobility.city.departement_id = '69'

        self._assert_user_receives_campaign()
        self.assertEqual(1, self._variables.pop('numHelpers'))


class MaydayDocumentWaitTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the targeted-bob-actions-coffee campaign."""

    campaign_id = 'mayday-document-wait'

    mongo_collection = 'cvs_and_cover_letters'

    def test_main(self):
        """Test basic usage."""

        self.user.name = 'Alice'
        self.user.owner_email = 'alice@help.me'
        self.user.kind = review_pb2.DOCUMENT_RESUME

        self._assert_user_receives_campaign()

        self._assert_remaining_variables({
            'firstName': 'Alice',
            'kind': 'DOCUMENT_RESUME',
        })

    def test_review_done(self):
        """Nobody can help in the departement."""

        self.user.name = 'Alice'
        self.user.owner_email = 'alice@help.me'
        self.user.kind = review_pb2.DOCUMENT_RESUME
        self.user.num_done_reviews = 1

        self._assert_user_receives_campaign(should_be_sent=False)


class MaydayAskMorePromisesTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the mayday-more-promises campaign."""

    campaign_id = 'mayday-more-promises'

    mongo_collection = 'helper'

    def setUp(self):
        super(MaydayAskMorePromisesTest, self).setUp()
        self.add_promise_url = (
            'https://www.bob-emploi.fr/api/mayday/promise?'
            'redirect=https%3A//www.bob-emploi.fr/BobAction/merci'
            '&user={}&kind='.format(self.user.user_id))

    def test_coffee_user(self):
        """Test that a coffee helper is asked again if there is a new matching helpee."""

        city = self.user.cities.add()
        city.city_id = '31555'
        self.user.domains.append('A')
        self.promise.is_fulfilled = True
        self.promise.kind = helper_pb2.HELP_COFFEE
        self._user_database.user.insert_many([
            {
                'mayday': {'hasAcceptedCoffee': 'TRUE'},
                'profile': {'email': 'alice@help.me'},
                'projects': [{
                    'mobility': {'city': {'cityId': '31555'}},
                    'targetJob': {'jobGroup': {'romeId': 'A1234'}},
                }],
            },
            {
                'mayday': {'coffeeHelperId': self.user.user_id},
                'profile': {'name': 'Bob'},
            },
        ])

        self._assert_user_receives_campaign()
        self._assert_has_unsubscribe_link(field='unsubscribeUrl')
        self._assert_remaining_variables({
            'addPromiseUrl': self.add_promise_url,
            'coffeeHelpeeName': 'Bob',
            'hasCoffeeMatch': 'True',
            'why': 'HELP_COFFEE',
        })

    def test_resume_reviewer(self):
        """Test that a person who reviewed at least three resumes, and more than their promise
        count is asked again."""

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                'kind': 'DOCUMENT_RESUME',
                'reviews': [{
                    'reviewerId': self.user.user_id,
                    'status': 'REVIEW_DONE',
                }],
            } for i in range(3)
        ])
        self.promise.is_fulfilled = True
        self._assert_user_receives_campaign()
        self._assert_has_unsubscribe_link(field='unsubscribeUrl')
        self._assert_remaining_variables({
            'addPromiseUrl': self.add_promise_url,
            'coffeeHelpeeName': '',
            'hasCoffeeMatch': '',
            'why': 'HELP_RESUME',
        })

    def test_not_all_fulfilled(self):
        """Test that a person with unfulfilled promises won't be asked for another one."""

        self._user_database.cvs_and_cover_letters.insert_many([
            {
                'kind': 'DOCUMENT_RESUME',
                'reviews': [{
                    'reviewerId': self.user.user_id,
                    'status': 'REVIEW_DONE',
                }],
            } for i in range(3)
        ])
        self.promise.is_fulfilled = True
        unfufilled_promise = self.user.promises.add()
        unfufilled_promise.kind = helper_pb2.HELP_COFFEE
        self._assert_user_receives_campaign(should_be_sent=False)


class MaydayOverTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the mayday-over campaign."""

    campaign_id = 'mayday-over'

    mongo_collection = 'helper'

    def setUp(self):
        super(MaydayOverTest, self).setUp()
        patcher = mock.patch(
            mail_blast.all_campaigns.bob_actions_help.__name__ + '._BEST_HELPERS', new={})
        patcher.start()
        self.addCleanup(patcher.stop)
        # Add 10 helper with two helps.
        self._user_database.helper.insert_many([
            {
                'email': 'algo{}@help.alot'.format(n),
                'promises': [{
                    'kind': 'HELP_TRAIN_ALGO',
                    'isFulfilled': True,
                } for _ in range(2)],
            }
            for n in range(10)
        ])

        # Add 20 helper with one help.
        self._user_database.helper.insert_many([
            {
                'email': 'algo{}@help.alot'.format(n),
                'promises': [{
                    'kind': 'HELP_TRAIN_ALGO',
                    'isFulfilled': True,
                }],
            }
            for n in range(20)
        ])

    def test_top_ten(self):
        """A helper with most fulfilled promises is in top ten."""

        promise = self.user.promises.add()
        promise.kind = helper_pb2.HELP_TRAIN_ALGO
        promise.is_fulfilled = True
        promise2 = self.user.promises.add()
        promise2.kind = helper_pb2.HELP_COFFEE
        promise2.is_fulfilled = True
        self.user.user_id = '012345678901234567890123'

        self._user_database.cvs_and_cover_letters.insert_one({
            'kind': 'DOCUMENT_RESUME',
            'reviews': [{
                'status': 'REVIEW_DONE',
                'reviewerId': self.user.user_id,
            }]
        })

        self._assert_user_receives_campaign()
        self._assert_has_unsubscribe_link('unsubscribeUrl')
        self._assert_remaining_variables({
            'helpCount': 3,
            'isTopTen': True,
            'isTopThirty': True,
            'isInterestedUrl':
                'https://www.bob-emploi.fr/api/mayday/interested?'
                'user={}&redirect=https%3A//www.bob-emploi.fr/BobAction/merci'.format(
                    self.user.user_id),
        })

    def test_top_thirty(self):
        """A helper with enough fulfilled promises is in top thirty."""

        promise = self.user.promises.add()
        promise.kind = helper_pb2.HELP_TRAIN_ALGO
        promise.is_fulfilled = True

        self._assert_user_receives_campaign()
        self.assertFalse(self._variables.get('isTopTen'))
        self.assertTrue(self._variables.get('isTopThirty'))

    def test_bottom(self):
        """A helper with no help is neither in top ten or thirty."""

        self._assert_user_receives_campaign()
        self.assertFalse(self._variables.get('isTopTen'))
        self.assertFalse(self._variables.get('isTopThirty'))


class NoCoffeeHelperTest(mail_blast_test.CampaignTestBase):
    """Unit tests for the mayday-no-coffee-helper email."""

    campaign_id = 'mayday-no-coffee-helper'

    def test_basic_usage(self):
        """Basic usage."""

        self.user.profile.name = 'Paul'
        self.user.profile.gender = user_pb2.MASCULINE
        self.user.mayday.has_accepted_coffee = user_pb2.TRUE
        self.user.mayday.coffee_helper_id = ''
        self.project.mobility.city.name = 'Toulouse'

        self._assert_user_receives_campaign()
        self._assert_has_unsubscribe_link()
        self._assert_url_field(
            'loggedUrl', 'https://www.bob-emploi.fr',
            **dict({
                'user': self.user.user_id,
                'authToken': re.compile(r'^\d+\.[a-f0-9]+$'),
            }))
        self._assert_remaining_variables({
            'firstName': 'Paul',
            'gender': 'MASCULINE',
            'inCity': 'à Toulouse',
        })


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
