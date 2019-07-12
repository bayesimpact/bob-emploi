"""Importer for Service Civique (Civic Service) missions.

The data will be imported into the `local_missions` collection.

The data from this importer is indexed by departement ID.

You can try it out on a local instance:
 - Start your local environment with `docker-compose up -d frontend-dev`.
 - Scrape the civic service website to a CSV file with civic service missions:
    docker-compose run --rm data-analysis-prepare \
        scrapy runspider bob_emploi/data_analysis/scraper/service_civique_scraper.py \
        -o data/civic_service_offers_$(date +%Y-%m-%d).csv -L INFO -s AUTOTHROTTLE_ENABLED=1
- Run this script:
    docker-compose run --rm data-analysis-prepare \
        python bob_emploi/data_analysis/importer/civic_service.py \
        --civic_service_missions_csv data/civic_service_offers_$(date +%Y-%m-%d).csv
"""

import datetime
import typing

import pandas as pd

from bob_emploi.data_analysis.lib import mongo

MONTHS = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11',
    'décembre': '12'
}


# TODO(marielaure): Test the checks individually.
def check_coverage(missions: pd.DataFrame) -> bool:
    """Report if the new data are not dropping too much the expected coverage.

    Expected values are defined based on the following notebook:
    https://github.com/bayesimpact/bob-emploi-internal/blob/master/data_analysis/notebooks/scraped_data/civic_service_offers.ipynb
    """

    # We expect at least 75% (77) of the 103 départements to be covered.
    if missions['_id'].nunique() < 77:
        return False

    # We expect at least 75% of the départements to have more than 2 missions.
    if missions.groupby('_id').count().quantile(q=0.25) < 2:
        return False

    return True


def csv2dicts(civic_service_missions_csv: str, today: typing.Optional[str] = None) \
        -> typing.List[typing.Dict[str, typing.Any]]:
    """Import civic service missions data per departement in MongoDB.

    Args:
        civic_service_missions_csv: path to a CSV file containing the civic service data.
    """

    if not today:
        now = datetime.datetime.now()
        today = now.strftime('%Y-%m-%d')

    if today not in civic_service_missions_csv:
        raise ValueError(
            'The civic service scraped file is not up to date, please run the ' +
            'scraper to update it:\n\n' +
            'docker-compose run --rm data-analysis-prepare ' +
            'scrapy runspider bob_emploi/data_analysis/scraper/service_civique_scraper.py ' +
            '-o data/civic_service_offers_$(date +%Y-%m-%d).csv -L INFO ' +
            '-s AUTOTHROTTLE_ENABLED=1')

    missions = pd.read_csv(civic_service_missions_csv, dtype={'departement_id': str})

    # Remove duplicated missions.
    missions = missions.drop_duplicates()

    # Change Corsica departement ID to match ours (e.g Corse du Sud  "20/A -> 2A".).
    missions['departement_id'] = missions.departement_id.str.replace('0/', '')

    # As date is given in French, add a formatted date column.
    try:
        missions['date_formatted'] = missions.start_date[missions.start_date.str.contains(' ')]\
            .apply(lambda date: f'{date.split(" ")[2]}-{MONTHS[date.split(" ")[1]]}')
    except IndexError as error:
        raise ValueError(
            f'Dates do not have the right format: "{missions.start_date}"') from error

    # Format the start date for first date of the month in proper French (e.g 1 -> 1ᵉʳ).
    missions.start_date = missions.start_date.str.replace('1 ', '1ᵉʳ ')

    # Keeping only missions starting now and after.
    earlier_start = today[:-3]
    missions_recent = missions[missions.date_formatted >= earlier_start]

    # Keeping only a maximum of 5 missions per departement.
    def _create_missions(missions: pd.DataFrame) -> typing.List[typing.Dict[str, typing.Any]]:
        return typing.cast(
            typing.List[typing.Dict[str, typing.Any]],
            missions[[
                'organism', 'link', 'duration', 'start_date', 'domain', 'title', 'description']]
            .rename(columns={'organism': 'associationName'})
            .head(5)
            .to_dict(orient='records'))

    missions_per_departement = missions_recent \
        .groupby('departement_id') \
        .apply(_create_missions) \
        .to_frame('missions') \
        .reset_index() \
        .rename(columns={'departement_id': '_id'})

    if not check_coverage(missions_per_departement):
        raise ValueError('The putative new data lacks coverage.')

    return typing.cast(
        typing.List[typing.Dict[str, typing.Any]],
        missions_per_departement.to_dict(orient='records'))


if __name__ == '__main__':
    mongo.importer_main(csv2dicts, 'local_missions')
