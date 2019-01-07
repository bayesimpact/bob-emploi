"""A tool to check the status of our imports to the DB.

Background information: http://go/pe:import-status

The third, and optional, parameter is to get details on a certain collection.

Run it with:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/import_status.py \
        mongodb://frontend-db/test [collection_name]
"""

import argparse
import collections
import datetime
import logging
from os import path
import subprocess
import typing

from google.protobuf import message
import pymongo
import termcolor

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import diagnostic_pb2
from bob_emploi.frontend.api import driving_license_pb2
from bob_emploi.frontend.api import discovery_pb2
from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import export_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import helper_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import network_pb2
from bob_emploi.frontend.api import online_salon_pb2
from bob_emploi.frontend.api import reorient_jobbing_pb2
from bob_emploi.frontend.api import review_pb2
from bob_emploi.frontend.api import seasonal_jobbing_pb2
from bob_emploi.frontend.api import skill_pb2
from bob_emploi.frontend.api import testimonial_pb2
from bob_emploi.frontend.api import use_case_pb2
from bob_emploi.frontend.api import user_pb2

_ROME_VERSION = 'v337'


class Importer(typing.NamedTuple):
    """Description of an importer."""

    name: str
    script: typing.Optional[str]
    args: typing.Optional[typing.Dict[str, str]]
    is_imported: bool
    proto_type: typing.Optional[typing.Type[message.Message]]
    key: str
    # PII means Personally Identifiable Information, i.e. a name, an email.
    has_pii: bool

    def __str__(self) -> str:
        if not self.proto_type:
            return self.name
        return '{} ({})'.format(self.name, self.proto_type.__name__)


CollectionsDiff = collections.namedtuple(
    'CollectionsDiff', ['collection_missing', 'importer_missing', 'imported'])

NOW = datetime.datetime.now().strftime('%Y-%m-%d')

