# encoding: utf-8
"""Unit tests for the bob_emploi.lib.cleaned_data module."""
from os import path
import unittest

from bob_emploi.lib import cleaned_data


class CleanedDataTestCase(unittest.TestCase):
    """Unit tests for each dataset."""

    def test_french_city_stats(self):
        """Test reading the french city stats."""
        test_data_folder = path.join(path.dirname(__file__), 'testdata')
        city_stats = cleaned_data.french_city_stats(test_data_folder)
        self.assertEqual(7, len(city_stats))
        # Spot check
        entries = [e for e in city_stats.itertuples()
                   if e.zipCode == '01190' and e.population == 618]
        self.assertEqual(1, len(entries))

    def test_rome_texts(self):
        """Check working environment and other texts are loaded correctly."""
        rome_texts = cleaned_data.rome_texts()

        self.assertEqual(
            ['definition', 'requirements', 'working_environment'],
            sorted(rome_texts.columns))
        self.assertTrue(rome_texts.index.is_unique)
        # Point checks.
        self.assertEqual(
            ("Réalise des travaux mécanisés agricoles, sylvicoles ou "
             "forestiers (préparation des sols, semis, récolte, abattage "
             "d'arbres, ...) selon les objectifs de production (quantité, "
             "qualité, ...), la commande du client, les règles d'hygiène, "
             "de sécurité et la réglementation environnementale."),
            rome_texts.loc['A1101', 'definition'])
        self.assertIn(
            'comptables et financières.\n\nPeut mettre',
            rome_texts.loc['M1201', 'definition'])

    def test_rome_fap_mapping(self):
        """Test the ROME -> FAP mapping table."""
        rome_fap_mapping = cleaned_data.rome_fap_mapping()
        self.assertEqual(['fap_codes'], rome_fap_mapping.columns)
        self.assertEqual(531, len(rome_fap_mapping))
        # Point checks.
        self.assertEqual({'A0Z42', 'G1Z70', 'H0Z91'}, rome_fap_mapping.fap_codes.A1204)
        self.assertEqual({'A0Z42'}, rome_fap_mapping.fap_codes.A1205)

    def test_job_offers(self):
        """Test loading the job offers."""
        test_data_folder = path.join(path.dirname(__file__), 'testdata')
        job_offers = cleaned_data.job_offers(
            data_folder=test_data_folder,
            filename_offers='job_offers/job_offers.csv')
        self.assertEqual(5, len(job_offers))
        self.assertEqual('F1106', job_offers.ix[0].rome_profession_card_code)

    def test_holland_codes(self):
        """Test loading the holland codes."""
        holland_codes = cleaned_data.rome_holland_codes()
        self.assertEqual(['major', 'minor'], sorted(holland_codes.columns))
        self.assertTrue(holland_codes.index.is_unique)
        self.assertEqual(0, holland_codes.major.isnull().sum())
        self.assertEqual(0, holland_codes.minor.isnull().sum())
        # Point check.
        self.assertEqual('C', holland_codes.ix['A1204'].major)
        self.assertEqual('I', holland_codes.ix['A1204'].minor)

    def test_rome_to_skills(self):
        """Test loading rome_to_skills mapping."""
        rome_to_skills = cleaned_data.rome_to_skills()
        self.assertEqual(
            ['code_ogr', 'code_rome', 'skill_is_practical', 'skill_name'],
            sorted(rome_to_skills.columns))
        # Point check
        grouped = rome_to_skills.groupby('code_rome').code_ogr.apply(list)
        skill_ids = [
            '23012', '21467', '21746', '21264', '21271', '22235', '21994',
            '22840', '21151', '21800', '22669', '22713', '23241']
        self.assertEqual(set(skill_ids),
                         set(grouped.ix['E1103']))
        # Check for apostrophes
        name_22141 = (
            rome_to_skills[rome_to_skills.code_ogr == '22141'].
            skill_name.iloc[0])
        self.assertEqual("Méthodes d'enquête", name_22141)

    def test_rome_job_groups(self):
        """Check format of the rome_job_groups table."""
        rome_job_groups = cleaned_data.rome_job_groups()

        self.assertEqual(['name'], rome_job_groups.columns)
        self.assertTrue(rome_job_groups.index.is_unique)
        # Point check.
        self.assertEqual('Sylviculture', rome_job_groups.loc['A1205', 'name'])
        # Unicode.
        self.assertEqual(
            'Téléconseil et télévente', rome_job_groups.loc['D1408', 'name'])
        # Single quote.
        self.assertEqual(
            "Ecriture d'ouvrages, de livres",
            rome_job_groups.loc['E1102', 'name'])

    def test_rome_work_environments(self):
        """Check the rome_work_environments table."""
        rome_work_environments = cleaned_data.rome_work_environments()

        self.assertEqual(
            set(['name', 'code_rome', 'code_ogr', 'section']),
            set(rome_work_environments.columns))
        self.assertEqual(531, len(rome_work_environments.code_rome.unique()))
        self.assertEqual(
            set(['STRUCTURES', 'CONDITIONS', 'SECTEURS']),
            set(rome_work_environments.section.unique()))
        # Point checks.
        self.assertEqual(
            ['Armée', 'Boulangerie, pâtisserie industrielle'],
            sorted(rome_work_environments[
                (rome_work_environments.code_rome == 'D1102') &
                (rome_work_environments.section == 'SECTEURS')].name.tolist()))

    def test_rome_jobs(self):
        """Check format and values of the rome_jobs table."""
        rome_jobs = cleaned_data.rome_jobs()

        self.assertEqual(['code_rome', 'name'], sorted(rome_jobs.columns))
        self.assertTrue(rome_jobs.index.is_unique)
        # Point checks.
        self.assertEqual(
            'Afficheur / Afficheuse', rome_jobs.loc['10321', 'name'])
        self.assertEqual('J1506', rome_jobs.loc['38452', 'code_rome'])
        # Unicode.
        self.assertEqual(
            'Chargé / Chargée de voyages en entreprise',
            rome_jobs.loc['38399', 'name'])
        # Single quote.
        self.assertEqual(
            "Délégué / Déléguée de l'Assurance Maladie - DAM",
            rome_jobs.loc['38420', 'name'])

    def test_rome_job_groups_mobility(self):
        """Check format and values of the rome_job_groups_mobility table."""
        mobility = cleaned_data.rome_job_groups_mobility()

        self.assertEqual([
            'mobility_type',
            'source_rome_id', 'source_rome_name',
            'target_rome_id', 'target_rome_name',
        ], sorted(mobility.columns))
        self.assertFalse(mobility.duplicated(['source_rome_id', 'target_rome_id']).any())
        self.assertGreater(len(mobility), 3000)
        # Point checks.
        edge = mobility[
            (mobility.source_rome_id == 'A1101') &
            (mobility.target_rome_id == 'A1416')]
        self.assertTrue(len(edge))
        self.assertEqual('Near', edge.mobility_type.iloc[0])
        self.assertEqual("Conduite d'engins agricoles et forestiers", edge.source_rome_name.iloc[0])
        self.assertEqual('Polyculture, élevage', edge.target_rome_name.iloc[0])
        # Check that the default does not expand links between jobs.
        edge = mobility[
            (mobility.source_rome_id == 'N4402') &
            (mobility.target_rome_id == 'I1101')]
        self.assertFalse(len(edge))

    def test_french_departements(self):
        """Check format and values of the french_departements table."""
        french_departements = cleaned_data.french_departements()

        self.assertEqual(
            ['name', 'region_id'],
            sorted(str(c) for c in french_departements.columns))
        self.assertTrue(french_departements.index.is_unique)
        # Point checks.
        self.assertEqual('Rhône', french_departements.loc['69', 'name'])
        self.assertEqual('Mayotte', french_departements.loc['976', 'name'])
        self.assertEqual('Haute-Garonne', french_departements.loc['31', 'name'])
        self.assertEqual('84', french_departements.loc['69', 'region_id'])

    def test_french_regions(self):
        """Check format and values of the french_regions table."""
        french_regions = cleaned_data.french_regions()

        self.assertEqual(['name'], french_regions.columns)
        self.assertTrue(french_regions.index.is_unique)
        self.assertEqual(18, len(french_regions))
        # Point checks.
        self.assertEqual('Bretagne', french_regions.loc['53', 'name'])
        self.assertEqual(
            'Auvergne-Rhône-Alpes', french_regions.loc['84', 'name'])

    def test_french_cities(self):
        """Check format and values of the french_cities table."""
        french_cities = cleaned_data.french_cities()

        self.assertEqual(
            ['name', 'departement_id', 'region_id', 'current',
             'current_city_id', 'arrondissement'],
            [str(c) for c in french_cities.columns])

        redirections = french_cities[french_cities.current_city_id.notnull()]
        self.assertTrue(redirections[redirections.current].empty)
        self.assertLess(2000, len(redirections))
        self.assertLess(len(redirections), 4000)
        self.assertEqual('75056', redirections.loc['75103', 'current_city_id'])

        # Check arrondissements.
        self.assertEqual('Lyon 6e  Arrondissement', french_cities.loc['69386', 'name'])
        self.assertTrue(french_cities.loc['69386', 'arrondissement'])

        # Only current cities have a unique index.
        french_cities = french_cities[french_cities.current]
        self.assertTrue(french_cities.index.is_unique)
        self.assertLess(30000, len(french_cities))
        self.assertLess(len(french_cities), 40000)
        # Point checks.
        self.assertEqual('Toulouse', french_cities.loc['31555', 'name'])
        self.assertEqual('31', french_cities.loc['31555', 'departement_id'])
        self.assertEqual('84', french_cities.loc['69123', 'region_id'])
        self.assertEqual(True, french_cities.loc['69123', 'current'])
        # Check with a preceding article.
        self.assertEqual("L'Hôtellerie", french_cities.loc['14334', 'name'])
        # Check with a preceding article requiring a blank space.
        self.assertEqual('Le Mans', french_cities.loc['72181', 'name'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
