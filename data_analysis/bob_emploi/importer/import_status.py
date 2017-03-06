# encoding: utf-8
"""A tool to check the status of our imports to the DB.

Background information: http://go/pe:import-status

The third, and optional, parameter is to get details on a certain collection.

Run it with:
    docker-compose run --rm data-analysis-prepare
        python bob_emploi/importer/import_status.py mongodb://frontend-db/test [collection_name]
"""
import collections
import logging
import sys
import termcolor

import pymongo

from bob_emploi.frontend.api import action_pb2
from bob_emploi.frontend.api import advisor_pb2
from bob_emploi.frontend.api import chantier_pb2
from bob_emploi.frontend.api import discovery_pb2
from bob_emploi.frontend.api import export_pb2
from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.api import user_pb2


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
    'fhs_local_diagnosis': Importer(
        name="FHS local diagnosis",
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/fhs_local_diagnosis.py \\
            --durations_csv data/fhs_category_a_duration_motann.csv \\
            --mongo_url "%(mongo_url)s""
        """,
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key="<geo>:<job group ID>, geo being one of city_id, 'd' + département_id, "
        "'r' + region_id, '' (for France), 'ghost-d' + département_id, "
        "'ghost-r' + region_id or 'ghost' (for ghost town France-wide)"),
    'similar_jobs': Importer(
        name='ROME Mobility',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/rome_mobility.py \\
            --rome_csv_pattern data/rome/csv/unix_%%s_v330_utf8.csv \\
            --mongo_url "%(mongo_url)s""
        """,
        is_imported=True,
        proto_type=discovery_pb2.JobsExploration,
        key='job group ID'),
    'recent_job_offers': Importer(
        name='Available Job Offers',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/recent_job_offers_count.py \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>'),
    'action_templates': Importer(
        name='Action Templates',
        command="""docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table action_templates \\
            --proto ActionTemplate \\
            --mongo_collection action_templates \\
            --base_id appXmyc7yYj0pOcae \\
            --view viweTj15LzsyrvNqu \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=action_pb2.ActionTemplate,
        key='action_template_id'),
    'sticky_action_steps': Importer(
        name='Sticky Action Steps',
        command="""docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table sticky_action_steps \\
            --proto StickyActionStep \\
            --mongo_collection sticky_action_steps \\
            --base_id appXmyc7yYj0pOcae \\
            --view viwwNQKWfiaS10Zf2 \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=action_pb2.StickyActionStep,
        key='step_id'),
    'chantiers': Importer(
        name='Chantiers',
        command="""docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table chantiers \\
            --proto Chantier \\
            --mongo_collection chantiers \\
            --base_id appXmyc7yYj0pOcae \\
            --view viwbjlYBDlD1Fd7Ob \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=chantier_pb2.Chantier,
        key='chantier_id'),
    'job_group_info': Importer(
        name='Job Group Info',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/job_group_info.py \\
            --rome_csv_pattern data/rome/csv/unix_%%s_v330_utf8.csv \\
AUTH_7b9ade05d5f84f719adc2cbc76c07eec/Cover%%%%20Images/%%s.jpg \\
            --job_requirements_json data/job_offers/job_offers_requirements.json \\
            --job_application_complexity_json data/job_application_complexity.json \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=job_pb2.JobGroup,
        key='job group ID'),
    'local_diagnosis': Importer(
        name='Local Diagnosis',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/local_diagnosis.py \\
            --bmo_csv data/bmo/bmo_2016.csv \\
            --fap_rome_crosswalk data/crosswalks/passage_fap2009_romev3.txt \\
            --salaries_csv data/fhs_salaries.csv \\
            --unemployment_duration_csv data/fhs_category_a_duration.csv \\
            --job_offers_changes_json data/job_offers/job_offers_changes.json \\
            --job_imt_json data/scraped_imt_local_job_stats.json \\
            --mobility_csv data/rome/csv/unix_rubrique_mobilite_v330_utf8.csv \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=job_pb2.LocalJobStats,
        key='<département ID>:<job group ID>'),
    'user': Importer(
        name='App User', command='', is_imported=False, proto_type=user_pb2.User, key='user_id'),
    'user_auth': Importer(
        name='App User Auth Data', command='', is_imported=False,
        proto_type=user_pb2.UserAuth, key='user_id'),
    'dashboard_exports': Importer(
        name='Dashboard Export', command='', is_imported=False,
        proto_type=export_pb2.DashboardExport, key='dashboard_export_id'),
    'unverified_data_zones': Importer(
        name='Unverified Data Zones',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/unverified_data_zones.py \\
            --data_folder data \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=user_pb2.UnverifiedDataZone,
        key='default'),
    'cities': Importer(
        name='City locations',
        command="""docker-compose run --rm data-analysis-prepare \\
            python bob_emploi/importer/city_locations.py \\
            --stats_filename data/geo/french_cities.csv \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=geo_pb2.FrenchCity,
        key='Code officiel géographique'),
    'advice_modules': Importer(
        name='Advice modules',
        command="""docker-compose run --rm -e AIRTABLE_API_KEY=$AIRTABLE_API_KEY \\
            data-analysis-prepare \\
            python bob_emploi/importer/airtable_to_protos.py \\
            --table advice_modules \\
            --proto AdviceModule \\
            --mongo_collection advice_modules \\
            --base_id appXmyc7yYj0pOcae \\
            --mongo_url "%(mongo_url)s"
        """,
        is_imported=True,
        proto_type=advisor_pb2.AdviceModule,
        key='AirTable key'),
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
        importer.name,
        collection_name,
        importer.command % {'mongo_url': mongo_url})


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
            if not importer.is_imported:
                continue
            logging.info(
                'To import %s, run:\n%s\n',
                importer.name,
                importer.command % {'mongo_url': mongo_url})

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
