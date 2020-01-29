"""Importer for string translations."""

from typing import Any, Dict, List

from bob_emploi.data_analysis.i18n import translation
from bob_emploi.data_analysis.lib import mongo


def airtable2dicts() -> List[Dict[str, Any]]:
    """Import the translations in MongoDB."""

    return list(translation.get_all_translations().values())


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
