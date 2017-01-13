#!/usr/bin/env python
"""Script to cleanup the AWS ECR (Docker Registry) from old images."""
import collections
import datetime
import json
import re
import subprocess

# Minimum age of old images to delete.
_MIN_AGE_OLD_IMAGES = datetime.timedelta(days=7)

# Repositories to clean up.
_REPOS = frozenset([
    'bob-emploi/frontend',
    'bob-emploi/frontend-flask'])

# Regular expression for tag of images to never delete.
_KEEP_TAGS_RE = re.compile('branch-master$|^tag-')

# AWS region in which the ECR registry lives.
_ECR_REGION = 'eu-central-1'

# Maximum number of images that we're OK to keep in our repository (note that
# ECR has a limit of few hundreds, and that the aws tool has trouble with more
# than 100).
_MAX_NUM_IMAGES = 10


def _get_process_info(command):
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    return process.communicate()[0].strip()


def _list_images(repo):
    """List all available images in a repo."""
    return json.loads(_get_process_info([
        'aws', 'ecr', 'list-images', '--repository-name', repo,
        '--region', _ECR_REGION])).get('imageIds')


def _compute_image_age(image_info):
    """Compute the age of an image."""
    created = datetime.datetime.fromtimestamp(image_info.get('imagePushedAt'))
    return datetime.datetime.now() - created


def _keep_old(image_info, keep_tags=_KEEP_TAGS_RE):
    """Check whether we should keep an image even if it's old."""
    return any(keep_tags.match(tag) for tag in image_info.get('imageTags'))


_AgedImage = collections.namedtuple('AgedImage', ['age', 'image_id'])


def delete_untagged_and_old_images(repo, min_age=_MIN_AGE_OLD_IMAGES):
    """Delete all untagged and old images in a repository."""
    all_images = _list_images(repo)
    to_delete = [i for i in all_images if i.get('imageTag') is None]

    recent_images = []

    with_tags = [i for i in all_images if i.get('imageTag') is not None]
    if with_tags:
        images_info = json.loads(_get_process_info([
            'aws', 'ecr', 'describe-images', '--repository-name', repo,
            '--region', _ECR_REGION,
            # the --image-ids has a max of 100 IDs.
            '--image-ids', json.dumps(with_tags[:100])]))
        for image in images_info.get('imageDetails'):
            if _keep_old(image):
                continue
            age = _compute_image_age(image)
            image_id = {'imageDigest': image['imageDigest']}
            if age > min_age:
                to_delete.append(image_id)
            else:
                recent_images.append(_AgedImage(age, image_id))

    # Delete recent images if we have too many even if they didn't reach the
    # min_age.
    if len(recent_images) > _MAX_NUM_IMAGES:
        recent_images.sort(key=lambda aged_image: aged_image.age)
        to_delete += [
            aged_image.image_id
            for aged_image in recent_images[_MAX_NUM_IMAGES:]]

    if to_delete:
        delete_job = subprocess.Popen([
            'aws', 'ecr', 'batch-delete-image', '--repository-name', repo,
            '--region', _ECR_REGION, '--image-ids', json.dumps(to_delete)])
        delete_job.wait()


def main(repos):
    """Delete all untagged and old images in our repositories."""
    for repo in repos:
        delete_untagged_and_old_images(repo)


if __name__ == '__main__':
    main(_REPOS)