IMPORTERS = {
    'similar_jobs': Importer(
        name='ROME Mobility',
        script='rome_mobility',
        args={'rome_csv_pattern': 'data/rome/csv/unix_{{}}_{}_utf8.csv'''.format(_ROME_VERSION)},
        is_imported=True,
        proto_type=discovery_pb2.JobsExploration,
        key='job group ID',
        has_pii=False),
    'recent_job_offers': Importer(
        name='Available Job Offers',
        script='recent_job_offers_count',
        args=None,
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>',
        has_pii=False),
    'helper': Importer(
        name='Mayday App User', script=None, args=None, is_imported=False,
        proto_type=helper_pb2.Helper, key='user_id', has_pii=True),
    'job_group_info': Importer(
        name='Job Group Info',
        script='job_group_info',
        args={
            'rome_csv_pattern': 'data/rome/csv/unix_{{}}_{}_utf8.csv'''.format(_ROME_VERSION),
            'job_requirements_json': 'data/job_offers/job_offers_requirements.json',
            'job_application_complexity_json': 'data/job_application_complexity.json',
            'application_mode_csv': 'data/imt/application_modes.csv',
            'rome_fap_crosswalk_txt': 'data/crosswalks/passage_fap2009_romev3.txt',
            'handcrafted_assets_airtable': 'appMRMtWV61Kibt37:advice:viwJ1OsSqK8YTSoIq',
            'domains_airtable': 'appMRMtWV61Kibt37:domains',
            'info_by_prefix_airtable': 'appMRMtWV61Kibt37:info_by_prefix',
            'fap_growth_2012_2022_csv': 'data/france-strategie/evolution-emploi.csv',
            'imt_market_score_csv': 'data/imt/market_score.csv',
        },
        is_imported=True,
        proto_type=job_pb2.JobGroup,
        key='job group ID',
        has_pii=False),
    'local_diagnosis': Importer(
        name='Local Diagnosis',
        script='local_diagnosis',
        args={
            'bmo_csv': 'data/bmo/bmo_2018.csv',
            'fap_rome_crosswalk': 'data/crosswalks/passage_fap2009_romev3.txt',
            'pcs_rome_crosswalk': 'data/crosswalks/passage_pcs_romev3.csv',
            'salaries_csv': 'data/fhs_salaries.csv',
            'unemployment_duration_csv': 'data/fhs_category_a_duration.csv',
            'job_offers_changes_json': 'data/job_offers/job_offers_changes.json',
            'imt_folder': 'data/imt',
            'mobility_csv':
                'data/rome/csv/unix_rubrique_mobilite_{}_utf8.csv'.format(_ROME_VERSION),
        },
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>',
        has_pii=False),
    'use_case': Importer(
        name='Use Case', script=None, args=None, is_imported=False, proto_type=use_case_pb2.UseCase,
        key='use_case_id', has_pii=False),
    'user': Importer(
        name='App User', script=None, args=None, is_imported=False,
        proto_type=user_pb2.User, key='user_id', has_pii=True),
    'user_auth': Importer(
        name='App User Auth Data', script=None, args=None, is_imported=False,
        proto_type=user_pb2.UserAuth, key='user_id', has_pii=True),
    # TODO(cyrille): Drop this importer, we don't use dashboard exports anymore.
    'dashboard_exports': Importer(
        name='Dashboard Export', script=None, args=None, is_imported=False,
        proto_type=export_pb2.DashboardExport, key='dashboard_export_id', has_pii=False),
    'feedbacks': Importer(
        name='Feedbacks', script=None, args=None, is_imported=False,
        proto_type=feedback_pb2.Feedback, key='Mongo key', has_pii=False),
    'cities': Importer(
        name='City locations',
        script='city_locations',
        args={
            'stats_filename': 'data/geo/french_cities.csv',
            'urban_context_filename': 'data/geo/french_urban_areas.xls',
        },
        is_imported=True,
        proto_type=geo_pb2.FrenchCity,
        key='Code officiel géographique',
        has_pii=False),
    'advice_modules': Importer(
        name='Advice modules',
        script='airtable_to_protos',
        args={
            'table': 'advice_modules',
            'view': 'viwGHHyK2Tc7sNxwv',
            'proto': 'AdviceModule',
            'base_id': 'appXmyc7yYj0pOcae',
        },
        is_imported=True,
        proto_type=advisor_pb2.AdviceModule,
        key='AirTable key',
        has_pii=False),
    'tip_templates': Importer(
        name='Tip templates',
        script='airtable_to_protos',
        args={
            'table': 'tip_templates',
            'proto': 'ActionTemplate',
            'base_id': 'appXmyc7yYj0pOcae',
            'view': 'viwPgjqZAa7GcpkU2',
        },
        is_imported=True,
        proto_type=action_pb2.ActionTemplate,
        key='AirTable key',
        has_pii=False),
    'show_unverified_data_users': Importer(
        name='Show unverified data Users',
        script='show_unverified_data_users',
        args={
            'base_id': 'appvjPDlByLmGbjaE',
            'table': 'whitelist',
        },
        is_imported=True,
        proto_type=None,
        key='User Email',
        has_pii=True),
    'jobboards': Importer(
        name='Job Boards',
        script='airtable_to_protos',
        args={
            'table': 'jobboards',
            'view': 'viwKBgHagnOhGkGoj',
            'proto': 'JobBoard',
            'base_id': 'appXmyc7yYj0pOcae',
        },
        is_imported=True,
        proto_type=jobboard_pb2.JobBoard,
        key='Airtable key',
        has_pii=False),
    'associations': Importer(
        name='Associations',
        script='airtable_to_protos',
        args={
            'table': 'association_list',
            'base_id': 'appXmyc7yYj0pOcae',
            'view': 'viw8d0QdKj4LT3UEp',
            'proto': 'Association',
        },
        is_imported=True,
        proto_type=association_pb2.Association,
        key='Airtable key',
        has_pii=False),
    'volunteering_missions': Importer(
        name='Volunteering Missions',
        script='volunteering_missions',
        args=None,
        is_imported=True,
        proto_type=association_pb2.VolunteeringMissions,
        key='departement ID',
        has_pii=False),
    'hiring_cities': Importer(
        name='Hiring Cities',
        script='offers_per_city',
        args={
            'offers_file': 'data/job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_17JANV2017_FGU.csv',
            'colnames': 'data/job_offers/column_names.txt',
            'min_creation_date': '2015/01/01',
        },
        is_imported=True,
        proto_type=commute_pb2.HiringCities,
        key='ROME ID',
        has_pii=False),
    'application_tips': Importer(
        name='Appliction Tips',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'application_tips',
            'proto': 'ApplicationTip',
        },
        is_imported=True,
        proto_type=application_pb2.ApplicationTip,
        key='Airtable key',
        has_pii=False),
    'eterritoire_links': Importer(
        name='e-Territoire Links',
        script='eterritoire',
        args=None,
        is_imported=True,
        proto_type=None,
        key='Code officiel géographique',
        has_pii=False),
    'events': Importer(
        name='WorkUp Events',
        script='workup_events',
        args={
            'events_json': 'data/workup.json',
            'departement_bounds_csv': 'data/geo/france_departements_bounds.csv',
        },
        is_imported=True,
        proto_type=event_pb2.Event,
        key='WorkUp ID',
        has_pii=False),
    'adie_events': Importer(
        name='ADIE Events',
        script='adie_events',
        args={'events_html': 'data/adie-evenements.html'},
        is_imported=True,
        proto_type=event_pb2.Event,
        key='ADIE ID',
        has_pii=False),
    'specific_to_job_advice': Importer(
        name='Specific to Job Advice',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'specific_to_job_advice',
            'view': 'viwtskoVJykFxo6R6',
            'proto': 'DynamicAdvice',
        },
        is_imported=True,
        proto_type=advisor_pb2.DynamicAdvice,
        key='Airtable key',
        has_pii=False),
    'seasonal_jobbing': Importer(
        name='Top Places for Seasonal Jobs Per Month',
        script='seasonal_jobbing',
        args={'offer_types_csv': 'data/job_offers/seasonal_offers_2015_2017.csv'},
        is_imported=True,
        proto_type=seasonal_jobbing_pb2.MonthlySeasonalJobbingStats,
        key='Month as number from 1',
        has_pii=False),
    'contact_lead': Importer(
        name='Contact lead to expand or use your network',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'contact_lead',
            'view': 'viwaSa8CoXHHqpTtn',
            'proto': 'ContactLead',
        },
        is_imported=True,
        proto_type=network_pb2.ContactLeadTemplate,
        key='Airtable key',
        has_pii=False),
    'departements': Importer(
        name='Basic information for French départements and territoires',
        script='departements',
        args={
            'french_departements_tsv': 'data/geo/insee_france_departements.tsv',
            'french_oversea_departements_tsv': 'data/geo/insee_france_oversee_collectivities.tsv',
        },
        is_imported=True,
        proto_type=geo_pb2.Departement,
        key='Departement ID',
        has_pii=False),
    'diagnostic_sentences': Importer(
        name='Templates of sentences to build a Diagnostic',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'diagnostic_sentences',
            'view': 'viwE0wLvOp3oHyyyd',
            'proto': 'DiagnosticSentenceTemplate',
        },
        is_imported=True,
        proto_type=diagnostic_pb2.DiagnosticTemplate,
        key='Airtable key',
        has_pii=False),
    'diagnostic_overall': Importer(
        name='Possiblities of diagnostic overall score and sentences.',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'diagnostic_overall',
            'view': 'viwZzhAx5mFbPWX1m',
            'proto': 'DiagnosticTemplate',
        },
        is_imported=True,
        proto_type=diagnostic_pb2.DiagnosticTemplate,
        key='Airtable key',
        has_pii=False),
    'diagnostic_observations': Importer(
        name='Templates of observations for a given diagnostic submtric.',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'diagnostic_observations',
            'view': 'viwOuKXBD3NP1FHqe',
            'proto': 'DiagnosticObservation',
        },
        is_imported=True,
        proto_type=diagnostic_pb2.DiagnosticTemplate,
        key='Airtable key',
        has_pii=False),
    # TODO(cyrille): Rename once the one below is hard-coded.
    'diagnostic_submetrics_sentences_new': Importer(
        name='Templates of sentences for a Diagnostic submetric',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'diagnostic_submetric_sentences_new',
            'view': 'viwNgJMaZpm8TibUy',
            'proto': 'DiagnosticSubmetricSentenceTemplate',
        },
        is_imported=True,
        proto_type=diagnostic_pb2.DiagnosticTemplate,
        key='Airtable key',
        has_pii=False),
    'diagnostic_submetrics_scorers': Importer(
        name='Scorers to compute a Diagnostic submetric score',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'diagnostic_submetrics_scorers',
            'view': 'viwoe6r6IqlMeRQLU',
            'proto': 'DiagnosticSubmetricScorer',
        },
        is_imported=True,
        proto_type=diagnostic_pb2.DiagnosticSubmetricScorer,
        key='Airtable key',
        has_pii=False),
    'regions': Importer(
        name='Basic information for French régions',
        script='regions',
        args={
            'french_regions_tsv': 'data/geo/insee_france_regions.tsv',
            'prefix_tsv': 'data/geo/region_prefix.tsv',
        },
        is_imported=True,
        proto_type=geo_pb2.Region,
        key='Region ID',
        has_pii=False),
    'reorient_jobbing': Importer(
        name='Reorient to jobbing positions',
        script='reorient_jobbing',
        args={
            'market_score_csv': 'data/imt/market_score.csv',
            'offers_csv': 'data/job_offers/reorient_jobbing_offers_2015_2017.csv',
            'rome_item_arborescence':
                'data/rome/csv/unix_item_arborescence_{}_utf8.csv'.format(_ROME_VERSION),
            'referentiel_code_rome_csv':
                'data/rome/csv/unix_referentiel_code_rome_{}_utf8.csv'.format(_ROME_VERSION),
            'referentiel_apellation_rome_csv':
                'data/rome/csv/unix_referentiel_appellation_{}_utf8.csv'.format(_ROME_VERSION),
        },
        is_imported=True,
        proto_type=reorient_jobbing_pb2.LocalJobbingStats,
        key='Departement ID',
        has_pii=False),
    'translations': Importer(
        name='Strings translations',
        script='translations',
        args={
            'base_id': 'appkEc8N0Bw4Uok43',
            'table': 'tblQL7A5EgRJWhQFo',
            'view': 'viwLyQNlJtyD4l45k',
        },
        is_imported=True,
        proto_type=None,
        key='Airtable key',
        has_pii=False),
    'local_missions': Importer(
        name='Civic service missions',
        script='civic_service',
        args={
            'civic_service_missions_csv': 'data/civic_service_missions_{}.csv'.format(NOW),
        },
        is_imported=True,
        proto_type=None,
        key='Airtable key',
        has_pii=False),
    'banks_one_euro_driving_license': Importer(
        name='Partner banks of the "1 euro" driving license program',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'driving_license_euro_banks',
            'view': 'viwNl2LUpVWZsezZZ',
            'proto': 'OneEuroProgramPartnerBank',
        },
        is_imported=True,
        proto_type=driving_license_pb2.OneEuroProgramPartnerBank,
        key='Airtable key',
        has_pii=False),
    'schools_one_euro_driving_license': Importer(
        name='Partner schools of the "1 euro" driving license program',
        script='airtable_to_protos',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'driving_license_euro_schools',
            'view': 'viwrpA4IUgCXup8Pb',
            'proto': 'DrivingSchool',
        },
        is_imported=True,
        proto_type=driving_license_pb2.DrivingSchool,
        key='Airtable key',
        has_pii=False),
    'adie_testimonials': Importer(
        name='Adie entrepreneurs testimonials',
        script='airtable_to_protos',
        args={
            'table': 'entrepreneur_testimonials',
            'proto': 'Testimonial',
            'base_id': 'appXmyc7yYj0pOcae',
            'view': 'viw7KWiq3c33COzHp',
        },
        is_imported=True,
        proto_type=testimonial_pb2.Testimonial,
        key='Airtable key',
        has_pii=False),
    'cvs_and_cover_letters': Importer(
        name='CVs & Cover Letters to review',
        script='document_to_review',
        args={
            'table': 'Job seekers',
            'view': 'Ready to Import',
            'base_id': 'app6I08170BlnyxnI',
        },
        is_imported=True,
        proto_type=review_pb2.DocumentToReview,
        key='Unique mongo ID',
        has_pii=True),
    'online_salons': Importer(
        name='Online salons',
        script='online_salons',
        args={'events_file_name': 'data/pole_emploi/online-salons-{}.json'.format(NOW)},
        is_imported=True,
        proto_type=online_salon_pb2.OnlineSalon,
        key='Unique mongo ID',
        has_pii=False),
    'volunteer': Importer(
        name='Volunteer for future Bayes Campaigns', script=None, args=None, is_imported=False,
        # TODO(cyrille): Use other proto type if we use it sometime. For now, we just populate
        # the 'email' field.
        proto_type=helper_pb2.Helper, key='user_id', has_pii=True),
    'skills_for_future': Importer(
        name='Skills for Future',
        script='skills_for_future',
        args={
            'base_id': 'appXmyc7yYj0pOcae',
            'table': 'skills_for_future',
            'view': 'viwfJ3L3qKPMVV2wp',
        },
        is_imported=True, proto_type=skill_pb2.JobSkills, key='ROME prefix', has_pii=False),
}


