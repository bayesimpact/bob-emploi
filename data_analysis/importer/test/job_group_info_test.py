"""Tests for the bob_emploi.importer.job_group_info module."""

from os import path
import textwrap
import unittest

import airtablemock

from bob_emploi.frontend.api import job_pb2
from bob_emploi.data_analysis.lib import mongo
from bob_emploi.data_analysis.importer import job_group_info


class JobGroupInfoImporterTestCase(unittest.TestCase):
    """Unit tests for the Job Group Info importer."""

    rome_csv_pattern = path.join(
        path.dirname(__file__), 'testdata/unix_{}_v327_utf8.csv')
    job_requirements_json = path.join(
        path.dirname(__file__), 'testdata/job_offers/job_requirements.json')
    job_application_complexity_json = path.join(
        path.dirname(__file__), 'testdata/job_application_complexity.json')
    application_mode_csv = path.join(
        path.dirname(__file__), 'testdata/application_modes.csv')
    rome_fap_crosswalk_txt = path.join(
        path.dirname(__file__), 'testdata/passage_fap2009_romev3.txt')
    fap_growth_2012_2022_csv = path.join(
        path.dirname(__file__), 'testdata/evolution-emplois.csv')
    imt_market_score_csv = path.join(
        path.dirname(__file__), 'testdata/imt/market_score.csv')

    def setUp(self) -> None:
        patcher = airtablemock.patch(job_group_info.__name__ + '.airtable')
        patcher.start()

        job_group_info.AIRTABLE_API_KEY = 'key01234567'

        advice_airtable = airtablemock.Airtable('app01234567', 'key01234567')
        advice_airtable.create('advice', {
            'code_rome': 'D1501',
            'SKILLS': '* Être créatif',
            'BONUS SKILLS': "* Avoir le sens de l'humour",
            'TRAINING': '* Maîtriser des logiciels',
            'other': 'foo',
        })

        rome_airtable = airtablemock.Airtable('app4242', 'key01234567')
        rome_airtable.create('domains', {
            'name': 'Commerce de gros',
            'domain_name': 'Commerce, négoce et distribution',
        })
        rome_airtable.create('domains', {
            'name': 'Commerce/grande distribution',
            'domain_name': 'Commerce, négoce et distribution',
        })
        rome_airtable.create('Rigid Diplomas', {
            'code_rome': 'D1501',
            'is_diploma_strictly_required': True,
        })
        rome_airtable.create('info_by_prefix', {
            'rome_prefix': 'D',
            'inDomain': 'dans le commerce ',
        })
        rome_airtable.create('info_by_prefix', {
            'rome_prefix': 'D15',
            'inDomain': 'dans la grande distribution',
            'preferredApplicationMedium': 'APPLY_BY_EMAIL',
            'hasFreelancers': True,
            'inAWorkplace': 'dans un supermarché',
            'likeYourWorkplace': 'comme le vôtre',
            'placePlural': 'des supermarchés',
            'whatILoveAbout': "j'adore vos allées",
            'toTheWorkplace': 'A la manufacture',
            'whySpecificCompany': 'vous aimez être au service des autres',
            'atVariousCompanies': 'à la MAIF, à la MATMUT',
            'whatILoveAboutFeminine': "j'adore vos allées",
        })
        self.addCleanup(patcher.stop)

    def test_make_dicts(self) -> None:
        """Test basic usage of the csv2dicts function."""

        collection = job_group_info.make_dicts(
            self.rome_csv_pattern,
            self.job_requirements_json,
            self.job_application_complexity_json,
            self.application_mode_csv,
            self.rome_fap_crosswalk_txt,
            'app01234567:advice:viw012345',
            'app4242:domains',
            'app4242:Rigid Diplomas',
            'app4242:info_by_prefix',
            self.fap_growth_2012_2022_csv,
            self.imt_market_score_csv)

        self.assertEqual(532, len(collection))
        for info in collection:
            self.assertEqual(info['_id'], info['romeId'])

        job_group_protos = dict(mongo.collection_to_proto_mapping(
            collection, job_pb2.JobGroup))

        # Point check.
        d1501 = job_group_protos['D1501']
        self.assertEqual('Animateur de vente', d1501.samples[0].masculine_name)
        self.assertEqual(1, len(d1501.jobs), d1501.jobs)
        self.assertEqual(
            ['Bac', 'Brevet'],
            [d.name for d in d1501.requirements.diplomas])
        self.assertEqual(
            ['Anglais courant'],
            [e.name for e in d1501.requirements.extras])
        self.assertEqual("* Avoir le sens de l'humour", d1501.requirements.bonus_skills_short_text)
        self.assertEqual('* Maîtriser des logiciels', d1501.requirements.trainings_short_text)
        self.assertEqual('E', d1501.holland_code_major)
        self.assertEqual('R', d1501.holland_code_minor)
        self.assertTrue(d1501.description.startswith(
            'Effectue la promotion et la vente de vêtements'))
        self.assertTrue(d1501.working_environment.startswith(
            "L'activité de cet emploi/métier s'exerce au sein de grandes"))
        self.assertIn('Le permis B peut être requis', d1501.requirements_text)
        self.assertEqual(
            ['Boutique, commerce de détail'],
            d1501.work_environment_keywords.structures)
        self.assertEqual(
            ['Commerce, négoce et distribution'],
            [d.name for d in d1501.work_environment_keywords.domains])
        self.assertEqual(
            ['Commerce de gros', 'Commerce/grande distribution'],
            sorted(d1501.work_environment_keywords.domains[0].sectors))
        self.assertEqual(
            job_pb2.SPONTANEOUS_APPLICATION,
            d1501.application_modes['R2Z83'].modes[0].mode)
        self.assertAlmostEqual(
            30.27,
            d1501.application_modes['R2Z83'].modes[0].percentage, places=5)
        self.assertEqual(
            job_pb2.OTHER_CHANNELS,
            d1501.application_modes['R2Z83'].modes[2].mode)
        self.assertEqual('dans la grande distribution', d1501.in_domain)
        self.assertEqual(job_pb2.APPLY_BY_EMAIL, d1501.preferred_application_medium)
        self.assertTrue(d1501.has_freelancers)
        self.assertEqual('dans un supermarché', d1501.in_a_workplace)
        self.assertEqual('comme le vôtre', d1501.like_your_workplace)
        self.assertEqual('des supermarchés', d1501.place_plural)
        self.assertEqual("j'adore vos allées", d1501.what_i_love_about)
        self.assertAlmostEqual(.1, d1501.growth_2012_2022, places=5)
        self.assertEqual('A la manufacture', d1501.to_the_workplace)
        self.assertEqual('vous aimez être au service des autres', d1501.why_specific_company)
        self.assertEqual('à la MAIF, à la MATMUT', d1501.at_various_companies)
        self.assertEqual("j'adore vos allées", d1501.what_i_love_about_feminine)
        self.assertEqual(4, len(d1501.best_departements))
        best_departement_scores = [
            d.local_stats.imt.yearly_avg_offers_per_10_candidates for d in d1501.best_departements]
        self.assertEqual(sorted(best_departement_scores, reverse=True), best_departement_scores)
        self.assertAlmostEqual(0.8, d1501.national_market_score)
        self.assertTrue(d1501.is_diploma_strictly_required)

        # Test default values.
        g1204 = job_group_protos['G1204']
        self.assertEqual('comme la vôtre', g1204.like_your_workplace)
        self.assertEqual('dans une entreprise', g1204.in_a_workplace)
        self.assertEqual('des entreprises', g1204.place_plural)
        self.assertAlmostEqual(0., g1204.growth_2012_2022, places=5)
        self.assertEqual("à l'entreprise", g1204.to_the_workplace)
        self.assertEqual('vous vous reconnaissez dans leurs valeurs', g1204.why_specific_company)
        self.assertFalse(g1204.is_diploma_strictly_required)

        # Test null growth.
        a1101 = job_group_protos['A1101']
        self.assertTrue(a1101.growth_2012_2022)

    def test_make_dicts_full(self) -> None:
        """Test basic usage of the csv2dicts function with all options."""

        advice_airtable = airtablemock.Airtable('app01234567', 'key01234567')
        advice_airtable.create('jobboards', {
            'title': 'CNT',
            'link': 'http://www.cnt.asso.fr/metiers_formations/offres_emplois_appels_projets.cfm',
            'for-job-group': 'L13',
        })
        advice_airtable.create('jobboards', {
            'title': 'Job Culture',
            'link': 'http://www.jobculture.fr/',
            'for-job-group': 'L',
        })
        advice_airtable.create('jobboards', {
            'title': 'Indeed',
            'link': 'https://www.indeed.com/',
        })
        advice_airtable.create('skills_for_future', {
            'name': 'Jugement et prise de décision',
            'description': 'long description',
            'rome_prefixes': 'D13, F12, H25, I11, N13, N42, C11, C12, C13, C14, C15, D11, D12, E11',
        })
        advice_airtable.create('specific_to_job', {
            'title': 'Présentez-vous au chef boulanger dès son arrivée tôt le matin',
            'expanded_card_items': textwrap.dedent('''\
                3 idées pour vous aider à réussir votre approche :
                * Se présenter aux boulangers entre 4h et 7h du matin.
                * Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.
                * Contacter les fournisseurs de farine locaux : ils connaissent tous'''),
            'card_text': '**Allez à la boulangerie la veille** pour savoir.',
            'short_title': 'Astuces de boulangers',
            'diagnostic_topics': ['JOB_SEARCH_DIAGNOSTIC'],
            'for-job-group': 'D1102',
        })

        collection = job_group_info.make_dicts(
            self.rome_csv_pattern,
            self.job_requirements_json,
            self.job_application_complexity_json,
            self.application_mode_csv,
            self.rome_fap_crosswalk_txt,
            'app01234567:advice:viw012345',
            'app4242:domains',
            'app4242:Rigid Diplomas',
            'app4242:info_by_prefix',
            self.fap_growth_2012_2022_csv,
            self.imt_market_score_csv,
            jobboards_airtable='app01234567:jobboards',
            skills_for_future_airtable='app01234567:skills_for_future',
            specific_to_job_airtable='app01234567:specific_to_job')

        job_group_protos = dict(mongo.collection_to_proto_mapping(collection, job_pb2.JobGroup))

        self.assertEqual(
            {'CNT', 'Job Culture'},
            {j.title for j in job_group_protos['L1301'].job_boards})
        self.assertEqual(
            {'Job Culture'},
            {j.title for j in job_group_protos['L1101'].job_boards})
        self.assertFalse(job_group_protos['K1802'].job_boards)

        self.assertEqual(
            ['Jugement et prise de décision'],
            [s.name for s in job_group_protos['D1301'].skills_for_future])
        self.assertFalse(job_group_protos['K1802'].skills_for_future)

        self.assertEqual(
            ['Astuces de boulangers'],
            [s.short_title for s in job_group_protos['D1102'].specific_advice])
        self.assertFalse(job_group_protos['K1802'].specific_advice)


if __name__ == '__main__':
    unittest.main()
