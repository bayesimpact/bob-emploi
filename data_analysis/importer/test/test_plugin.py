"""Module to test the plugin interface of import_status."""

from bob_emploi.data_analysis.importer import importers


def register() -> None:
    """Register a plug-in for test purposes."""

    importers.register_importer('plugged-in', importers.Importer(
        name='A plugged-in importer', script=None, args=None, is_imported=False,
        run_every=None, proto_type=None, key='user_id', has_pii=True))

    importers.update_importer('job_group_info', script='some-script', args={})
