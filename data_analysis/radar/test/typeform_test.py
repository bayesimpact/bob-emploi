"""Unit test for Radar's typeform module."""

import json
import os
import shutil
import tempfile
import unittest
from unittest import mock

import requests_mock

from bob_emploi.data_analysis.radar import typeform_radar


@requests_mock.mock()
@mock.patch.dict(os.environ, {'TYPEFORM_API_KEY': 'fake-api-key'})
class IterateResultTests(unittest.TestCase):
    """Tests for iterating on results."""

    def test_iterate_results(self, mock_requests: requests_mock.Mocker) -> None:
        """Test the iterate_results function."""

        iterator = typeform_radar.iterate_results()

        mock_requests.get('https://api.typeform.com/forms/VAj8bEvq/responses', json={
            'items': [{
                'landing_id': 'kxhvvsu44of1kuh553ykxhvvq90qyz18',
                'token': 'kxhvvsu44of1kuh553ykxhvvq90qyz18',
                'response_id': 'kxhvvsu44of1kuh553ykxhvvq90qyz18',
                'hidden': {'age': '24', 'counselor_id': '14844'},
                'answers': [
                    {
                        'field': {
                            'id': '3fiBjnhAwJMQ',
                            'ref': 'job-people',
                            'type': 'picture_choice',
                        },
                        'type': 'choice',
                        'choice': {'id': 'yZDWYVJV2eFK', 'label': 'Niveau 3'},
                    },
                    {
                        'field': {
                            'id': 'd7R523jmQchm',
                            'ref': 'job-tools',
                            'type': 'picture_choice',
                        },
                        'type': 'choice',
                        'choice': {
                            'id': 'W19b0lJceawQ',
                            'label': 'Niveau 4',
                        },
                    },
                ],
            }]
        })
        mock_requests.get('https://api.typeform.com/forms/VAj8bEvq/responses?before=kxhvvsu44of1kuh553ykxhvvq90qyz18', json={
            'items': [{
                'landing_id': 'wbo3c0ukk4e8xpzgwbo3c0arqxkwsk26',
                'token': 'wbo3c0ukk4e8xpzgwbo3c0arqxkwsk26',
                'response_id': 'wbo3c0ukk4e8xpzgwbo3c0arqxkwsk26',
                'hidden': {'age': '22', 'counselor_id': '14844'},
            }]
        })
        mock_requests.get(
            'https://api.typeform.com/forms/VAj8bEvq/responses?before=wbo3c0ukk4e8xpzgwbo3c0arqxkwsk26',
            json={'items': []},
        )
        mock_requests.get('https://api.typeform.com/forms/beviMNpK/responses', json={
            'items': [{
                'landing_id': 'abcdefghijklmnopqrstuvwxyz',
                'token': 'abcdefghijklmnopqrstuvwxyz',
                'response_id': 'abcdefghijklmnopqrstuvwxyz',
                'hidden': {'age': '42', 'counselor_id': '14844'},
            }]
        })
        mock_requests.get(
            'https://api.typeform.com/forms/beviMNpK/responses?before=abcdefghijklmnopqrstuvwxyz',
            json={'items': []},
        )

        results = list(iterator)

        self.assertEqual(['24', '22', '42'], [r.hidden.age for r in results])
        self.assertEqual('job-tools', results[0].answers[1].field.ref)
        self.assertEqual('Niveau 4', results[0].answers[1].choice.label)


@requests_mock.mock()
class FormTests(unittest.TestCase):
    """Tests for uploading and downloading forms."""

    def setUp(self) -> None:
        super().setUp()
        self._tmpdir = tempfile.mkdtemp(prefix='tyepform-tests')

    def tearDown(self) -> None:
        shutil.rmtree(self._tmpdir)
        super().tearDown()

    def test_fetch_forms(self, mock_requests: requests_mock.Mocker) -> None:
        """Test the fetch_forms function."""

        mock_requests.get('https://api.typeform.com/forms/VAj8bEvq', json={
            'id': 'VAj8bEvq',
            'title': 'MILOrizons Demo',
        })
        mock_requests.get('https://api.typeform.com/forms/beviMNpK', json={
            'id': 'beviMNpK',
            'title': 'MILOrizons',
        })

        results = dict(typeform_radar.fetch_forms())

        self.assertEqual(
            {'beviMNpK': 'MILOrizons', 'VAj8bEvq': 'MILOrizons Demo'},
            {typeform_id: definition.get('title') for typeform_id, definition in results.items()},
            msg=results)

    def test_download_forms_in_folder(self, mock_requests: requests_mock.Mocker) -> None:
        """Download the files in a folder."""

        mock_requests.get('https://api.typeform.com/forms/VAj8bEvq', json={
            'id': 'VAj8bEvq',
            'title': 'MILOrizons Demo',
        })
        mock_requests.get('https://api.typeform.com/forms/beviMNpK', json={
            'id': 'beviMNpK',
            'title': 'MILOrizons',
        })

        typeform_radar.download_forms(output_path=self._tmpdir)

        files = os.listdir(self._tmpdir)
        self.assertEqual({'VAj8bEvq.json', 'beviMNpK.json'}, set(files))

        with open(os.path.join(self._tmpdir, 'beviMNpK.json'), 'r') as json_file:
            definition = json.load(json_file)
        self.assertEqual({
            'id': 'beviMNpK',
            'title': 'MILOrizons',
        }, definition)

    @mock.patch.dict(os.environ, {'TYPEFORM_API_KEY': 'fake-api-key'})
    def test_upload_forms(self, mock_requests: requests_mock.Mocker) -> None:
        """Upload the files from a folder."""

        with open(os.path.join(self._tmpdir, 'abcdef.json'), 'w') as json_file:
            json_file.write('{"id": "abcdef", "title": "Yipee"}')
        with open(os.path.join(self._tmpdir, 'README.md'), 'w') as md_file:
            md_file.write('Not related')

        mock_requests.put('https://api.typeform.com/forms/abcdef')

        typeform_radar.upload_forms(json_input_folder=self._tmpdir)

        self.assertEqual(1, mock_requests.call_count)
        self.assertEqual('Yipee', mock_requests.request_history[0].json().get('title'))

    @mock.patch.dict(os.environ, {'TYPEFORM_API_KEY': 'fake-api-key'})
    def test_upload_main(self, mock_requests: requests_mock.Mocker) -> None:
        """Use the main script to upload files."""

        mock_requests.put('https://api.typeform.com/forms/beviMNpK')
        mock_requests.put('https://api.typeform.com/forms/VAj8bEvq')

        typeform_radar.main(['upload'])

        self.assertEqual(2, mock_requests.call_count)

    def test_upload_missing_api_key(self, mock_requests: requests_mock.Mocker) -> None:
        """Try uploading without an API key."""

        mock_requests.put('https://api.typeform.com/forms/beviMNpK')
        mock_requests.put('https://api.typeform.com/forms/VAj8bEvq')

        with self.assertRaises(ValueError):
            typeform_radar.main(['upload'])

        self.assertFalse(mock_requests.called)


if __name__ == '__main__':
    unittest.main()
