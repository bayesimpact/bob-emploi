"""Modules to ensure privacy in the Bob app."""

from google.protobuf import timestamp_pb2

from bob_emploi.frontend.server import proto
from bob_emploi.frontend.api import options_pb2
from bob_emploi.frontend.api import use_case_pb2


def _iter_sensitive_fields(message, field_usages_to_yield):
    """Iterate recursively through all fields of a proto message to find sensitive fields."""

    for field_descriptor, value in message.ListFields():
        field_usage = field_descriptor.GetOptions().Extensions[options_pb2.field_usage]
        if field_usage in field_usages_to_yield:
            yield message, field_descriptor
            continue

        # Timestamp are always considered as sensitive.
        if field_descriptor.message_type == timestamp_pb2.Timestamp.DESCRIPTOR:
            yield message, field_descriptor
            continue

        if field_descriptor.type == field_descriptor.TYPE_MESSAGE:
            if hasattr(value, 'DESCRIPTOR'):
                for field in _iter_sensitive_fields(value, field_usages_to_yield):
                    yield field
            else:
                for repeated_value in value:
                    if not hasattr(repeated_value, 'DESCRIPTOR'):
                        # value is actually a ScalarMap.
                        break
                    for field in _iter_sensitive_fields(repeated_value, field_usages_to_yield):
                        yield field


def anonymize_proto(root_message, field_usages_to_clear=None):
    """Anonymize a proto message by modifying sensitive fields."""

    if not field_usages_to_clear:
        field_usages_to_clear = {options_pb2.PERSONAL_IDENTIFIER}

    sensitive_fields = list(_iter_sensitive_fields(root_message, field_usages_to_clear))

    for message, field_descriptor in sensitive_fields:
        # Clear any details smaller than the hour in timestamps.
        if field_descriptor.message_type == timestamp_pb2.Timestamp.DESCRIPTOR:
            value = getattr(message, field_descriptor.name)
            value_datetime = value.ToDatetime()
            trunked_value_datetime = value_datetime.replace(minute=0, second=0, microsecond=0)
            value.FromDatetime(trunked_value_datetime)
            continue

        message.ClearField(field_descriptor.name)

    return bool(sensitive_fields)


def redact_proto(root_message, redact_string='REDACTED', redact_int=0):
    """Redact all fields of a proto message that could indicate a real user."""

    sensitive_fields = _iter_sensitive_fields(root_message, {options_pb2.PERSONAL_IDENTIFIER})
    for message, field_descriptor in sensitive_fields:
        if field_descriptor.message_type == timestamp_pb2.Timestamp.DESCRIPTOR:
            # OK to keep full timestamps when redacting.
            continue
        if field_descriptor.type == field_descriptor.TYPE_STRING:
            setattr(message, field_descriptor.name, redact_string)
            continue
        int_types = {
            field_descriptor.TYPE_FIXED32,
            field_descriptor.TYPE_FIXED64,
            field_descriptor.TYPE_INT32,
            field_descriptor.TYPE_INT64,
            field_descriptor.TYPE_SFIXED32,
            field_descriptor.TYPE_SFIXED64,
            field_descriptor.TYPE_SINT32,
            field_descriptor.TYPE_SINT64,
            field_descriptor.TYPE_UINT32,
            field_descriptor.TYPE_UINT64,
        }
        if field_descriptor.type in int_types:
            setattr(message, field_descriptor.name, redact_int)
            continue
        # Redacting PERSONAL_IDENTIFIER fields only works on strings and ints
        # for now. If we introduce new types of PERSONAL_IDENTIFIER fields, we
        # have to handle them here.
        raise TypeError(
            'PERSONAL_IDENTIFIER field "{}" is not a string'.format(field_descriptor.name))


def user_to_use_case(user, pool_name, index_in_pool):
    """Extracts a use case from a real user."""

    use_case = use_case_pb2.UseCase()
    if not proto.parse_from_mongo(user, use_case.user_data):
        return None
    use_case.title = next((p.title for p in use_case.user_data.projects), '')
    anonymize_proto(use_case.user_data, field_usages_to_clear={
        options_pb2.PERSONAL_IDENTIFIER, options_pb2.APP_ONLY, options_pb2.ALGORITHM_RESULT,
    })
    use_case.pool_name = pool_name
    use_case.index_in_pool = index_in_pool
    use_case.use_case_id = '{}_{:02x}'.format(pool_name, index_in_pool)
    return use_case
