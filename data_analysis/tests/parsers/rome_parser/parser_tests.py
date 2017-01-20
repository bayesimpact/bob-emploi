# encoding: utf-8
"""Tests for the bob_emploi.parsers.rome_parser.rule_engine module."""
import unittest
from os import path

import pandas as pd

from bob_emploi.parsers.rome_parser import rule_engine


class ParserTestCase(unittest.TestCase):
    """Unit tests for apply_rules and specific rules."""

    in_file = path.join(
        path.dirname(__file__), 'testdata/job_requirements_input.csv')
    rules = rule_engine.get_rules()
    data = pd.read_csv(in_file, encoding='latin-1').requirements.tolist()

    def test_level_coverage(self):
        """Check that the parser works correctly.

        It only works on a fixed set of data. It is NOT a monitor that the
        parser works on live data.
        """
        parsed = rule_engine.run_rules(self.data)
        perc_with_level = parsed.level.count() / len(parsed) * 100
        self.assertGreater(perc_with_level, 60)
        print("level coverage: {}%".format(perc_with_level))

    def test_degree_rule(self):
        """Check that the degree rule works correctly."""
        example = (
            'Cet emploi/métier est accessible avec un CAP/BEP dans le secteur '
            'agricole (production agricole, agroéquipement, ...) ou forestier '
            '(travaux forestiers, ...).')
        res = self.rules['content']['degree1'].search(example)
        self.assertEqual('CAP/BEP', res.group(1))
        self.assertEqual(
            'secteur agricole (production agricole, agroéquipement, ...) ou '
            'forestier (travaux forestiers, ...)',

            res.group(2))

    def test_requirement(self):
        """Check that a basic degree requirement is parsed correctly."""
        example = (
            'Cet emploi/métier est accessible avec un CAP/BEP dans le secteur '
            'agricole (production agricole, agroéquipement, ...) ou forestier '
            '(travaux forestiers, ...).')
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['required'])
        self.assertTrue(parsed['degree'])
        self.assertEqual('CAP/BEP', parsed['level'])

    def test_prof_experience(self):
        """Check that a professionnal experience requirement is parsed."""
        example = (
            'Il est également accessible avec une expérience professionnelle '
            'dans le même secteur sans diplôme particulier.')
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['alternative'])
        self.assertTrue(parsed['experience'])
        # self.assertEqual(parsed['level'], u'expérience professionnelle')

    def test_bonus_certificate(self):
        """Check that a bonus for a certification is parsed."""
        example = (
            'Un Certificat de Spécialisation Agricole -CSA- tracteurs et '
            'machines agricoles (utilisation et maintenance) peut en faciliter '
            "l'accès.")
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['bonus'])
        self.assertTrue(parsed['certification'])
        self.assertEqual('Certificat', parsed['level'])

    def test_sometimes_degree(self):
        """Check that a soft requirement is parsed."""
        example = (
            'Un Bac ou un BTS peut être demandé selon la technicité des '
            'engins utilisés.')
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['sometimes'])
        self.assertTrue(parsed['degree'])
        self.assertEqual('Bac', parsed['level'])

    def test_driving_licence(self):
        """Check that a driving licence requirement is parsed."""
        example = (
            'Les permis C, C1, CE, C1E (précédemment C et EC) peuvent être '
            'requis.')
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['sometimes'])
        self.assertTrue(parsed['certification'])
        self.assertEqual('Les permis', parsed['level'])
        self.assertEqual(
            'C, C1, CE, C1E (précédemment C et EC)',
            parsed['subject'])

    def test_certificate_de(self):
        """Check that a custom certificate requirement is parsed."""
        example = (
            'Cet emploi/métier est accessible avec le Certificat de Capacité '
            "d'Orthophonie.")
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['certification'])
        self.assertTrue(parsed['required'])
        self.assertEqual('Certificat', parsed['level'])
        self.assertEqual("Capacité d'Orthophonie", parsed['subject'])

    def test_diplome_detat(self):
        """Check that a custom "state diploma" requirement is parsed."""
        example = (
            "Cet emploi/métier est accessible avec le diplôme d'Etat "
            "d'Ambulancier pour la conduite d'ambulance.")
        parsed = rule_engine.apply_rules(example)
        self.assertTrue(parsed['degree'])
        self.assertTrue(parsed['required'])
        self.assertEqual("Diplôme d'Etat d'Ambulancier", parsed['level'])
        self.assertEqual("conduite d'ambulance", parsed['subject'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
