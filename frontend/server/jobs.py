"""Common function to handle jobs."""

from bob_emploi.frontend.api import job_pb2
from bob_emploi.frontend.server import proto


# Cache (from MongoDB) of job group info.
_JOB_GROUPS_INFO = proto.MongoCachedCollection(job_pb2.JobGroup, 'job_group_info')


def get_group_proto(database, rome_id):
    """Get a JobGroup proto corresponding to the ROME job group ID."""

    return _JOB_GROUPS_INFO.get_collection(database).get(rome_id)


def get_job_proto(database, job_id, rome_id):
    """Get a Job proto corresponding to the job ID if it is found in the ROME job group."""

    job_group = get_group_proto(database, rome_id)
    if not job_group or not job_id:
        return None

    for job_proto in job_group.jobs:
        if job_proto.code_ogr == job_id:
            job = job_pb2.Job()
            job.CopyFrom(job_proto)
            job.job_group.rome_id = job_group.rome_id
            job.job_group.name = job_group.name
            return job

    return None
