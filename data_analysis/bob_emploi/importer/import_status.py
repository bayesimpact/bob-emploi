# encoding: utf-8
"""A tool to check the status of our imports to the DB.

Background information: http://go/pe:import-status

The third, and optional, parameter is to get details on a certain collection.

Run it with:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/importer/import_status.py mongodb://frontend-db/test [collection_name]
"""
import collections
import logging
import sys
import termcolor

import pymongo

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import application_pb2
from bob_emploi.frontend.api import association_pb2
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import discovery_pb2
from bob_emploi.frontend.api import event_pb2
from bob_emploi.frontend.api import export_pb2
from bob_emploi.frontend.api import feedback_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import commute_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import jobboard_pb2
from bob_emploi.frontend.api import use_case_pb2
from bob_emploi.frontend.api import user_pb2

_ROME_VERSION = 'v332'


class Importer(collections.namedtuple(
        'Importer', ['name', 'command', 'is_imported', 'proto_type', 'key'])):
    """Description of an importer."""

    def __str__(self):
        if not self.proto_type:
            return self.name
        return '%s (%s)' % (self.name, self.proto_type.__name__)


CollectionsDiff = collections.namedtuple(
    'CollectionsDiff', ['collection_missing', 'importer_missing', 'imported'])

IMPORTERS = {
    'similar_jobs': Importer(
        name='ROME Mobility',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/rome_mobility.py \\
            --rome_csv_pattern data/rome/csv/unix_%%s_%s_utf8.csv''' % _ROME_VERSION,
        is_imported=True,
        proto_type=discovery_pb2.JobsExploration,
        key='job group ID'),
    'recent_job_offers': Importer(
        name='Available Job Offers',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/recent_job_offers_count.py''',
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>'),
    'chantiers': Importer(
        name='Chantiers',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table chantiers \\
            --proto Chantier \\
            --base_id appXmyc7yYj0pOcae \\
            --view viwbjlYBDlD1Fd7Ob''',
        is_imported=True,
        proto_type=chantier_pb2.Chantier,
        key='chantier_id'),
    'job_group_info': Importer(
        name='Job Group Info',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/job_group_info.py \\
            --rome_csv_pattern data/rome/csv/unix_%%s_%s_utf8.csv \\
            --job_requirements_json data/job_offers/job_offers_requirements.json \\
            --job_application_complexity_json data/job_application_complexity.json \\
            --application_mode_csv data/imt/application_modes.csv \\
            --handcrafted_assets_airtable appMRMtWV61Kibt37:advice:viwJ1OsSqK8YTSoIq \\
            --domains_airtable appMRMtWV61Kibt37:domains''' % _ROME_VERSION,
        is_imported=True,
        proto_type=job_pb2.JobGroup,
        key='job group ID'),
    'local_diagnosis': Importer(
        name='Local Diagnosis',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/local_diagnosis.py \\
            --bmo_csv data/bmo/bmo_2016.csv \\
            --fap_rome_crosswalk data/crosswalks/passage_fap2009_romev3.txt \\
            --salaries_csv data/fhs_salaries.csv \\
            --unemployment_duration_csv data/fhs_category_a_duration.csv \\
            --job_offers_changes_json data/job_offers/job_offers_changes.json \\
            --job_imt_json data/scraped_imt_local_job_stats.json \\
            --mobility_csv data/rome/csv/unix_rubrique_mobilite_%s_utf8.csv''' % _ROME_VERSION,
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>'),
    'use_case': Importer(
        name='Use Case', command='', is_imported=False, proto_type=use_case_pb2.UseCase,
        key='use_case_id'),
    'user': Importer(
        name='App User', command='', is_imported=False, proto_type=user_pb2.User, key='user_id'),
    'user_auth': Importer(
        name='App User Auth Data', command='', is_imported=False,
        proto_type=user_pb2.UserAuth, key='user_id'),
    'dashboard_exports': Importer(
        name='Dashboard Export', command='', is_imported=False,
        proto_type=export_pb2.DashboardExport, key='dashboard_export_id'),
    'feedbacks': Importer(
        name='Feedbacks', command='', is_imported=False,
        proto_type=feedback_pb2.Feedback, key='Mongo key'),
    'unverified_data_zones': Importer(
        name='Unverified Data Zones',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/unverified_data_zones.py \\
            --data_folder data''',
        is_imported=True,
        proto_type=user_pb2.UnverifiedDataZone,
        key='default'),
    'cities': Importer(
        name='City locations',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/city_locations.py \\
            --stats_filename data/geo/french_cities.csv''',
        is_imported=True,
        proto_type=geo_pb2.FrenchCity,
        key='Code officiel géographique'),
    'advice_modules': Importer(
        name='Advice modules',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table advice_modules \\
            --view viwGHHyK2Tc7sNxwv \\
            --proto AdviceModule \\
            --base_id appXmyc7yYj0pOcae''',
        is_imported=True,
        proto_type=advisor_pb2.AdviceModule,
        key='AirTable key'),
    'tip_templates': Importer(
        name='Tip templates',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table tip_templates \\
            --proto ActionTemplate \\
            --base_id appXmyc7yYj0pOcae \\
            --view viwPgjqZAa7GcpkU2''',
        is_imported=True,
        proto_type=action_pb2.ActionTemplate,
        key='AirTable key'),
    'show_unverified_data_users': Importer(
        name='Show unverified data Users',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/show_unverified_data_users.py \\
            --base_id appvjPDlByLmGbjaE \\
            --table whitelist''',
        is_imported=True,
        proto_type=None,
        key='User Email'),
    'jobboards': Importer(
        name='Job Boards',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table jobboards \\
            --view viwKBgHagnOhGkGoj \\
            --proto JobBoard \\
            --base_id appXmyc7yYj0pOcae''',
        is_imported=True,
        proto_type=jobboard_pb2.JobBoard,
        key='Airtable key'),
    'associations': Importer(
        name='Associations',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table association_list \\
            --proto Association \\
            --view viw8d0QdKj4LT3UEp \\
            --base_id appXmyc7yYj0pOcae''',
        is_imported=True,
        proto_type=association_pb2.Association,
        key='Airtable key'),
    'volunteering_missions': Importer(
        name='Volunteering Missions',
        command='''docker-compose run --rm \\
            data-analysis-prepare \\
            python bob_emploi/importer/volunteering_missions.py''',
        is_imported=True,
        proto_type=association_pb2.VolunteeringMissions,
        key='departement ID'),
    'hiring_cities': Importer(
        name='Hiring Cities',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/offers_per_city.py \\
            --offers_file="data/job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_17JANV2017_FGU.csv" \\
            --colnames="data/job_offers/column_names.txt" \\
            --min_creation_date=2015/01/01''',
        is_imported=True,
        proto_type=commute_pb2.HiringCities,
        key='ROME ID'),
    'application_tips': Importer(
        name='Appliction Tips',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --base_id appXmyc7yYj0pOcae \\
            --table application_tips \\
            --proto ApplicationTip''',
        is_imported=True,
        proto_type=application_pb2.ApplicationTip,
        key='Airtable key'),
    'eterritoire_links': Importer(
        name='e-Territoire Links',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/eterritoire.py''',
        is_imported=True,
        proto_type=None,
        key='Code officiel géographique'),
    'events': Importer(
        name='WorkUp Events',
        command='''docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/workup_events.py \\
            --events_json data/workup.json \\
            --departement_bounds_csv data/geo/france_departements_bounds.csv''',
        is_imported=True,
        proto_type=event_pb2.Event,
        key='WorkUp ID'),
    'specific_to_job_advice': Importer(
        name='Specific to Job Advice',
        command='''docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --base_id appXmyc7yYj0pOcae \\
            --table specific_to_job_advice \\
            --view viwtskoVJykFxo6R6 \\
            --proto DynamicAdvice''',
        is_imported=True,
        proto_type=advisor_pb2.DynamicAdvice,
        key='Airtable key'),
}


def compute_collections_diff(importers, db_client):
    """Determine which collections have been imported and which are missing."""
    collection_names = [name for name in db_client.collection_names()
                        if name not in ['meta', 'system.indexes']]
    importers_to_import = set([
        key for key, importer in importers.items()
        if importer.is_imported])
    return CollectionsDiff(
        collection_missing=importers_to_import - set(collection_names),
        importer_missing=collection_names - importers.keys(),
        imported=collection_names & importers.keys()
    )


def get_meta_info(db_client):
    """Get meta information for a specific collection."""
    meta_collection = db_client.meta.find()
    return {meta['_id']: meta for meta in meta_collection}


def _plural(count):
    return ' is' if count == 1 else 's are'


def _bold(value):
    return termcolor.colored(str(value), 'white', attrs=['bold'])


def print_single_importer(importer, collection_name, mongo_url):
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
    logging.info(
        'To import "%s" in "%s", run:\n%s',
        importer.name, collection_name, importer.command +
        ' \\\n            --mongo_url "%s" --mongo_collection "%s"\n' % (
            mongo_url, collection_name))


def main(mongo_url, details_for_collection=None):
    """Print a report on which collections have been imported."""
    db_client = pymongo.MongoClient(mongo_url).get_default_database()
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
            print_single_importer(importer, missing_collection, mongo_url)

    n_importers_missing = len(diff.importer_missing)
    logging.info(
        '%s collection%s without importers:',
        _bold(n_importers_missing), _plural(n_importers_missing))
    if diff.importer_missing:
        logging.info(
            'The collections with missing importer%s: %s\n',
            _plural(n_importers_missing),
            termcolor.colored(str(diff.importer_missing), 'red'))

    logging.info(
        'Status report on imported collections (%d):',
        len(diff.imported))
    meta_info = get_meta_info(db_client)
    for collection_name in diff.imported:
        importer = IMPORTERS[collection_name]
        if not importer.is_imported:
            status = termcolor.colored('No import needed', 'green')
        elif collection_name in meta_info:
            status = termcolor.colored(
                'last import: %s' % meta_info[collection_name]['updated_at'],
                'green')
        else:
            status = termcolor.colored('Metainformation missing', 'red')
        logging.info(
            '\t%s - %s - %s',
            _bold(collection_name),
            str(importer),
            status)

    if details_for_collection:
        print_single_importer(
            IMPORTERS.get(details_for_collection), details_for_collection, mongo_url)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main(*sys.argv[1:])
