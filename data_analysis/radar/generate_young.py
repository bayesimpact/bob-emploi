"""Generate a list of young people, with their Radar photos."""

import datetime
from typing import Tuple

import numpy as np

from bob_emploi.frontend.api.radar import typeform_pb2
# TODO(cyrille): Test this file.

from bob_emploi.data_analysis.radar import config as radar_config

_INITIAL_PHOTO_MONTH = (2021, 1)
# Data to describe the fake generation of photos. Each photo is in a given month,
# and has a (rounded) normal distribution with parameters.
_PHOTO_MONTH_TO_DISTRIBUTION = {
    (2021, 3): (1, 2),
    (2021, 5): (2, 1),
    (2021, 7): (3, 1),
}
# Patches on the distributions above given a domain and a photo month to make the dashboard show
# interesting patterns.
_SKEW_DISTRIBUTION = {
    # Job autonomy is rather low before joining MiLo.
    ('job', (2021, 3)): (1, 1),
    # Job autonomy improvements through MiLo is quite high.
    ('job', (2021, 7)): (4, 1),
    # Financial autonomy improvements through MiLo is quite low.
    ('financial', (2021, 5)): (0, 3),
    ('financial', (2021, 7)): (0, 3),
    # Healthcare autonomy is quite high an stays high.
    ('healthcare', (2021, 3)): (2.5, 2),
    ('healthcare', (2021, 5)): (3, 2),
    ('healthcare', (2021, 7)): (3, 1),
    # Mobility autonomy is acquired almost by everyone.
    ('mobility', (2021, 7)): (4, 0.25),
}
# Percentage of young people dropping off coaching every month.
_DROP_OFF = 0.1
# Random list of policies the generated users may have.
_POLICIES = ['PACEA', 'GRT', 'CFP']
# Random list of school levels the generated users may have.
_SCHOOLS = ['i', 'ii', 'iii', 'iv', 'v', 'vb']


def _round_normal_distribution(distribution: Tuple[float, float]) -> int:
    return min(4, max(0, round(np.random.normal(*distribution))))


def _add_answers_to_photo(
        photo_month: Tuple[int, int], photo: typeform_pb2.Photo,
        distribution: Tuple[float, float],
        config: radar_config.Config) -> None:
    for domain in config['domainIds']:
        final_distribution = _SKEW_DISTRIBUTION.get((domain, photo_month), distribution)
        for skill in config['skillIds']:
            answer = photo.answers.add()
            answer.field.ref = f'{domain}-{skill}'
            level = _round_normal_distribution(final_distribution)
            answer.choice.label = f'Niveau {level:d}'


def _generate_full_photo(
        user_id: str, photo_month: Tuple[int, int],
        previous_photos: list[typeform_pb2.Photo],
        config: radar_config.Config) -> typeform_pb2.Photo:
    full_photo = typeform_pb2.Photo()
    try:
        previous_photo = next(
            old_photo
            for old_photo in previous_photos
            if old_photo.hidden.dossier_id == user_id)
        full_photo.CopyFrom(previous_photo)
        del full_photo.answers[:]
    except StopIteration:
        full_photo.hidden.age = str(round(np.random.uniform(20, 25)))
        full_photo.hidden.counselor_id = str(round(np.random.uniform(0, 100)))
        full_photo.hidden.current_policies = str(np.random.choice(_POLICIES))
        full_photo.hidden.school_level = str(np.random.choice(_SCHOOLS))
        full_photo.hidden.structure_id = str(round(np.random.uniform(0, 30)))
        full_photo.hidden.dossier_id = str(user_id)
    _add_answers_to_photo(
        photo_month, full_photo, _PHOTO_MONTH_TO_DISTRIBUTION[photo_month],
        config=config)
    year, month = photo_month
    full_photo.submitted_at.FromDatetime(
        datetime.datetime(year, month, min(31, max(1, np.random.poisson(15)))))
    return full_photo


def generate_all_photos(size: int, config: radar_config.Config) -> list[typeform_pb2.Photo]:
    """
    Generate fake photos for a given number of users.

    Each user has 3 photos with user situation and form answers.
    """

    all_photos: list[typeform_pb2.Photo] = []
    for num in range(size):
        for photo_month in _PHOTO_MONTH_TO_DISTRIBUTION:
            if np.random.uniform(0, 1) < _DROP_OFF:
                break
            all_photos.append(_generate_full_photo(
                str(num), photo_month, all_photos, config=config))
    return all_photos
