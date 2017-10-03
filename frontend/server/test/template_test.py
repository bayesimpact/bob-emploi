# encoding: utf-8
"""Tests for the self._populate_template function."""
import unittest

import mock
import mongomock

from bob_emploi.frontend import scoring
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2


class PopulateProjectTemplateTest(unittest.TestCase):
    """All unit tests for populate_template."""

    def setUp(self):
        super(PopulateProjectTemplateTest, self).setUp()
        # Pre-populate project's fields that are usualldy set. Individual tests
        # should not count on those values.
        self.project = project_pb2.Project()
        self.project.target_job.name = 'Boulanger / Boulangère'
        self.project.target_job.masculine_name = 'Boulanger'
        self.project.target_job.feminine_name = 'Boulangère'
        self.project.target_job.job_group.rome_id = 'Z9007'
        self.project.mobility.city.city_id = '69123'
        self.project.mobility.city.departement_id = '69'
        self.project.mobility.city.postcodes = '69001-69002-69003-69004'
        self.project.mobility.city.name = 'Lyon'
        self.database = mongomock.MongoClient().test
        self.scoring_project = scoring.ScoringProject(
            self.project, user_pb2.UserProfile(), user_pb2.Features(), self.database)

    def _populate_template(self, template):
        return self.scoring_project.populate_template(template)

    def test_pole_emploi(self):
        """Test Pôle emploi basic URL."""
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.mobility.city.departement_id = '45'

        link = self._populate_template(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=%romeId&codeZoneGeographique=%departementId&'
            'typeZoneGeographique=DEPARTEMENT')
        self.assertEqual(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=A1234&codeZoneGeographique=45&typeZoneGeographique=DEPARTEMENT',
            link)

    def test_le_bon_coin(self):
        """Test LeBonCoin basic URL."""
        self.project.target_job.masculine_name = 'Boucher'
        self.project.mobility.city.name = 'Toulouse'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Boucher&location=Toulouse&parrot=0 ',
            link)

    def test_le_bon_coin_spaces(self):
        """Test LeBonCoin URLs when job and city names contain white spaces."""
        self.project.target_job.masculine_name = 'Data scientist'
        self.project.mobility.city.name = 'Le Havre'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Data%20scientist&location=Le%20Havre&parrot=0 ',
            link)

    def test_le_bon_coin_special_chars(self):
        """Test LeBonCoin URLs when job and city names contain special chars."""
        self.project.target_job.masculine_name = 'Employé de ménage'
        self.project.mobility.city.name = 'Orléans-cœur'

        link = self._populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ')
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Employ%E9%20de%20m%E9nage&location=Orl%E9ans-c%3Fur&parrot=0 ',
            link)

    def test_la_bonne_boite(self):
        """Test LaBonneBoite basic URL."""
        self.project.target_job.job_group.name = 'Boucherie'
        self.project.mobility.city.name = 'Toulouse'
        self.project.mobility.city.departement_id = '31'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Toulouse-31000/'
            'boucherie?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_dom(self):
        """Test LaBonneBoite URL when city is in a DOM and does not have a postcode."""
        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.mobility.city.name = 'Saint-Denis'
        self.project.mobility.city.departement_id = '974'
        self.project.mobility.city.postcodes = ''

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%postcode/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Saint-Denis-97400/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_spaces(self):
        """Test LaBonneBoite URL when city and job group names contain spaces."""
        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.mobility.city.name = 'Le Havre'
        self.project.mobility.city.departement_id = '76'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Le%20Havre-76000/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_special_chars(self):
        """Test LaBonneBoite URL when city and job group names contain special chars."""
        self.project.target_job.job_group.name = (
            "Recherche en sciences de l'homme et de la société")
        self.project.mobility.city.name = 'Orléans'
        self.project.mobility.city.departement_id = '42'

        link = self._populate_template(
            'https://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1')
        self.assertEqual(
            'https://labonneboite.pole-emploi.fr/entreprises/Orl%C3%A9ans-42000/'
            'recherche-en-sciences-de-l-homme-et-de-la-societe?sort=distance&d=10&h=1',
            link)

    def test_mayor_advice(self):
        """All required vars for the contact your mayor advice."""
        self.project.mobility.city.name = 'Le Mans'
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

    def test_situation_presentation(self):
        """Present a jobseeker's situation."""
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR

        sentence = self._populate_template(
            'Je suis %jobName à 5% depuis %experienceDuration.')
        self.assertEqual('Je suis steward à 5% depuis plus de 6 ans.', sentence)

    @mock.patch(scoring.logging.__name__ + '.warning')
    def test_missing_variables(self, mock_warning):
        """ Template still has some variable not replaced."""
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.project.seniority = project_pb2.SENIOR
        sentence = self._populate_template('Je suis %jobName en %random.')

        mock_warning.assert_called_once()
        self.assertEqual(
            'One or more template variables have not been replaced in:\n%s',
            mock_warning.call_args_list[0][0][0])
        self.assertEqual('Je suis steward en %random.', mock_warning.call_args_list[0][0][1])

        self.assertEqual('Je suis steward en %random.', sentence)

    def test_job_presentation(self):
        """Present a job name."""
        self.project.target_job.masculine_name = 'Steward'
        self.project.target_job.feminine_name = 'Hôtesse'
        self.scoring_project.user_profile.gender = user_pb2.FEMININE

        sentence = self._populate_template('Je suis %aJobName')
        self.assertEqual('Je suis une hôtesse', sentence)

    def test_in_domain_network_advice(self):
        """Var required for a network advice in a specific job group domain."""
        self.database.job_group_info.insert_one(
            {
                '_id': 'Z9007',
                'inDomain': 'en boulangerie',
            })
        self.project.target_job.job_group.rome_id = 'Z9007'

        sentence = self._populate_template('Contactez vos connaissances qui travaillent %inDomain')
        self.assertEqual('Contactez vos connaissances qui travaillent en boulangerie', sentence)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
