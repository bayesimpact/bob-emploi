"""Unit tests for the youtube_channel script."""

import contextlib
import io
import os
import textwrap
import unittest
from unittest import mock

from googleapiclient import discovery

from bob_emploi.data_analysis.importer import youtube_channel


@mock.patch.dict(os.environ, {'GOOGLE_APPLICATION_DEVELOPER_KEY': 'MyDeVkeY'})
class YoutubeChannelTest(unittest.TestCase):
    """Unit tests for the youtube_channel script."""

    @mock.patch(discovery.__name__ + '.build')
    def test_main(self, mock_googleapiclient: mock.MagicMock) -> None:
        """Test the main usage of the script."""

        mock_googleapiclient().playlists().list().execute.return_value = {'items': [
            {
                'snippet': {'title': 'Another playlist'},
                'id': 'Ccccc-playlist-id'
            },
            {
                'snippet': {'title': 'Test playlist'},
                'id': 'Bbbbb-playlist-id'
            },
        ]}
        mock_googleapiclient().playlists().list.reset_mock()

        mock_googleapiclient().playlistItems().list().execute.return_value = {
            'items': [{
                'snippet': {
                    'title': 'Video in test channel',
                    'resourceId': {'videoId': 'b1234'},
                },
            }],
            'nextPageToken': 'abcd-next-page'
        }
        mock_googleapiclient().playlistItems().list.reset_mock()
        mock_googleapiclient().playlistItems().list_next().execute.return_value = {'items': [
            {
                'snippet': {
                    'title': 'Video 2 in test channel',
                    'resourceId': {'videoId': 'b4567'},
                },
            },
        ]}
        mock_googleapiclient().playlistItems().list_next.reset_mock()
        mock_googleapiclient.reset_mock()

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            youtube_channel.main(['Aaaa-channel-id', '--filter_playlist_title', '^Test'])

        self.assertEqual(textwrap.dedent('''\
            Video ID,Title,URL
            b1234,Video in test channel,https://youtu.be/b1234
            b4567,Video 2 in test channel,https://youtu.be/b4567
        '''), output.getvalue())

        mock_googleapiclient.assert_called_once_with('youtube', 'v3', developerKey='MyDeVkeY')
        mock_googleapiclient().playlists().list.assert_called_once_with(
            part='id,snippet', channelId='Aaaa-channel-id')
        mock_googleapiclient().playlistItems().list.assert_called_once_with(
            part='id,snippet', playlistId='Bbbbb-playlist-id')


if __name__ == '__main__':
    unittest.main()
