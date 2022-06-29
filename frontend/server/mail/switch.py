"""Mail modules for a Switch programm focus email."""

import datetime
from typing import Any

from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.server import i18n
from bob_emploi.frontend.server.mail import campaign


def _get_switch_vars(
        user: user_pb2.User, *, now: datetime.datetime, **unused_kwargs: Any) -> dict[str, str]:
    """Compute all variables required for the Switch campaign."""

    if now.year - user.profile.year_of_birth < 22:
        raise campaign.DoNotSend('User is too young')

    project = next((p for p in user.projects), project_pb2.Project())

    if project.seniority <= project_pb2.INTERMEDIARY:
        raise campaign.DoNotSend("User doesn't have enough experience")

    return campaign.get_default_coaching_email_vars(user) | {
        'isConverting': campaign.as_template_boolean(project.kind == project_pb2.REORIENTATION),
    }


campaign.register_campaign(campaign.Campaign(
    campaign_id='switch-grant',
    mongo_filters={},
    is_coaching=True,
    get_vars=_get_switch_vars,
    sender_name=i18n.make_translatable_string('Joanna de {{var:productName}}'),
    sender_email='joanna@bob-emploi.fr',
))