_MAINTENANCE_COLLECTIONS = {'meta', 'system.indexes', 'objectlabs-system'}


def is_personal_database(collection_names: typing.Set[str]) -> bool:
    """Determines if this is a database with PII collections or not."""

    imported = collection_names & IMPORTERS.keys()
    # We consider a DB to be personal if at least 2 collections are personal,
    # that way we can detect when a personal collection landed wrongly in a
    # non-personal database.
    return sum(1 for name in imported if IMPORTERS[name].has_pii) > 1


def compute_collections_diff(
        importers: typing.Dict[str, Importer], db_client: pymongo.MongoClient) -> CollectionsDiff:
    """Determine which collections have been imported and which are missing."""

    collection_names = {
        name for name in db_client.list_collection_names() if name not in _MAINTENANCE_COLLECTIONS
    }
    is_personal = is_personal_database(collection_names)
    personal_safe_importers = {
        key: importer for key, importer in importers.items()
        if importer.has_pii == is_personal
    }

    importers_to_import = {
        key for key, importer in personal_safe_importers.items() if importer.is_imported
    }
    return CollectionsDiff(
        collection_missing=importers_to_import - collection_names,
        importer_missing=collection_names - personal_safe_importers.keys(),
        imported=collection_names & personal_safe_importers.keys(),
    )


