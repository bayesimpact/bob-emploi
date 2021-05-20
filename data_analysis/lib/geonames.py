"""Module to handle Geonames cities datasets."""

import csv
from typing import Dict, Iterator

# Names of the fields in geonames dump format.
# See https://download.geonames.org/export/dump/readme.txt
GEONAMES_FIELDNAMES = (
    'geonameid',  # integer id of record in geonames database
    'name',  # name of geographical point (utf8) varchar(200)
    'asciiname',  # name of geographical point in plain ascii characters, varchar(200)
    'alternatenames',  # alternatenames, comma separated, ascii names automatically transliterated
    'latitude',  # latitude in decimal degrees (wgs84)
    'longitude',  # longitude in decimal degrees (wgs84)
    'feature_class',  # see http://www.geonames.org/export/codes.html, char(1)
    'feature_code',  # see http://www.geonames.org/export/codes.html, varchar(10)
    'country_code',  # ISO-3166 2-letter country code, 2 characters
    'cc2',  # alternate country codes, comma separated, ISO-3166 2-letter country code
    'admin1_code',  # fipscode (subject to change to iso code), see exceptions below,
    'admin2_code',  # code for the second administrative division, a county in the US
    'admin3_code',  # code for third level administrative division, varchar(20)
    'admin4_code',  # code for fourth level administrative division, varchar(20)
    'population',  # bigint (8 byte int)
    'elevation',  # in meters, integer
    'dem',  # digital elevation model, srtm3 or gtopo30, average elevation
    'timezone',  # the iana timezone id (see file timeZone.txt) varchar(40)
    'modification_date',  # date of last modification in yyyy-MM-dd format
)


def iterate_geonames(filename: str) -> Iterator[Dict[str, str]]:
    """Iterate on geonames rows from a tsv file.

    Yields dicts with keys in GEONAMES_FIELDNAMES.
    """

    with open(filename, 'rt') as file:
        names_reader = csv.DictReader(
            file, fieldnames=GEONAMES_FIELDNAMES, delimiter='\t',
        )
        for geoname in names_reader:
            yield geoname
