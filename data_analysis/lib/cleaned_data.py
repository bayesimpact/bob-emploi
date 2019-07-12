"""Module to access to datasets already cleaned up.

You should not use this for notebooks that are trying to understand a dataset,
but on the opposite once you've done this notebook you should add some code
here so that all other code can just access it. This code should be very much
tied to the data below it and shouldn't try to cope with errors in the data if
we have checked there are none (e.g. don't remove duplicates if we've checked
that lines are unique).

The format of all the function in this module should always be the same: a
function representing a table, taking as an optional argument the base data
folder and another optional argument (overriding the first one) the exact file
to import from. Each function should return a pandas DataFrame with cleaned
values and column names. The documentation of the function should currently be
the documentation of the returned DataFrame. See the rome_job_group as a good
example.
"""

import codecs
import collections
from os import path
import re
import typing

import pandas
from scrapy import selector

_ROME_VERSION = 'v339'

# Denominator to compute Market Score because the number of yearly average
# offers are given for 10 candidates.
_YEARLY_AVG_OFFERS_DENOMINATOR = 10


# TODO: Use this function in city suggest importer to read the stats file.
def french_city_stats(data_folder: str = 'data', filename_city_stats: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """Read the french city stats."""

    if not filename_city_stats:
        filename_city_stats = path.join(data_folder, 'geo/french_cities.csv')
    return pandas.read_csv(
        filename_city_stats,
        sep=',', header=None, usecols=[1, 8, 10, 14, 19, 20],
        names=['departement_id', 'zipCode', 'city_id', 'population', 'longitude', 'latitude'],
        dtype={
            'departement_id': str,
            'zipCode': str,
            'city_id': str,
            'population': int,
            'latitude': float,
            'longitude': float,
        }).set_index('city_id', drop=False)


def job_offers(
        data_folder: str = 'data', filename_offers: typing.Optional[str] = None,
        filename_colnames: typing.Optional[str] = None) -> pandas.DataFrame:
    """Read the job offers dataset we got from Pole Emploi.

    More info about the structure of this dataset can be found
    in the notebook job_offers/pe_historical_offers.ipynb
    """

    default_offers_path = 'job_offers/OFFRE_EXTRACT_ENRICHIE_FGU_18JANV2016.csv'
    filename_offers = path.join(
        data_folder, filename_offers or default_offers_path)
    filename_colnames = path.join(
        data_folder, filename_colnames or 'job_offers/column_names.txt')

    with open(filename_colnames) as lines:
        column_names = [line.strip() for line in lines.readlines()]
    dtypes = {}
    dtypes[column_names.index('city_code')] = str
    dtypes[column_names.index('departement_code')] = str
    dtypes[column_names.index('region_code')] = str
    offers = pandas.read_csv(
        filename_offers,
        encoding='latin-1',
        delimiter='|',    # The file is *pipe separated*, not *comma separated*
        escapechar='\\',  # It also contains escaped *pipe separated* strings.
        header=None,
        names=column_names,
        dtype=dtypes)
    # Convert to datetime
    offers['creation_date'] =\
        pandas.to_datetime(offers['creation_date'])
    offers['date_debut_validite_offre'] =\
        pandas.to_datetime(offers['date_debut_validite_offre'])
    offers['rome_id'] = offers.rome_profession_card_code
    # Remove undesirable spaces
    offers['rome_name'] = offers['rome_profession_card_name'].str.strip()
    offers['annual_maximum_salary'] = pandas.to_numeric(
        offers.annual_maximum_salary, errors='coerce')
    offers['annual_minimum_salary'] = pandas.to_numeric(
        offers.annual_minimum_salary, errors='coerce')
    # We use `availibility_date` when available and impute `creation_date`
    # when missing.
    offers['date_debut_imputed'] = offers['date_debut_validite_offre']
    offers.loc[offers.date_debut_imputed.isnull(),
               'date_debut_imputed'] = offers['creation_date']
    # `experience_min_duration` is sometimes expressed in Months or in Year :
    # Let's convert everything into month.
    annual_expe_condition = (offers.exp_duration_type_code == 'AN')
    offers.loc[annual_expe_condition, 'experience_min_duration'] =\
        offers.loc[annual_expe_condition, 'experience_min_duration'] * 12
    offers.loc[annual_expe_condition, 'exp_duration_type_code'] = 'MO'
    return offers


def rome_to_skills(
        data_folder: str = 'data', filename_items: typing.Optional[str] = None,
        filename_skills: typing.Optional[str] = None) -> pandas.DataFrame:
    """Load a dictionary that maps rome ID to a list of skill IDs.

    The 'coherence' table contains a general mapping from rome ID to items
    associated with this rome ID. Joining with the skills table will leave only
    the skill related associations.
    """

    if not filename_items:
        filename_items = path.join(
            data_folder, f'rome/csv/unix_coherence_item_{_ROME_VERSION}_utf8.csv')
    if not filename_skills:
        filename_skills = path.join(
            data_folder, f'rome/csv/unix_referentiel_competence_{_ROME_VERSION}_utf8.csv')
    rome_to_item = pandas.read_csv(filename_items, dtype=str)
    skills = pandas.read_csv(filename_skills, dtype=str)
    merged = pandas.merge(rome_to_item, skills, on='code_ogr')
    merged['skill_name'] = merged.libelle_competence.str.replace("''", "'")\
        .apply(maybe_add_accents)
    merged['skill_is_practical'] = merged.code_type_competence == '2'
    return merged[['code_rome', 'code_ogr', 'skill_name', 'skill_is_practical']]


def rome_job_groups(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """A list of all job groups in ROME with their names.

    The only column is "name" and the index is the ROME code. Each row
    represents a job group clustering multiple professions.
    """

    if not filename:
        filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_code_rome_{_ROME_VERSION}_utf8.csv')

    job_groups = pandas.read_csv(filename)

    # Fix names that contain double '.
    job_groups['name'] = job_groups['libelle_rome'].str.replace("''", "'")\
        .apply(maybe_add_accents)

    job_groups.set_index('code_rome', inplace=True)

    return job_groups[['name']]


def rome_holland_codes(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """A list of all job groups in ROME with their Holland Codes.

    The only columns are the "major" and the "minor" Holland Code and the index
    is the ROME code. Each row represents a job group clustering multiple
    professions.
    """

    if not filename:
        filename = f'rome/csv/unix_referentiel_code_rome_riasec_{_ROME_VERSION}_utf8.csv'
        filename = path.join(data_folder, filename)

    column_names = ['code_rome', 'major', 'minor']
    holland_codes = pandas.read_csv(filename, names=column_names)
    holland_codes.major.fillna('', inplace=True)
    holland_codes.minor.fillna('', inplace=True)
    return holland_codes.set_index('code_rome')


def rome_texts(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """A list of all job groups in ROME with some lengthy text definitions.

    The columns are "definition", "requirements" and "working_environment".
    Each row represents a job group clustering multiple professions.
    """

    if not filename:
        filename = path.join(data_folder, f'rome/csv/unix_texte_{_ROME_VERSION}_utf8.csv')

    texts = pandas.read_csv(filename).pivot_table(
        index='code_rome',
        columns='libelle_type_texte',
        values='libelle_texte',
        aggfunc=lambda x: '\n\n'.join(x).replace("''", "'"))
    return texts.rename(columns={
        'acces_a_em': 'requirements',
        'cond_exercice_activite': 'working_environment',
    })


def rome_work_environments(
        data_folder: str = 'data', links_filename: typing.Optional[str] = None,
        ref_filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """A list of all work environment of job groups in ROME.

    The columns are "code_rome", "code_ogr" (a unique ID for a work environment
    item), "name", "section" (one of STRUCTURES, CONDITIONS and SECTEURS).
    """

    if not links_filename:
        links_filename = path.join(
            data_folder, f'rome/csv/unix_liens_rome_referentiels_{_ROME_VERSION}_utf8.csv')
    if not ref_filename:
        ref_filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_env_travail_{_ROME_VERSION}_utf8.csv')

    links = pandas.read_csv(links_filename)
    ref = pandas.read_csv(ref_filename)
    environments = pandas.merge(links, ref, on='code_ogr', how='inner')
    environments['name'] = environments.libelle_env_travail.str.replace("''", "'")\
        .apply(maybe_add_accents)
    return environments.rename(columns={
        'libelle_type_section_env_trav': 'section',
    })[['name', 'code_ogr', 'code_rome', 'section']]


def rome_jobs(data_folder: str = 'data', filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """A list of all jobs in ROME with their names and their groups.

    The columns are "name" and "code_rome" and the index is the OGR code. Each
    row represents a profession.
    """

    if not filename:
        filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_appellation_{_ROME_VERSION}_utf8.csv')

    jobs = pandas.read_csv(filename, dtype=str)

    # Fix names that contain double '.
    jobs['name'] = jobs['libelle_appellation_court'].str.replace("''", "'")\
        .apply(maybe_add_accents)

    jobs.set_index('code_ogr', inplace=True)

    return jobs[['name', 'code_rome']]


def rome_job_groups_mobility(
        data_folder: str = 'data', filename: typing.Optional[str] = None,
        expand_jobs: bool = False) -> pandas.DataFrame:
    """A list of oriented edges in the ROME mobility graph.

    The expand_jobs parameter defines what to do with edges going from or to
    jobs directly instead of job groups: if True, the function expands the edge
    to concern the whole job groups even if only one job was specified ; if
    False, the function ignores such edges.

    The columns are "source_rome_id", "source_name", "target_rome_id",
    "target_name", "mobility_type".
    """

    if not filename:
        filename = path.join(
            data_folder, f'rome/csv/unix_rubrique_mobilite_{_ROME_VERSION}_utf8.csv')

    mobility = pandas.read_csv(filename, dtype=str)
    mobility.rename(columns={
        'code_rome': 'source_rome_id',
        'code_rome_cible': 'target_rome_id',
    }, inplace=True)

    # Expand or ignore job edges.
    if expand_jobs:
        mobility = mobility.drop_duplicates(subset=['source_rome_id', 'target_rome_id'])
    else:
        mobility = mobility[
            mobility.code_appellation_source.isnull() & mobility.code_appellation_cible.isnull()]

    # Add names.
    rome_job_group_names = rome_job_groups(data_folder=data_folder).name
    mobility['source_rome_name'] = mobility.source_rome_id.map(rome_job_group_names)
    mobility['target_rome_name'] = mobility.target_rome_id.map(rome_job_group_names)

    # Translate mobility type.
    mobility['mobility_type'] = mobility.libelle_type_mobilite.map({
        'Proche': 'CLOSE',
        'Evolution': 'EVOLUTION',
    })

    return mobility[[
        'source_rome_id',
        'source_rome_name',
        'target_rome_id',
        'target_rome_name',
        'mobility_type',
    ]]


def rome_fap_mapping(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """Mapping from ROME ID to FAP codes.

    The index are the ROME IDs and the only column "fap_codes" is a list of
    corresponding FAP codes.
    """

    if not filename:
        filename = path.join(data_folder, 'crosswalks/passage_fap2009_romev3.txt')
    with codecs.open(filename, 'r', 'latin-1') as fap_file:
        mapping: typing.Dict[str, typing.Set[str]] = collections.defaultdict(set)
        for line in fap_file:
            matches = re.search(r'"(.*?)"+\s+=\s+"(.*?)"', line)
            if not matches:
                continue
            qualified_romes = matches.groups()[0]
            fap = matches.groups()[1]
            for qualified_rome in qualified_romes.replace('"', '').split(','):
                rome_id = qualified_rome[:5]
                mapping[rome_id].add(fap)
    return pandas.Series(mapping, name='fap_codes').to_frame()


def naf_subclasses(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """NAF Sub classes.

    The index are the IDs of the sub classes (e.g. "0111Z"), and the only
    column is "name".
    """

    if not filename:
        filename = path.join(data_folder, 'naf-2008.xls')
    naf_2008 = pandas.read_excel(filename)
    naf_2008 = naf_2008.iloc[2:, :]
    naf_2008.columns = ['code', 'name']
    naf_2008['code'] = naf_2008.code.str.replace('.', '')
    return naf_2008.set_index('code')


def french_departements(
        data_folder: str = 'data', filename: typing.Optional[str] = None,
        oversea_filename: typing.Optional[str] = None,
        prefix_filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """French départements.

    The index are the IDs of the départements, and the columns are "name",
    "region_id" and "prefix".
    """

    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_departements.tsv')
    if not oversea_filename:
        oversea_filename = path.join(data_folder, 'geo/insee_france_oversee_collectivities.tsv')
    if not prefix_filename:
        prefix_filename = path.join(data_folder, 'geo/departement_prefix.tsv')
    departements = pandas.concat([
        pandas.read_csv(filename, sep='\t', dtype=str),
        pandas.read_csv(oversea_filename, sep='\t', dtype=str)])
    prefixes = pandas.read_csv(prefix_filename, sep='\t', dtype=str).set_index('DEP')
    departements.rename(
        columns={
            'REGION': 'region_id',
            'DEP': 'departement_id',
            'NCCENR': 'name',
        },
        inplace=True)
    departements.set_index('departement_id', inplace=True)
    departements['prefix'] = prefixes.PREFIX
    departements.prefix.fillna('', inplace=True)
    return departements[['name', 'region_id', 'prefix']]


def french_regions(
        data_folder: str = 'data', filename: typing.Optional[str] = None,
        prefix_filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """French régions (on January 1st, 2017).

    The index are the IDs of the régions, and the column are "name" and "prefix".
    """

    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_regions.tsv')
    if not prefix_filename:
        prefix_filename = path.join(data_folder, 'geo/region_prefix.tsv')
    regions = pandas.read_csv(filename, sep='\t', dtype=str)
    regions.rename(
        columns={'REGION': 'region_id', 'NCCENR': 'name'}, inplace=True)
    prefixes = pandas.read_csv(prefix_filename, sep='\t', dtype=str).set_index('REGION')
    regions.set_index('region_id', inplace=True)
    regions['prefix'] = prefixes.PREFIX
    regions.prefix.fillna('', inplace=True)
    return regions[['name', 'prefix']]


def french_cities(
        data_folder: str = 'data', filename: typing.Optional[str] = None,
        unique: bool = False) -> pandas.DataFrame:
    """French cities (all the ones that have existed until January 1st, 2016).

    The index are the IDs (Code Officiel Géographique) of the cities, and the
    columns are "name", "departement_id", "region_id", "current" (whether the
    city is still a city on 2016-01-01) and "current_city_id" (for cities that
    have been merged, the ID of the merged city).
    """

    if not filename:
        filename = path.join(data_folder, 'geo/insee_france_cities.tsv')
    cities = pandas.read_csv(filename, sep='\t', dtype=str)

    cities['city_id'] = cities.DEP + cities.COM
    if unique:
        # Drop duplicate indices: french cities table has sometimes multiple
        # rows for the same ID, as a city can change name.
        cities.drop_duplicates('city_id', inplace=True)
    cities.set_index('city_id', inplace=True)

    cities.rename(columns={
        'NCCENR': 'name',
        'ARTMIN': 'prefix',
        'DEP': 'departement_id',
        'REG': 'region_id',
        'POLE': 'current_city_id',
    }, inplace=True)

    cities['current'] = cities.ACTUAL == '1'
    cities['arrondissement'] = cities.ACTUAL == '5'

    cities.prefix.fillna('', inplace=True)
    cities.prefix = cities.prefix.str[1:-1]
    cities['separator'] = cities.prefix.map(
        lambda prefix: '' if not prefix or prefix.endswith("'") else ' ')
    cities.name = cities.prefix + cities.separator + cities.name

    return cities[[
        'name', 'departement_id', 'region_id', 'current', 'current_city_id', 'arrondissement']]


def french_urban_areas(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """French urban entities.

    The index are the IDs (Code Officiel Geographique) of the cities, and the columns are
    - "AU2010": ID of the urban area it's part of, except when it is not part of any.
    - "periurban": a mode:
        - 1: rural, not being part of any urban nor periurban area.
        - 2: periurban, more than 40% of inhabitants work in one or several urban areas.
        - 3: urban, part of an urban entities with more than 10k jobs.
    """

    if not filename:
        filename = path.join(data_folder, 'geo/french_urban_areas.xls')
    cities = pandas.read_excel(
        filename,
        sheet_name='Composition_communale',
        skiprows=5,
        index_col=0)
    cities['periurban'] = cities.CATAEU2010.map({
        111: 3,
        112: 2,
        120: 2,
    }).fillna(1).astype(int)
    return cities[['AU2010', 'periurban']]


def french_urban_entities(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """French urban entities.

    The index are the IDs (Code Officiel Geographique) of the cities, and the columns are
    - "UU2010": ID of the urban entity it's part of, except for rural where
      it's an ID grouping all rural cities in the département.
    - "urban": a score for how large the urban entity is
        - 0: <2k (rural)
        - 1: <5k
        - 2: <10k
        - 3: <20k
        - 4: <50k
        - 5: <100k
        - 6: <200k
        - 7: <2M
        - 8: Paris
    """

    if not filename:
        filename = path.join(data_folder, 'geo/french_urban_entities.xls')
    sheets = pandas.read_excel(
        filename,
        sheet_name=['UU2010', 'Composition_communale'],
        skiprows=5,
        index_col=0)
    entities = pandas.merge(
        sheets['Composition_communale'], sheets['UU2010'], how='left',
        left_on='UU2010', right_index=True)
    entities['urban'] = entities.TUU2015.fillna(0).astype(int)
    return entities[['UU2010', 'urban']]


def scraped_imt(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """IMT - Information sur le Marché du Travail.

    This is information on the labor market scraped from the Pôle emploi website.

    The table is indexed by "departement_id" and "rome_id" and contains the
    fields equivalent to the ImtLocalJobStats protobuf in camelCase.
    """

    if not filename:
        filename = path.join(data_folder, 'scraped_imt_local_job_stats.json')
    imt = pandas.read_json(filename, orient='records')
    imt['departement_id'] = imt.city.apply(lambda c: c['departementId'])
    imt['rome_id'] = imt.job.apply(lambda j: j['jobGroup']['romeId'])
    return imt.set_index(['departement_id', 'rome_id'])


def transport_scores(data_folder: str = 'data', filename: typing.Optional[str] = None) \
        -> pandas.DataFrame:
    """Table of public transportation scores by city ID from ville-ideale.fr."""

    if not filename:
        filename = path.join(data_folder, 'geo/ville-ideale-transports.html')
    with open(filename, 'rt') as transport_file:
        page_text = transport_file.read()
    page_selector = selector.Selector(text=page_text)

    # Parse the links containing city name and city ID.
    city_ids = (
        link.split('_')[-1]
        for link in page_selector.xpath('//td[@class="ville"]/a/@href').extract())
    # Parse the scores.
    scores = (
        float(note.replace(',', '.'))
        for note in page_selector.xpath('//td[@class="note"]/text()').extract())

    return {city_id: score if score >= .1 else .1 for city_id, score in zip(city_ids, scores)}


# Regular expression to match unaccented capital E in French text that should
# be capitalized. It has been computed empirically by testing on the full ROME.
# It matches the E in "Etat", "Ecrivain", "Evolution", but not in "Entreprise",
# "Ethnologue" nor "Euro".
_UNACCENTED_E_MATCH = re.compile(
    r'E(?=('
    '([bcdfghjklpqrstvz]|[cpt][hlr])[aeiouyéèêë]|'
    'n([eouyéèêë]|i[^v]|a[^m])|'
    'm([aeiuyéèêë]|o[^j])))')


def maybe_add_accents(title: str) -> str:
    """Add an accent on capitalized letters if needed.

    In the ROME, most of the capitalized letters have no accent even if the
    French word would require one. This function fixes this by using
    heuristics.
    """

    return _UNACCENTED_E_MATCH.sub('É', title)


def _merge_hard_skills(
        skill_ids: typing.Union[float, typing.List[str]],
        activitie_ids: typing.Union[float, typing.List[str]]) -> typing.List[str]:
    """Merging skill and activity ids."""

    skill_ids = skill_ids if isinstance(skill_ids, list) else []
    activitie_ids = activitie_ids if isinstance(activitie_ids, list) else []
    return skill_ids + activitie_ids


def job_offers_skills(
        data_folder: str = 'data', job_offers_filename: typing.Optional[str] = None,
        skills_filename: typing.Optional[str] = None,
        activities_filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """Job offers gathered and provided by Pôle emploi and their unwinded skills.

    Each row represents a skill required for a specific job offer. Columns are:
    the job offer original index, the job group rome code, the job group name and
    the skill ID (ogr code).
    """

    if not job_offers_filename:
        job_offers_filename = path.join(data_folder, 'job_offers/recent_job_offers.csv')
    offers = pandas.read_csv(
        job_offers_filename,
        dtype={'POSTCODE': str, 'ROME_LIST_SKILL_CODE': str, 'ROME_LIST_ACTIVITY_CODE': str},
        parse_dates=['CREATION_DATE', 'MODIFICATION_DATE'],
        dayfirst=True, infer_datetime_format=True, low_memory=False)
    if not skills_filename:
        skills_filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_competence_{_ROME_VERSION}_utf8.csv')
    skills = pandas.read_csv(skills_filename)
    skills.set_index('code_ogr', inplace=True)
    if not activities_filename:
        activities_filename = path.join(
            data_folder, f'rome/csv/unix_referentiel_activite_{_ROME_VERSION}_utf8.csv')
    activities = pandas.read_csv(activities_filename)
    activities.set_index('code_ogr', inplace=True)

    # Cleaning columns.
    offers.columns = offers.columns.str.lower()
    offers['skill_ids'] = offers.rome_list_skill_code.str.split(';')
    offers['activitie_ids'] = offers.rome_list_activity_code.str.split(';')

    offers['all_skill_ids'] = offers.apply(
        lambda row: _merge_hard_skills(row.skill_ids, row.activitie_ids), axis=1)

    # Getting skills per job group.
    offers = offers.reset_index().rename(index=str, columns={'index': 'offer_num'})

    skills_per_job_offer = []
    offers.apply(
        lambda row: skills_per_job_offer.extend([
            [
                row.offer_num, row.rome_profession_card_code,
                row.rome_profession_name, int(skill_id)
            ]
            for skill_id in row.all_skill_ids]),
        axis=1)
    unwind_offers_skills = pandas.DataFrame(
        skills_per_job_offer, columns=[
            'offer_num', 'rome_profession_card_code', 'rome_profession_card_name', 'code_ogr'])

    # Fix skill names that contain double '.
    unwind_offers_skills['skill_name'] = unwind_offers_skills.code_ogr\
        .map(skills.libelle_competence.str.replace("''", "'"))
    unwind_offers_skills['activity_name'] = unwind_offers_skills.code_ogr\
        .map(activities.libelle_activite.str.replace("''", "'"))
    unwind_offers_skills['skill_activity_name'] = unwind_offers_skills.skill_name\
        .combine_first(unwind_offers_skills.activity_name)
    return unwind_offers_skills


def market_scores(
        data_folder: str = 'data', filename: typing.Optional[str] = None) -> pandas.DataFrame:
    """Market score at the departement level gathered and provided by Pôle emploi.

    Each row represents a market. Columns are:
    the departement id, the job group rome code, the market tension and
    the yearly average denominator and the area level of the market score (D is for
    departement, R for Region, etc...)
    """

    if not filename:
        filename = path.join(data_folder, 'imt/market_score.csv')

    market_stats = pandas.read_csv(filename, dtype={'AREA_CODE': 'str'})
    market_stats['departement_id'] = market_stats.AREA_CODE
    market_stats['market_score'] = market_stats.TENSION_RATIO.div(_YEARLY_AVG_OFFERS_DENOMINATOR)
    market_stats['yearly_avg_offers_per_10_candidates'] = market_stats.TENSION_RATIO
    market_stats['rome_id'] = market_stats.ROME_PROFESSION_CARD_CODE
    market_stats['yearly_avg_offers_denominator'] = _YEARLY_AVG_OFFERS_DENOMINATOR
    market_stats = market_stats.set_index(['rome_id', 'departement_id'])
    market_stats.dropna(subset=['market_score'], inplace=True)

    return market_stats[[
        'market_score', 'yearly_avg_offers_per_10_candidates',
        'yearly_avg_offers_denominator', 'AREA_TYPE_CODE'
    ]]
