"""A mail to users that could be interested in working in Maison d'Arles."""

from bob_emploi.frontend.api import geo_pb2
from bob_emploi.frontend.api import project_pb2
from bob_emploi.frontend.server.asynchronous.mail import campaign


_JOB_GROUP_ROME_IDS = {
    'G1101', 'G1102', 'G1201', 'G1202', 'G1203', 'G1204', 'G1205', 'G1206',
    'G1301', 'G1303', 'G1401', 'G1402', 'G1403', 'G1404', 'G1501', 'G1502',
    'G1503', 'G1601', 'G1602', 'G1603', 'G1604', 'G1605', 'G1701', 'G1702',
    'G1703', 'G1801', 'G1802', 'G1803', 'G1804',
}


def _get_vars(user, **unused_kwargs):
    """Compute vars for one user's email."""

    project = next((p for p in user.projects), project_pb2.Project())

    is_local = False
    area_type = project.area_type or project.mobility.area_type
    if not area_type:
        return
    city = project.city if project.HasField('city') else project.mobility.city
    if area_type < geo_pb2.COUNTRY:
        if city.region_id != '93':
            return
        if area_type < geo_pb2.REGION:
            if city.departement_id != '13':
                return
            if area_type < geo_pb2.DEPARTEMENT:
                if city.city_id != '13004':
                    return
                is_local = True

    return dict(campaign.get_default_vars(user), **{
        'isLocal': campaign.as_template_boolean(is_local),
    })


campaign.register_campaign('salon-arles', campaign.Campaign(
    mailjet_template='324871',
    mongo_filters={
        'projects.targetJob.jobGroup.romeId': {'$in': list(_JOB_GROUP_ROME_IDS)},
    },
    get_vars=_get_vars,
    sender_name='Margaux de Bob',
    sender_email='margaux@bob-emploi.fr',
))
