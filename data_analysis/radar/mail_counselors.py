"""Mail Radar counselors that needs to fill the typeform again.

Prepare an export with:
  docker-compose run -e TYPEFORM_API_KEY --rm data-analysis-prepare \
    radar/mail_counselors.py
"""

import argparse
import collections
import datetime
import logging
import typing
from typing import Optional

from bob_emploi.common.python import now
# TODO(pascal): Move to common.
from bob_emploi.frontend.server.mail import mail_send
from bob_emploi.frontend.api.radar import typeform_pb2
from bob_emploi.data_analysis.radar import typeform_radar as typeform


class _Counselor(typing.NamedTuple):
    email: str
    name: str
    last_name: str
    locale: str


def main(string_args: Optional[list[str]] = None) -> None:
    """Email Radar counselors."""

    parser = argparse.ArgumentParser(
        description='Export Radar documents to ElasticSearch for Kibana.')
    parser.add_argument(
        '--ignore-before', type=str,
        help='If the typeform data contains unrelated old photos, ignore the photos before this '
        'date (2021-03-01 format).')
    parser.add_argument(
        '--months-since-last-photo', type=int, default=2,
        help='Minimum number of months since last photo to send an email.')
    parser.add_argument('--dry-run', action='store_true', help='Do not send any emails')
    args = parser.parse_args(string_args)

    logging.basicConfig(level='INFO' if args.dry_run else 'WARNING')

    campaign_start_at = now.get() - datetime.timedelta(days=30 * args.months_since_last_photo)
    ignore_before = datetime.datetime.strptime(args.ignore_before, '%Y-%m-%d') \
        if args.ignore_before else None

    photos_per_young: dict[str, list[typeform_pb2.Photo]] = collections.defaultdict(list)
    for photo in typeform.iterate_results():
        if ignore_before and photo.submitted_at.ToDatetime() < ignore_before:
            continue
        if not photo.hidden.dossier_id:
            logging.warning('Photo with no dossier ID.')
            continue
        photos_per_young[photo.hidden.dossier_id].append(photo)

    youngs_per_counselor: dict[str, list[typeform_pb2.Photo]] = collections.defaultdict(list)
    for dossier_id, photos in photos_per_young.items():
        latest_photo_at = max(photo.submitted_at.ToDatetime() for photo in photos)
        if latest_photo_at >= campaign_start_at:
            # we have a recent photo.
            continue
        try:
            counselor_email = next(
                photo.hidden.counselor_email
                for photo in photos if photo.hidden.counselor_email
            )
        except StopIteration:
            logging.warning('We have no counselor email address for "%s".', dossier_id)
            continue

        if '@' not in counselor_email:
            logging.warning('Wrong email address for counselor: %s', counselor_email)
            continue

        latest_photo = typeform_pb2.Photo()
        latest_photo.hidden.dossier_id = dossier_id
        latest_photo.submitted_at.FromDatetime(latest_photo_at)
        youngs_per_counselor[counselor_email].append(latest_photo)

    for counselor_email, photos in youngs_per_counselor.items():
        dossier_ids = [photo.hidden.dossier_id for photo in photos]
        latest_photo_at = max(photo.submitted_at.ToDatetime() for photo in photos)
        latest_photo_str = latest_photo_at.strftime('%Y-%m-%d')
        if args.dry_run:
            logging.info(
                'Sending an email to %s for %s (latest photo on %s)',
                counselor_email, dossier_ids, latest_photo_str)
            continue

        mail_send.send_template(
            # TODO(pascal): Fix the interface of this call.
            campaign_id=typing.cast(mail_send.mailjet_templates.Id, 'open-session'),
            recipient=_Counselor(
                email=counselor_email,
                name='',
                last_name='',
                locale='fr',
            ),
            template_vars={
                'dateDeLaPhotoPrecedente': latest_photo_str,
                'idsJeunes': dossier_ids,
                'prenom': '',
            },
            sender_email='milorizons@bayesimpact.org',
            sender_name='Équipe MILORizons',
            # TODO(pascal): Get from mailjet.json.
            template_id=2974499,
        )


if __name__ == '__main__':
    main()
