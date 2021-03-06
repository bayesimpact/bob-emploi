"""Tests for the self._populate_template function."""

import datetime
import itertools
import os
import unittest
from unittest import mock
from typing import Set

import mongomock

from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server import mongo
from bob_emploi.frontend.server import scoring
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


_FAKE_TRANSLATIONS_FILE = os.path.join(os.path.dirname(__file__), 'testdata/translations.json')


@mock.patch.dict(os.environ, {'I18N_TRANSLATIONS_FILE': _FAKE_TRANSLATIONS_FILE})
class PopulateProjectTemplateTest(unittest.TestCase):
    """All unit tests for populate_template."""

    unused_variables: Set[str] = set()

    @classmethod
    def setUpClass(cls) -> None:
        cls.unused_variables = set(
            scoring.scoring_base._TEMPLATE_VARIABLES)  # pylint: disable=protected-access

    @classmethod
    def tearDownClass(cls) -> None:
        unused_variables_string = ', '.join(cls.unused_variables)
        cls().assertFalse(
            cls.unused_variables,
            msg=f"Some variables haven't been tested:\n{unused_variables_string}")

    def setUp(self) -> None:
        super().setUp()
        i18n.cache.clear()
        # Pre-populate project's fields that are usualldy set. Individual tests
        # should not count on those values.
        self.project = project_pb2.Project()
        self.project.target_job.name = 'Boulanger / Boulangère'
        self.project.target_job.masculine_name = 'Boulanger'
        self.project.target_job.feminine_name = 'Boulangère'
        self.project.target_job.job_group.rome_id = 'Z9007'
        self.project.city.city_id = '69123'
        self.project.city.departement_id = '69'
        self.project.city.region_id = '84'
        self.project.city.postcodes = '69001-69002-69003-69004'
        self.project.city.name = 'Lyon'
        self.database = mongo.NoPiiMongoDatabase(mongomock.MongoClient().test)
        self.database.regions.insert_one({
            '_id': '84',
            'prefix': 'en ',
            'name': 'Auvergne-Rhône-Alpes',
        })
        self.scoring_project = scoring.ScoringProject(self.project, user_pb2.User(), self.database)

    def _populate_template(self, template: str) -> str:
        populated = self.scoring_project.populate_template(template)
        self.unused_variables -= set(
            self.scoring_project._template_variables)  # pylint: disable=protected-access
        return populated

    def test_capitalized(self) -> None:
        """Forces capitalization if needed."""

        self.project.city.name = 'Lyon'
        self.assertEqual(
            'À Lyon, il y a une tour appelée Incity.',
            self._populate_template('%InCity, il y a une tour appelée Incity.'))

    @mock.patch('logging.warning')
    @mock.patch('logging.info')
    def test_bad_capitalized(self, mock_info: mock.MagicMock, mock_warning: mock.MagicMock) -> None:
        """Cannot guess the right capitalization for template variables."""

        self.project.city.name = 'Lyon'
        self.assertEqual(
            '%incity, il y a une tour appelée Incity.',
            self._populate_template('%incity, il y a une tour appelée Incity.'))
        mock_info.assert_called_once()
        mock_warning.assert_called_once()

    def test_pole_emploi(self) -> None:
        """Test Pôle emploi basic URL."""

        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.city.departement_id = '45'

        link = self._populate_template(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=%romeId&codeZoneGeographique=%departementId&'
            'typeZoneGeographique=DEPARTEMENT')
        self.assertEqual(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=A1234&codeZoneGeographique=45&typeZoneGeographique=DEPARTEMENT',
            link)

    def test_le_bon_coin(self) -> None:
        """Test LeBonCoin basic URL."""

        self.project.target_job.masculine_name = 'Boucher'
        self.project.city.name = 'Toulouse'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Boucher&location=Toulouse&parrot=0 ',
            link)

    def test_le_bon_coin_spaces(self) -> None:
        """Test LeBonCoin URLs when job and city names contain white spaces."""

        self.project.target_job.masculine_name = 'Data scientist'
        self.project.city.name = 'Le Havre'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Data%20scientist&location=Le%20Havre&parrot=0 ',
            link)

    def test_le_bon_coin_special_chars(self) -> None:
        """Test LeBonCoin URLs when job and city names contain special chars."""

        self.project.target_job.masculine_name = 'Employé de ménage'
        self.project.city.name = 'Orléans-cœur'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Employ%E9%20de%20m%E9nage&location=Orl%E9ans-c%3Fur&parrot=0 ',
            link)

    def test_la_bonne_boite(self) -> None:
        """Test LaBonneBoite basic URL."""

        self.project.target_job.job_group.name = 'Boucherie'
        self.project.city.name = 'Toulouse'
        self.project.city.departement_id = '31'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Toulouse-31000/'
            'boucherie?sort=distance&d=10&h=1',
            link)

    def test_url_encode(self) -> None:
        """Test URL encoding any var."""

        self.scoring_project.user_profile.gender = user_pb2.MASCULINE
        self.project.target_job.masculine_name = 'Employé de ménage'

        link = self._populate_template(
            'https://www.pole-emploi.fr/offres/?mots-clef=%urlEncodeJobName')
        self.assertEqual(
            'https://www.pole-emploi.fr/offres/?mots-clef=employ%C3%A9%20de%20m%C3%A9nage',
            link)

    def test_la_bonne_boite_dom(self) -> None:
        """Test LaBonneBoite URL when city is in a DOM and does not have a postcode."""

        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.city.name = 'Saint-Denis'
        self.project.city.departement_id = '974'
        self.project.city.postcodes = ''

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%postcode/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Saint-Denis-97400/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_spaces(self) -> None:
        """Test LaBonneBoite URL when city and job group names contain spaces."""

        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.city.name = 'Le Havre'
        self.project.city.departement_id = '76'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Le%20Havre-76000/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_special_chars(self) -> None:
        """Test LaBonneBoite URL when city and job group names contain special chars."""

        self.project.target_job.job_group.name = (
            "Recherche en sciences de l'homme et de la société")
        self.project.city.name = 'Orléans'
        self.project.city.departement_id = '45'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Orl%C3%A9ans-45000/'
            'recherche-en-sciences-de-l-homme-et-de-la-societe?sort=distance&d=10&h=1',
            link)

    def test_mayor_advice(self) -> None:
        """All required vars for the contact your mayor advice."""

        self.project.city.name = 'Le Mans'
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.scoring_project.user_profile.gender = user_pb2.FEMININE

        card_content = self._populate_template(
            'Cher maire %ofCity. Je vis %inCity depuis 3 ans et je cherche un '
            'emploi %ofJobName.')

        self.assertEqual(
            'Cher maire du Mans. Je vis au Mans depuis 3 ans et je cherche un '
            "emploi d'hôtesse.",
            card_content)

    def test_en_mayor_advice(self) -> None:
        """All required vars for the English contact your mayor advice."""

        self.project.city.name = 'Le Mans'
        self.scoring_project.user_profile.locale = 'en'

        card_content = self._populate_template(
            "Dear mayor %ofCity, I've been living %inCity for 3 years")

        self.assertEqual(
            "Dear mayor of Le Mans, I've been living in Le Mans for 3 years", card_content)

    def test_situation_presentation(self) -> None:
        """Present a jobseeker's situation."""

        self.scoring_project.user_profile.gender = user_pb2.MASCULINE
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR

        sentence = self._populate_template(
            'Je suis %jobName à 5% depuis %experienceDuration.')
        self.assertEqual('Je suis steward à 5% depuis plus de 6 ans.', sentence)

    def test_new_situation_presentation(self) -> None:
        """Present a jobseeker's situation."""

        self.scoring_project.user_profile.gender = user_pb2.MASCULINE
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR

        sentence = self._populate_template(
            "J'ai commencé en tant que %jobName à 5% %expDurationAgo.")
        self.assertEqual("J'ai commencé en tant que steward à 5% il y a plus de 6 ans.", sentence)

    @mock.patch(scoring.logging.__name__ + '.warning')
    def test_missing_variables(self, mock_warning: mock.MagicMock) -> None:
        """ Template still has some variable not replaced."""

        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR
        sentence = self._populate_template('Je suis %masculineJobName en %random.')

        mock_warning.assert_called_once()
        self.assertEqual(
            'One or more template variables have not been replaced in:\n'
            'Je suis steward en %random.',
            mock_warning.call_args_list[0][0][0])

        self.assertEqual('Je suis steward en %random.', sentence)

    @mock.patch(scoring.logging.__name__ + '.warning')
    def test_missing_titled_variables(self, mock_warning: mock.MagicMock) -> None:
        """ Template still has some variable not replaced, and it's title cased."""

        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR
        sentence = self._populate_template('Je suis %MasculineJbName.')

        mock_warning.assert_called_once()
        self.assertEqual(
            'One or more template variables have not been replaced in:\n'
            'Je suis %MasculineJbName.',
            mock_warning.call_args_list[0][0][0])

        self.assertEqual('Je suis %MasculineJbName.', sentence)

    @mock.patch(scoring.logging.__name__ + '.warning')
    def test_url_encoding(self, mock_warning: mock.MagicMock) -> None:
        """ Template has URL encoding that might look like missing variables."""

        sentence = self._populate_template('https://www.studentjob.fr/offre?utf8=%E2%9C%93')

        mock_warning.assert_not_called()

        self.assertEqual('https://www.studentjob.fr/offre?utf8=%E2%9C%93', sentence)

        sentence = self._populate_template('https://www.studentjob.fr/offre?utf8=%E2%ACfollow')

        mock_warning.assert_not_called()

        self.assertEqual('https://www.studentjob.fr/offre?utf8=%E2%ACfollow', sentence)

    def test_job_presentation(self) -> None:
        """Present a job name."""

        self.project.target_job.masculine_name = 'Steward VIP'
        self.project.target_job.feminine_name = 'Hôtesse VIP'
        self.scoring_project.user_profile.gender = user_pb2.FEMININE

        sentence = self._populate_template(
            'Je suis %aJobName ! Je suis une %feminineJobName ! pas un %masculineJobName')
        self.assertEqual(
            'Je suis une hôtesse VIP ! Je suis une hôtesse VIP ! pas un steward VIP', sentence)

    def test_job_english_presentation(self) -> None:
        """Present a job name."""

        self.project.target_job.masculine_name = 'VIP Steward'
        self.project.target_job.feminine_name = 'VIP Hostess'
        self.scoring_project.user_profile.gender = user_pb2.FEMININE
        self.scoring_project.user_profile.locale = 'en'

        sentence = self._populate_template(
            'I am %aJobName! I am a %feminineJobName! not a %masculineJobName')
        self.assertEqual(
            'I am a VIP Hostess! I am a VIP Hostess! not a VIP Steward', sentence)

    def test_in_domain_network_advice(self) -> None:
        """Var required for a network advice in a specific job group domain."""

        self.database.job_group_info.insert_one(
            {'_id': 'Z9007', 'inDomain': 'en boulangerie'})
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template('Contactez des gens qui travaillent %inDomain')
        self.assertEqual('Contactez des gens qui travaillent en boulangerie', sentence)

    def test_workplace_presentation(self) -> None:
        """Var required for presenting a workplace."""

        self.database.job_group_info.insert_one({
            '_id': 'Z9007',
            'inAWorkplace': 'dans une boulangerie',
            'likeYourWorkplace': 'comme la vôtre',
            'placePlural': 'des boulangeries'})
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template(
            'Il y a %placePlural, mais %inAWorkplace %likeYourWorkplace…')
        self.assertEqual(
            'Il y a des boulangeries, mais dans une boulangerie comme la vôtre…', sentence)

    def test_positive_feedback(self) -> None:
        """Var required for presenting a workplace."""

        self.database.job_group_info.insert_one({
            '_id': 'Z9007',
            'whatILoveAbout': "j'adore vos patisseries"
        })
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template('Je voudrais rencontrer votre chef car %whatILoveAbout')
        self.assertEqual("Je voudrais rencontrer votre chef car j'adore vos patisseries", sentence)

    def test_positive_feminine_feedback(self) -> None:
        """Var required for presenting a workplace as a woman."""

        self.database.job_group_info.insert_one({
            '_id': 'Z9007',
            'whatILoveAbout': 'je suis intéressé par vos patisseries',
            'whatILoveAboutFeminine': 'je suis intéressée par vos patisseries',
        })
        self.scoring_project.user_profile.gender = user_pb2.FEMININE
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template('Je voudrais rencontrer votre chef car %whatILoveAbout')
        self.assertEqual(
            'Je voudrais rencontrer votre chef car je suis intéressée par vos patisseries',
            sentence)

    def test_positive_missing_feminine_feedback(self) -> None:
        """Var required for presenting a workplace as a woman when sentence is neutral."""

        self.database.job_group_info.insert_one({
            '_id': 'Z9007',
            'whatILoveAbout': "j'adore vos patisseries"
        })
        self.scoring_project.user_profile.gender = user_pb2.FEMININE
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template('Je voudrais rencontrer votre chef car %whatILoveAbout')
        self.assertEqual("Je voudrais rencontrer votre chef car j'adore vos patisseries", sentence)

    def test_user_presentation(self) -> None:
        """Present a user."""

        self.scoring_project.user_profile.name = 'Dan'
        self.scoring_project.user_profile.last_name = 'Diner'

        sentence = self._populate_template("Je m'appelle %name %lastName et je me dandine")
        self.assertEqual("Je m'appelle Dan Diner et je me dandine", sentence)

    def test_feminine_user(self) -> None:
        """Add e to feminine users."""

        self.scoring_project.user_profile.gender = user_pb2.FEMININE

        sentence = self._populate_template('Hier, tu es allé%eFeminine au marché')
        self.assertEqual(sentence, 'Hier, tu es allée au marché')

    def test_masculine_user(self) -> None:
        """Don't add e to not-feminine users."""

        self.scoring_project.user_profile.gender = user_pb2.MASCULINE

        sentence = self._populate_template('Hier, tu es allé%eFeminine au marché')
        self.assertEqual(sentence, 'Hier, tu es allé au marché')

    def test_in_region_template(self) -> None:
        """Use inRegion template."""

        self.database.regions.insert_one({
            '_id': '06',
            'name': 'Mayotte',
            'prefix': 'à ',
        })
        self.project.city.region_id = '06'
        sentence = self._populate_template('Bienvenue %inRegion !')
        self.assertEqual('Bienvenue à Mayotte !', sentence)

    def test_in_departement_template(self) -> None:
        """Use inDepartement template."""

        self.database.departements.insert_one({
            '_id': '31',
            'name': 'Haute-Garonne',
            'prefix': 'en ',
        })
        self.project.city.departement_id = '31'
        sentence = self._populate_template('Bienvenue %inDepartement !')
        self.assertEqual('Bienvenue en Haute-Garonne !', sentence)

    def test_in_departement_template_missing_data(self) -> None:
        """Use inDepartement template without data."""

        self.project.city.departement_id = '31'
        sentence = self._populate_template('Bienvenue %inDepartement !')
        self.assertEqual('Bienvenue dans le département !', sentence)

    def test_job_search_length_months(self) -> None:
        """Give the length of the user's search in months."""

        self.project.job_search_started_at.FromDatetime(
            self.scoring_project.now - datetime.timedelta(days=90))
        self.project.created_at.FromDatetime(self.scoring_project.now)

        sentence = self._populate_template(
            'Je cherche un emploi depuis %jobSearchLengthMonthsAtCreation mois')
        self.assertEqual('Je cherche un emploi depuis trois mois', sentence)

    @mock.patch('logging.warning')
    def test_undefined_job_search_length(self, mock_warning: mock.MagicMock) -> None:
        """Put a placeholder and issue a warning for the length of the user's search in months."""

        self.project.job_search_has_not_started = False
        self.project.created_at.FromDatetime(self.scoring_project.now)

        sentence = self._populate_template(
            'Je cherche un emploi depuis %jobSearchLengthMonthsAtCreation mois')
        self.assertEqual('Je cherche un emploi depuis quelques mois', sentence)
        mock_warning.assert_called_once()

    @mock.patch('logging.exception')
    def test_long_job_search_length_months(self, mock_exception: mock.MagicMock) -> None:
        """Put a placeholder for the length of the user's search in months."""

        self.project.job_search_started_at.FromDatetime(
            self.scoring_project.now - datetime.timedelta(days=1000))
        self.project.created_at.FromDatetime(self.scoring_project.now)

        sentence = self._populate_template(
            'Je cherche un emploi depuis %jobSearchLengthMonthsAtCreation mois')
        self.assertEqual('Je cherche un emploi depuis quelques mois', sentence)

        mock_exception.assert_not_called()

    def test_job_search_length_months_english(self) -> None:
        """Give the length of the user's search in months in English."""

        self.project.job_search_started_at.FromDatetime(
            self.scoring_project.now - datetime.timedelta(days=90))
        self.project.created_at.FromDatetime(self.scoring_project.now)
        self.scoring_project.user_profile.locale = 'en'

        sentence = self._populate_template(
            "After %jobSearchLengthMonthsAtCreation months it's time to start looking")
        self.assertEqual("After three months it's time to start looking", sentence)

    @mock.patch(scoring.logging.__name__ + '.warning')
    def test_undefined_job_search_length_english(self, mock_warning: mock.MagicMock) -> None:
        """Put a placeholder and issue a warning for the length of the user's search in months."""

        self.project.job_search_has_not_started = False
        self.project.created_at.FromDatetime(self.scoring_project.now)
        self.scoring_project.user_profile.locale = 'en'

        sentence = self._populate_template(
            "After %jobSearchLengthMonthsAtCreation months it's time to start looking")
        self.assertEqual("After few months it's time to start looking", sentence)
        mock_warning.assert_called_once()

    @mock.patch('logging.exception')
    def test_long_job_search_length_months_english(self, mock_exception: mock.MagicMock) -> None:
        """Put a placeholder for the length of the user's search in months in English."""

        self.project.job_search_started_at.FromDatetime(
            self.scoring_project.now - datetime.timedelta(days=1000))
        self.project.created_at.FromDatetime(self.scoring_project.now)
        self.scoring_project.user_profile.locale = 'en'

        sentence = self._populate_template(
            "After %jobSearchLengthMonthsAtCreation months it's time to start looking")
        self.assertEqual("After few months it's time to start looking", sentence)

        mock_exception.assert_not_called()

    def test_total_interview(self) -> None:
        """Give the number of interviews."""

        self.project.total_interview_count = 5
        sentence = self._populate_template("J'ai déjà obtenu %totalInterviewCount entretiens.")
        self.assertEqual("J'ai déjà obtenu cinq entretiens.", sentence)

    def test_total_interview_english(self) -> None:
        """Give the number of interviews in English."""

        self.project.total_interview_count = 5
        self.scoring_project.user_profile.locale = 'en'
        sentence = self._populate_template("I've already got %totalInterviewCount interviews.")
        self.assertEqual("I've already got five interviews.", sentence)

    def test_many_total_interview(self) -> None:
        """Give the number of interviews when there are many."""

        self.project.total_interview_count = 10
        sentence = self._populate_template("J'ai déjà obtenu %totalInterviewCount entretiens.")
        self.assertEqual("J'ai déjà obtenu 10 entretiens.", sentence)

    def test_values_are_cached(self) -> None:
        """Test that template variables values are actually cached."""

        self.scoring_project.user_profile.name = 'Dan'
        sentence1 = self._populate_template("Je m'appelle %name.")
        self.scoring_project.user_profile.name = 'Danny'
        sentence2 = self._populate_template("Je m'appelle %name.")
        self.assertEqual(sentence1, sentence2)

    def test_country_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire country."""

        self.project.area_type = geo_pb2.COUNTRY
        sentence = self._populate_template('Je cherche un emploi %inAreaType.')
        self.assertEqual('Je cherche un emploi dans le pays.', sentence)

    def test_region_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire region."""

        self.project.area_type = geo_pb2.REGION
        sentence = self._populate_template('Je cherche un emploi %inAreaType.')
        self.assertEqual('Je cherche un emploi en Auvergne-Rhône-Alpes.', sentence)

    def test_us_country_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire US state."""

        self.project.area_type = geo_pb2.COUNTRY
        self.scoring_project.user_profile.locale = 'en'
        sentence = self._populate_template("I'm looking for a job %inAreaType.")
        self.assertEqual("I'm looking for a job in the country.", sentence)

    def test_us_region_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire US state."""

        self.database.regions.insert_one({
            '_id': 'CA',
            'name': 'California',
        })
        self.project.area_type = geo_pb2.REGION
        self.project.city.region_id = 'CA'
        self.scoring_project.user_profile.locale = 'en'
        sentence = self._populate_template("I'm looking for a job %inAreaType.")
        self.assertEqual("I'm looking for a job in California.", sentence)

    def test_us_departement_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire US county."""

        self.database.departements.insert_one({
            '_id': '42003',
            'name': 'Allegheny County',
            'prefix': 'in ',
        })
        self.project.area_type = geo_pb2.DEPARTEMENT
        self.project.city.departement_id = '42003'
        self.scoring_project.user_profile.locale = 'en'
        sentence = self._populate_template("I'm looking for a job %inAreaType.")
        self.assertEqual("I'm looking for a job in Allegheny County.", sentence)

    def test_departement_search_area(self) -> None:
        """Give the area type when user is willing to search in the entire departement."""

        self.database.departements.insert_one({
            '_id': '75',
            'prefix': 'en ',
            'name': 'Ile-de-France',
        })
        self.project.city.departement_id = '75'
        self.project.area_type = geo_pb2.DEPARTEMENT
        sentence = self._populate_template('Je cherche un emploi %inAreaType.')
        self.assertEqual('Je cherche un emploi en Ile-de-France.', sentence)

    def test_city_search_area(self) -> None:
        """Give the area type when user is not willing to search outside the city."""

        self.project.area_type = geo_pb2.CITY
        self.project.city.name = 'Paris'
        sentence = self._populate_template('Je cherche un emploi %inAreaType.')
        self.assertEqual('Je cherche un emploi à Paris.', sentence)

    def test_application_mode(self) -> None:
        """Give the best application_mode for a given job."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'FAP1': {'modes': [
                {
                    'percentage': 50,
                    'mode': 'SPONTANEOUS_APPLICATION',
                },
                {
                    'percentage': 25,
                    'mode': 'PLACEMENT_AGENCY',
                },
            ]}},
        })
        self.project.target_job.job_group.rome_id = 'A1234'
        sentence = self._populate_template(
            'Les gens retrouvent un emploi grâce à %anApplicationMode.')
        self.assertEqual(
            sentence, 'Les gens retrouvent un emploi grâce à une candidature spontanée.')

    def test_application_mode_en(self) -> None:
        """Give the translated best application_mode for a given job."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'FAP1': {'modes': [
                {
                    'percentage': 50,
                    'mode': 'SPONTANEOUS_APPLICATION',
                },
                {
                    'percentage': 25,
                    'mode': 'PLACEMENT_AGENCY',
                },
            ]}},
        })
        self.project.target_job.job_group.rome_id = 'A1234'
        self.scoring_project.user_profile.locale = 'en'
        sentence = self._populate_template(
            'People find a job thanks to %anApplicationMode.')
        self.assertEqual(
            sentence, 'People find a job thanks to a spontaneous application.')

    def test_missing_application_mode(self) -> None:
        """Give network as the best application_mode for a job without the information."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'applicationModes': {'FAP1': {'modes': []}},
        })
        self.project.target_job.job_group.rome_id = 'A1234'
        sentence = self._populate_template(
            'Les gens retrouvent un emploi grâce à %anApplicationMode.')
        self.assertEqual(
            sentence,
            'Les gens retrouvent un emploi grâce à leur réseau personnel ou professionnel.')

    def test_required_diploma(self) -> None:
        """Give the diploma required for a given job."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [{'name': 'Bac pro'}],
            },
        })
        self.project.target_job.job_group.rome_id = 'A1234'
        self.assertEqual(
            'Mon travail nécessite un Bac pro ou équivalent',
            self._populate_template('Mon travail nécessite %aRequiredDiploma'))

    def test_required_diplomas(self) -> None:
        """Give the diplomas required for a given job."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {
                'diplomas': [
                    {'name': 'DUT'},
                    {'name': 'Bac pro'},
                ],
            },
        })
        self.project.target_job.job_group.rome_id = 'A1234'
        self.assertEqual(
            'Mon travail nécessite un Bac pro, DUT ou équivalent',
            self._populate_template('Mon travail nécessite %aRequiredDiploma'))

    @mock.patch('logging.warning')
    def test_no_required_diplomas(self, mock_warning: mock.MagicMock) -> None:
        """Handle as gracefully as possible when there are no required diplomas."""

        self.database.job_group_info.insert_one({
            '_id': 'A1234',
            'requirements': {'diplomas': []},
        })
        self.assertEqual(
            'Mon travail nécessite un diplôme',
            self._populate_template('Mon travail nécessite %aRequiredDiploma'))
        mock_warning.assert_called_once()

    def test_ids(self) -> None:
        """Gives IDs for user's market in a URL."""

        self.project.target_job.code_ogr = '10435'
        self.assertEqual(
            'https://emploi.gouv.fr?ogr=10435&city=69123&region=84',
            self._populate_template(
                'https://emploi.gouv.fr?ogr=%jobId&city=%cityId&region=%regionId'))

    def test_language_fr(self) -> None:
        """Gives the language for a person with French profile."""

        self.scoring_project.user_profile.ClearField('locale')
        self.assertEqual(
            'https://www.bob-emploi.fr?hl=fr',
            self._populate_template('https://www.bob-emploi.fr?hl=%language'))

    def test_language_tutoie(self) -> None:
        """Gives the language for a person with French tutoiement profile."""

        self.scoring_project.user_profile.locale = 'fr@tu'
        self.assertEqual(
            'https://www.bob-emploi.fr?hl=fr',
            self._populate_template('https://www.bob-emploi.fr?hl=%language'))

    def test_language_en(self) -> None:
        """Gives the language for a person with English profile."""

        self.scoring_project.user_profile.locale = 'en'
        self.assertEqual(
            'https://www.bob-emploi.fr?hl=en',
            self._populate_template('https://www.bob-emploi.fr?hl=%language'))

    def test_gender(self) -> None:
        """Gives the gender."""

        self.scoring_project.user_profile.gender = user_pb2.FEMININE
        self.assertEqual(
            'https://www.bob-emploi.fr/orientation?gender=FEMININE',
            self._populate_template('https://www.bob-emploi.fr/orientation?gender=%gender'))


class TemplateVariablesTest(unittest.TestCase):
    """Meta tests for template variables."""

    ALL_VARIABLES = set(
        scoring.scoring_base._TEMPLATE_VARIABLES)  # pylint: disable=protected-access

    def test_percent_template(self) -> None:
        """All templates should follow the template pattern."""

        for variable in self.ALL_VARIABLES:
            self.assertTrue(scoring.TEMPLATE_VAR_PATTERN.match(variable), msg=variable)

    def test_no_prefix(self) -> None:
        """A variable cannot be a case-insensitive prefix of another one."""

        for variable, other in itertools.combinations(
                sorted(self.ALL_VARIABLES, key=len), 2):
            self.assertFalse(
                other.lower().startswith(variable.lower()),
                msg=f'Template variable "{variable}" is a prefix of "{other}".')


if __name__ == '__main__':
    unittest.main()
