# encoding: utf-8
"""Tests for the server.populate_template function."""
import unittest

from bob_emploi.frontend import server
from bob_emploi.frontend.api import project_pb2


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

    def test_pole_emploi(self):
        """Test Pôle emploi basic URL."""
        self.project.target_job.job_group.rome_id = 'A1234'
        self.project.mobility.city.departement_id = '45'

        link = server.populate_template(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=%romeId&codeZoneGeographique=%departementId&'
            'typeZoneGeographique=DEPARTEMENT',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?'
            'codeRome=A1234&codeZoneGeographique=45&typeZoneGeographique=DEPARTEMENT',
            link)

    def test_le_bon_coin(self):
        """Test LeBonCoin basic URL."""
        self.project.target_job.masculine_name = 'Boucher'
        self.project.mobility.city.name = 'Toulouse'

        link = server.populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Boucher&location=Toulouse&parrot=0 ',
            link)

    def test_le_bon_coin_spaces(self):
        """Test LeBonCoin URLs when job and city names contain white spaces."""
        self.project.target_job.masculine_name = 'Data scientist'
        self.project.mobility.city.name = 'Le Havre'

        link = server.populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Data%20scientist&location=Le%20Havre&parrot=0 ',
            link)

    def test_le_bon_coin_special_chars(self):
        """Test LeBonCoin URLs when job and city names contain special chars."""
        self.project.target_job.masculine_name = 'Employé de ménage'
        self.project.mobility.city.name = 'Orléans-cœur'

        link = server.populate_template(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=%latin1MasculineJobName&location=%latin1CityName&parrot=0 ',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'https://www.leboncoin.fr/offres_d_emploi/offres/ile_de_france/occasions/'
            '?th=1&q=Employ%E9%20de%20m%E9nage&location=Orl%E9ans-c%3Fur&parrot=0 ',
            link)

    def test_la_bonne_boite(self):
        """Test LaBonneBoite basic URL."""
        self.project.target_job.job_group.name = 'Boucherie'
        self.project.mobility.city.name = 'Toulouse'
        self.project.mobility.city.departement_id = '31'

        link = server.populate_template(
            'http://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'http://labonneboite.pole-emploi.fr/entreprises/Toulouse-31000/'
            'boucherie?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_dom(self):
        """Test LaBonneBoite URL when city is in a DOM and does not have a postcode."""
        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.mobility.city.name = 'Saint-Denis'
        self.project.mobility.city.departement_id = '974'
        self.project.mobility.city.postcodes = ''

        link = server.populate_template(
            'http://labonneboite.pole-emploi.fr/entreprises/%cityName-%postcode/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'http://labonneboite.pole-emploi.fr/entreprises/Saint-Denis-97400/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_spaces(self):
        """Test LaBonneBoite URL when city and job group names contain spaces."""
        self.project.target_job.job_group.name = 'Assistanat de direction'
        self.project.mobility.city.name = 'Le Havre'
        self.project.mobility.city.departement_id = '76'

        link = server.populate_template(
            'http://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'http://labonneboite.pole-emploi.fr/entreprises/Le%20Havre-76000/'
            'assistanat-de-direction?sort=distance&d=10&h=1',
            link)

    def test_la_bonne_boite_special_chars(self):
        """Test LaBonneBoite URL when city and job group names contain special chars."""
        self.project.target_job.job_group.name = (
            "Recherche en sciences de l'homme et de la société")
        self.project.mobility.city.name = 'Orléans'
        self.project.mobility.city.departement_id = '42'

        link = server.populate_template(
            'http://labonneboite.pole-emploi.fr/entreprises/%cityName-%departementId000/'
            '%jobGroupNameUrl?sort=distance&d=10&h=1',
            self.project.mobility.city,
            self.project.target_job)
        self.assertEqual(
            'http://labonneboite.pole-emploi.fr/entreprises/Orl%C3%A9ans-42000/'
            'recherche-en-sciences-de-l-homme-et-de-la-societe?sort=distance&d=10&h=1',
            link)


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