def get_meta_info(db_client: pymongo.MongoClient) -> typing.Dict[str, typing.Dict[str, typing.Any]]:
    """Get meta information for a specific collection."""

    meta_collection = db_client.meta.find()
    return {meta['_id']: meta for meta in meta_collection}


def _plural(count: int) -> str:
    return ' is' if count == 1 else 's are'


def _bold(value: typing.Any) -> str:
    return termcolor.colored(str(value), 'white', attrs=['bold'])


def print_single_importer(
        importer: typing.Optional[Importer], collection_name: str, mongo_url: str) -> None:
    """Show detailed information for a single importer."""

    logging.info('')
    if not importer:
        logging.info(
            'Collection details - unknown collection (%s)',
            termcolor.colored(collection_name, 'red'))
        return
    if not importer.is_imported:
        logging.info('No import needed for %s', termcolor.colored(collection_name, 'green'))
        return
    args = collections.OrderedDict(importer.args or {})
    args['mongo_url'] = mongo_url
    args['mongo_collection'] = collection_name
    command = ' \\\n    '.join(
        [
            'docker-compose run --rm data-analysis-prepare',
            'python bob_emploi/data_analysis/importer/{}.py'.format(importer.script),
        ] + ['--{} "{}"'.format(key, value) for key, value in args.items()]
    ) + '\n'

    logging.info(
        'To import "%s" in "%s", run:\n%s',
        importer.name, collection_name, command)


