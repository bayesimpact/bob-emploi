"""Modules defining scoring models."""

import importlib
import logging
import os

# TODO(cyrille): Find a better way to auto-reload in dev env.
# Import behind guard to enable flask auto-reload on those files.
if False:  # pylint: disable=using-constant-test
    # TODO(cyrille): Test that all dynamically imported modules are here.
    from . import application_modes
    from . import application_tips
    from . import associations_help
    from . import better_job_in_group
    from . import civic_service
    from . import commute
    from . import create_your_company
    from . import diagnostic
    from . import diplomas
    from . import driving_license
    from . import events
    from . import immersion
    from . import jobboards
    from . import language
    from . import network
    from . import online_salons
    from . import project_clarity
    from . import relocate
    from . import reorient_jobbing
    from . import reorient_to_close_job
    from . import seasonal_relocate
    from . import skill_for_future
    from . import strategy
    from . import volunteer

_MODULE_FOLDER = os.path.dirname(os.path.realpath(__file__))


def import_all_modules() -> None:
    """Dynamically import all modules from this folder."""

    for file in os.scandir(_MODULE_FOLDER):
        if file.name in {'__init__.py', 'test', '__pycache__'}:
            # Expected files, no need to import them.
            continue
        if file.is_dir():
            # TODO(cyrille): Consider whether we should import recursively.
            logging.warning("The scoring modules in 'modules/%s' won't be imported", file.name)
            continue
        if not file.is_file():
            logging.warning("Symlink 'modules/%s' won't be imported", file.name)
            continue
        if not file.name.endswith('.py'):
            continue
        # TODO(cyrille): Test that those are not statically imported elsewhere.
        importlib.import_module(f'.{file.name[:-3]}', __package__)
