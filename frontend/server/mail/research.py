"""Module for research campaigns.

Registers a default email campaign to recruit Bob users to conduct research interviews.

The choice of users is done by a MongoDB filters on the user collection given by an env
variable.

Here is how you can call it to send it to users that are born in 1982:

docker-compose run --rm \
    -e RESEARCH_TARGET_USERS='{"profile.yearOfBirth": 1982}' \
    frontend-flask \
    python bob_emploi/frontend/server/mail/mail_blast.py bob-research-recruit dry-run \
    --registered-from-days-ago 90 \
    --registered-to-days-ago 0 \
    --days-since-same-campaign 14 \
    --days-since-same-campaign-unread 5
"""

import json
import os
import typing
from typing import Any

from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server.mail import campaign


def _get_mongo_filters() -> dict[str, Any]:
    """Get the mongo filters from env vars."""

    filters_as_string = os.getenv('RESEARCH_TARGET_USERS', '')
    if not filters_as_string:
        return {}

    return typing.cast(dict[str, Any], json.loads(filters_as_string))


campaign.register_campaign(campaign.Campaign(
    campaign_id='bob-research-recruit',
    get_mongo_filters=_get_mongo_filters,
    get_vars=campaign.get_default_vars,
    sender_name=i18n.make_translatable_string("Tabitha et l'équipe de {{var:productName}}"),
    sender_email='tabitha@bob-emploi.fr',
))
