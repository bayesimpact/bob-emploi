"""Get workers previous education by current job."""

import json
import logging
from typing import Any

import requests

from bob_emploi.frontend.api import training_pb2


NO_TRAININGS: list[training_pb2.Training] = []


def _get_courses_api(soc_code: str) -> requests.Response:
    return requests.get(
        f'http://api.lmiforall.org.uk/api/v1/hesa/courses/{soc_code}',
        headers={'Accept': 'application/json'})


def _sort_filter_courses(courses: list[dict[str, Any]]) -> list[training_pb2.Training]:
    # We only consider courses that at least 10% of the workers mentioned.
    sorted_trainings = sorted(
        courses, key=lambda course: course.get('percentage', 0), reverse=True)
    filtered_trainings = [
        training_pb2.Training(name=course['name'])
        for course in sorted_trainings if course.get('percentage', 0) >= 10]
    if not filtered_trainings:
        logging.warning(
            'Request for hesa courses failed, there is no training above the threshold.')
        return NO_TRAININGS
    return filtered_trainings


def get_trainings(soc_code: str) -> list[training_pb2.Training]:
    """Get Hesa trainings for a SOC code from Lmi For All API."""

    # We only consider answers from the latest year.
    response = _get_courses_api(soc_code)
    if response.status_code != 200:
        logging.warning('Request for hesa courses failed with error code %d', response.status_code)
        return NO_TRAININGS

    if not response.text:
        logging.warning('Request for hesa courses failed, there is no text in the response.')
        return NO_TRAININGS
    return _sort_filter_courses(json.loads(response.text)['years'][-1]['courses'])
