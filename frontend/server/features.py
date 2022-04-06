"""Module to handle feature flags. See go/bob:feature-flags-design"""

import logging
import os
import random

from google.protobuf import json_format

from bob_emploi.frontend.api import features_pb2
from bob_emploi.frontend.server import cache

# ENV var used: os.getenv('EXPERIMENTS_ROLLOUTS')
# A JSON encoded value of an ExperimentRollouts defining which feature to setup for users.
_ENV_VARNAME = 'EXPERIMENTS_ROLLOUTS'


def assign_features(features_enabled: features_pb2.Features, *, is_new: bool) -> None:
    """Maybe change the features if needed."""

    config = _get_rollouts_config()

    for feature_name, rollout in config.experiments.items():
        draw = random.random() * 100

        if is_new:
            if draw < rollout.new_users_in_control:
                setattr(features_enabled, feature_name, features_pb2.CONTROL)
            elif draw < rollout.new_users_in_control + rollout.new_users_in_active:
                setattr(features_enabled, feature_name, features_pb2.ACTIVE)
            continue

        if getattr(features_enabled, feature_name):
            continue

        if draw < rollout.unassigned_users_in_control:
            setattr(features_enabled, feature_name, features_pb2.CONTROL)
        elif draw < rollout.unassigned_users_in_control + rollout.unassigned_users_in_active:
            setattr(features_enabled, feature_name, features_pb2.ACTIVE)


@cache.lru(maxsize=1)
def _get_rollouts_config() -> features_pb2.ExperimentRollouts:
    """Load the experiment rollouts from a JSON config in an env var."""

    config_as_string = os.getenv(_ENV_VARNAME)
    if not config_as_string:
        return features_pb2.ExperimentRollouts()

    config_from_env = features_pb2.ExperimentRollouts()
    try:
        json_format.Parse(f'{{"experiments": {config_as_string}}}', config_from_env)
    except json_format.ParseError:
        logging.exception('%s env var error', _ENV_VARNAME)
        return features_pb2.ExperimentRollouts()

    rollouts = features_pb2.ExperimentRollouts()
    for feature_name, config in config_from_env.experiments.items():

        # Check type.
        field = features_pb2.Features.DESCRIPTOR.fields_by_name.get(feature_name)
        if not field:
            logging.error(
                'Feature configured in %s env var does not exist: %s', _ENV_VARNAME, feature_name)
            continue
        if field.enum_type != features_pb2.BinaryExperiment.DESCRIPTOR:
            logging.error(
                'Feature configured in %s env var is not a binary experiment: %s',
                _ENV_VARNAME, feature_name)
            continue

        # Check percentages.
        try:
            for prefix in ('new', 'unassigned'):
                control_percent = getattr(config, f'{prefix}_users_in_control')
                active_percent = getattr(config, f'{prefix}_users_in_active')
                assert control_percent >= 0
                assert control_percent <= 100
                assert active_percent >= 0
                assert active_percent <= 100
                assert control_percent + active_percent <= 100
        except AssertionError:
            logging.error(
                'Config for feature "%s" is invalid in %s env var:\n%s',
                feature_name, _ENV_VARNAME, config)
            continue

        rollouts.experiments[feature_name].CopyFrom(config)

    return rollouts