def _run_importer(collection_name: str, mongo_url: str) -> None:
    importer = IMPORTERS[collection_name]

    args = collections.OrderedDict(importer.args or {})
    args['mongo_url'] = mongo_url
    args['mongo_collection'] = collection_name
    logging.info('Running…')
    subprocess.run(
        ['python', path.join(path.dirname(__file__), '{}.py'.format(importer.script))] +
        [arg for key, value in args.items() for arg in ('--{}'.format(key), value)])


def main(string_args: typing.Optional[typing.List[str]] = None) -> None:
    """Print a report on which collections have been imported."""

    parser = argparse.ArgumentParser(
        description='Print a report on which collections have been imported')
    parser.add_argument(
        'mongo_url', help='Mongo URL of the database to check on, e.g. mongodb://frontend-db/test')
    parser.add_argument(
        'collection_name', help='Name of the collection to specifically display', nargs='?')
    parser.add_argument(
        '--run', action='append', help='Run the command to import the collection specified')
    args = parser.parse_args(string_args)

    db_client = pymongo.MongoClient(args.mongo_url).get_default_database()
    diff = compute_collections_diff(IMPORTERS, db_client)

    n_collections_missing = len(diff.collection_missing)
    logging.info(
        '%s collection%s not imported yet:',
        _bold(n_collections_missing), _plural(n_collections_missing))
    if diff.collection_missing:
        logging.info(
            'The missing collection%s: %s\n',
            _plural(n_collections_missing),
            termcolor.colored(diff.collection_missing, 'red'))
        for missing_collection in diff.collection_missing:
            importer = IMPORTERS[missing_collection]
            print_single_importer(importer, missing_collection, args.mongo_url)

    n_importers_missing = len(diff.importer_missing)
    logging.info(
        '%s collection%s without importers:',
        _bold(n_importers_missing), _plural(n_importers_missing))
    if diff.importer_missing:
        logging.info(
            'The collection%s with missing importer%s: %s\n',
            's' if n_importers_missing > 1 else '',
            _plural(n_importers_missing),
            termcolor.colored(str(diff.importer_missing), 'red'))

    logging.info(
        'Status report on imported collections (%d):',
        len(diff.imported))
    meta_info = get_meta_info(db_client)
    for collection_name in sorted(diff.imported):
        importer = IMPORTERS[collection_name]
        if not importer.is_imported:
            status = termcolor.colored('No import needed', 'green')
        elif collection_name in meta_info:
            status = termcolor.colored(
                'last import: {}'.format(meta_info[collection_name]['updated_at']),
                'green')
        else:
            status = termcolor.colored('Metainformation missing', 'red')
        logging.info(
            '\t%s - %s - %s',
            _bold(collection_name),
            str(importer),
            status)

    if args.collection_name:
        print_single_importer(
            IMPORTERS.get(args.collection_name), args.collection_name, args.mongo_url)
    for collection_name in (args.run or []):
        print_single_importer(
            IMPORTERS.get(collection_name), collection_name, args.mongo_url)
        _run_importer(collection_name, args.mongo_url)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
