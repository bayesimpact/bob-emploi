"""Script to migrate users from can_tutoie to locale."""

import unittest

import mongomock

from bob_emploi.frontend.server.asynchronous import migrate_can_tutoie

# Fetched from mongo using
# db.user.aggregate(
#    [{'$group': {_id: {canTutoie: '$profile.canTutoie', locale: '$profile.locale'}}}])
_EXISTING_PAIRS = [
    {'canTutoie': True, 'locale': 'en'},
    {'canTutoie': True, 'locale': 'fr'},
    {'canTutoie': True, 'locale': 'fr@tu'},
    {'canTutoie': True},
    {'locale': 'en'},
    {'locale': 'fr'},
    {'locale': 'fr@tu'},
    {},
]


class MigrateCanTutoieTestCase(unittest.TestCase):
    """Tests for the can tutoie migration."""

    def setUp(self) -> None:
        self._db = mongomock.MongoClient().test

    def test_basic(self) -> None:
        """Test all possible cases from the real database."""

        self._db.user.insert_many([{
            'profile': profile,
            '_order': n
        } for n, profile in enumerate(_EXISTING_PAIRS)])
        migrate_can_tutoie.main(self._db, dry_run=False, disable_sentry=True)

        updated_users = list(self._db.user.find({}).sort('_order'))

        self.assertEqual([
            {'locale': 'en'},
            {'locale': 'fr@tu'},
            {'locale': 'fr@tu'},
            {'locale': 'fr@tu'},
            {'locale': 'en'},
            {'locale': 'fr'},
            {'locale': 'fr@tu'},
            {},
        ], [u.get('profile') for u in updated_users])

    def test_not_override_profile(self) -> None:
        """The rest of the profile is kept unchanged."""

        profile = {
            'name': 'Cyrille',
            'lastName': 'Corpet',
            'locale': 'fr',
            'canTutoie': True,
        }
        self._db.user.insert_one({'profile': profile})
        migrate_can_tutoie.main(self._db, dry_run=False, disable_sentry=True)

        user = self._db.user.find_one({})
        del profile['canTutoie']
        profile['locale'] = 'fr@tu'
        self.assertEqual(profile, user.get('profile'))

    def test_not_override_other_fields(self) -> None:
        """The rest of the profile is kept unchanged."""

        user = {
            'hashedEmail': 'unreadablehash',
            'projects': [{'projectId': '0'}],
            'registeredAt': '2020-03-16',
        }
        self._db.user.insert_one(dict(user, profile={'canTutoie': True}))
        migrate_can_tutoie.main(self._db, dry_run=False, disable_sentry=True)

        updated_user = self._db.user.find_one({})
        del updated_user['_id']
        del updated_user['profile']
        self.assertEqual(user, updated_user)


if __name__ == '__main__':
    unittest.main()
