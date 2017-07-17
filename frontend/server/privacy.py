"""Modules to ensure privacy in the Bob emploi app."""
from google.protobuf import timestamp_pb2

from bob_emploi.frontend.api import options_pb2


def anonymize_proto(proto, field_usages_to_clear=None):
    """Anonymize a proto by modifying sensitive fields."""
    is_modified = False
    if not field_usages_to_clear:
        field_usages_to_clear = {options_pb2.PERSONAL_IDENTIFIER}
    fields_to_clear = set()
    for field_descriptor, value in proto.ListFields():
        # Clear fields that are sensitive.
        field_usage = field_descriptor.GetOptions().Extensions[options_pb2.field_usage]
        if field_usage in field_usages_to_clear:
            fields_to_clear.add(field_descriptor.name)
            continue

        # Clear any details smaller than the hour in timestamps.
        if field_descriptor.message_type == timestamp_pb2.Timestamp.DESCRIPTOR:
            value_datetime = value.ToDatetime()
            trunked_value_datetime = value_datetime.replace(minute=0, second=0, microsecond=0)
            value.FromDatetime(trunked_value_datetime)
            is_modified = True
            continue

        # Recursively anonymize the sub-messages.
        if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
            if hasattr(value, 'DESCRIPTOR'):
                is_modified |= anonymize_proto(value, field_usages_to_clear=field_usages_to_clear)
            else:
                for repeated_value in value:
                    if not hasattr(repeated_value, 'DESCRIPTOR'):
                        # value is actually a ScalarMap.
                        break
                    is_modified |= anonymize_proto(
                        repeated_value, field_usages_to_clear=field_usages_to_clear)

    for field_name in fields_to_clear:
        is_modified = True
        proto.ClearField(field_name)

    return is_modified
