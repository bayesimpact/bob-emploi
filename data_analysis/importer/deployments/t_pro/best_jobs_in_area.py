"""Importer for local market information for a given area to MongoDB."""

import re
from typing import Any, Iterator

import pandas

from bob_emploi.data_analysis.importer import best_jobs_in_area
from bob_emploi.data_analysis.importer.deployments.t_pro import cleaned_data
from bob_emploi.data_analysis.lib import mongo

_NON_ALPHANUM_REGEX = re.compile(r'[^a-z0-9]+')

_SECTOR_DESCRIPTIONS = {
    'agriculture-et-foret': "Des métiers dans le secteur de l'agriculture et la forêt",
    'btp': 'Des métiers dans le secteur du BTP',
    'divers': 'Divers métiers',
    'force-de-vente': 'Des métiers dans le secteur commercial',
    'industrie': 'Des métiers dans le secteur industriel',
    'industrie-du-futur-production-industrielle':
    "Des métiers dans le secteur de la production industrielle et de l'industrie du futur",
    'metallurgie-mecanique': 'Des métiers dans les secteurs de la métallurgie et de la mécanique',
    'metiers-de-bouche': 'Des métiers de bouche',
    'metiers-qui-se-transforment': 'Des métiers qui se transforment',
    'numérique': 'Des métiers dans le secteur du numérique',
    'services-a-la-personne': 'Des métiers dans le secteur des services à la personne',
    'service-des-autres': 'Des métiers au service des autres',
    'sport-tourisme-montagne':
    'Des métiers dans le secteur du sport, du tourisme et de la montagne',
    'transport-mobilites': 'Des métiers dans le secteur des transports et de la mobilité',
}

_META_SECTORS: dict[str, list[str]] = {
    'metiers-qui-se-transforment': [
        'btp', 'industrie', 'metallurgie-mecanique', 'industrie-du-futur-production-industrielle'],
    'service-des-autres': [
        'force-de-vente', 'transport-mobilites', 'sport-tourisme-montagne',
        'services-a-la-personne', 'metiers-de-bouche'],
}


def _make_sectors(clean_jobs: pandas.DataFrame) -> pandas.DataFrame:
    sectors = clean_jobs[['sector', 'job_group']]
    sectors['sectorId'] = clean_jobs.sector.str.lower().replace(_NON_ALPHANUM_REGEX, '-')

    # Add meta sectors.
    meta_sectors = pandas.DataFrame(
        [[key, value] for key, values in _META_SECTORS.items() for value in values],
        columns=['meta', 'sectorId'])
    meta_sectors = meta_sectors.merge(sectors, on='sectorId')
    meta_sectors['sectorId'] = meta_sectors.meta
    sectors = pandas.concat((sectors, meta_sectors.drop('meta', axis=1)), axis='index')

    sectors['description'] = sectors.sectorId.map(pandas.Series(_SECTOR_DESCRIPTIONS))
    return sectors.drop('sector', axis=1)


def csv2dicts(
        *, imt_folder: str, pcs_rome_crosswalk: str, metiers_xlsx: str) -> Iterator[dict[str, Any]]:
    """Export data for the main app."""

    clean_jobs = cleaned_data.clean_metiers(metiers_xlsx)
    allowed_romes = set(clean_jobs.job_group.unique())
    market_scores = best_jobs_in_area.get_market_scores(imt_folder, pcs_rome_crosswalk)
    market_scores = market_scores[market_scores.job_group.isin(allowed_romes)]

    yield from best_jobs_in_area.compute_areas(
        market_scores=market_scores, sectors=_make_sectors(clean_jobs), min_score=0,
        include_all_sector_jobs=True)


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'best_jobs_in_area', count_estimate=101)
