"""Script to cleanup Docker Hub from old images."""
import collections
import datetime
import json
import os
import re
from urllib import parse

import requests

_DOCKER_HUB_USER = os.getenv('DOCKER_USER')
_DOCKER_HUB_PASSWORD = os.getenv('DOCKER_PASSWORD')

# Minimum age of old images to delete.
_MIN_AGE_OLD_IMAGES = datetime.timedelta(days=7)

# Repositories to clean up.
_REPOS = frozenset([
    'bayesimpact/bob-emploi-frontend',
    'bayesimpact/bob-emploi-frontend-server',
    'bayesimpact/bob-emploi-analytics-count-users',
])

# Regular expression for tag of images to never delete.
_KEEP_TAGS_RE = re.compile('branch-master$|^tag-')

# Maximum number of images that we're OK to keep in our repository.
_MAX_NUM_IMAGES = 200

_API_ROOT = 'https://hub.docker.com/v2'


def _list_images(repo):
    """List all available images in a repo."""
    response = requests.get(
        '%s/repositories/%s/tags?page=1&page_size=250'
        % (_API_ROOT, parse.quote(repo)))
    response.raise_for_status()
    return response.json().get('results', [])


def _compute_image_age(image_info):
    """Compute the age of an image."""
    created = datetime.datetime.strptime(
        image_info.get('last_updated'), '%Y-%m-%dT%H:%M:%S.%fZ')
    return datetime.datetime.now() - created


def _keep_old(image_info, keep_tags=_KEEP_TAGS_RE):
    """Check whether we should keep an image even if it's old."""
    return keep_tags.match(image_info.get('name'))


def _get_auth_token():
    if not _DOCKER_HUB_USER or not _DOCKER_HUB_PASSWORD:
        raise ValueError(
            'Missing Docker Hub user or password, '
            'please set env var DOCKER_USER and DOCKER_PASSWORD')
    response = requests.post(
        '%s/users/login/' % _API_ROOT,
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        data=json.dumps({
            'username': _DOCKER_HUB_USER,
            'password': _DOCKER_HUB_PASSWORD,
        }))
    response.raise_for_status()
    return response.json().get('token')


_AgedImage = collections.namedtuple('AgedImage', ['age', 'image_id'])


def delete_untagged_and_old_images(repo, min_age=_MIN_AGE_OLD_IMAGES):
    """Delete all untagged and old images in a repository."""
    all_images = _list_images(repo)

    to_delete = []
    recent_images = []

    for image in all_images:
        if _keep_old(image):
            continue
        age = _compute_image_age(image)
        image_id = image.get('name')
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
        token = _get_auth_token()
        for tag in to_delete:
            print('Deleting %s:%s' % (repo, tag))
            requests.delete(
                '%s/repositories/%s/tags/%s/' %
                (_API_ROOT, parse.quote(repo), parse.quote(tag)),
                headers={'Authorization': 'JWT %s' % token})


def main(repos):
    """Delete all untagged and old images in our repositories."""
    for repo in repos:
        delete_untagged_and_old_images(repo)


if __name__ == '__main__':
    main(_REPOS)
