"""Configuration of Radar forms."""

import os
import typing
from typing import Mapping, Optional, Sequence, TypedDict

import json5


class Config(TypedDict):
    """Configuration of Radar forms."""

    domainIds: Sequence[str]
    skillIds: Sequence[str]
    translations: Mapping[str, str]


def from_json5_file(json_path: Optional[str] = None) -> Config:
    """Load a config from a json5 file."""

    if not json_path:
        json_path = os.path.join(os.path.dirname(__file__), 'config.json5')
    with open(json_path, 'r', encoding='utf-8') as json_file:
        return typing.cast(Config, json5.load(json_file))
