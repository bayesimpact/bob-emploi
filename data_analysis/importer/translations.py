"""Importer for string translations."""

from typing import Any

from bob_emploi.common.python.i18n import translation
from bob_emploi.data_analysis.lib import mongo


def airtable2dicts() -> list[dict[str, Any]]:
    """Import the translations in MongoDB."""

    return list(translation.get_all_translations().values())


if __name__ == '__main__':
    mongo.importer_main(airtable2dicts, 'test')
