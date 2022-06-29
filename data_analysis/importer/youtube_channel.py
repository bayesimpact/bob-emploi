"""Importer for title and videos from YouTube playlists of a given channel."""

import argparse
import csv
import os
import re
import sys
import typing
from typing import Any, Iterable, Literal, Optional, Pattern, Sequence, Tuple, TypedDict

import googleapiclient.discovery

if typing.TYPE_CHECKING:
    class _PlaylistItemResourceId(TypedDict):
        kind: Literal['youtube#video']
        videoId: str

    class _Snippet(TypedDict):
        resourceId: _PlaylistItemResourceId
        title: str

    class _PlaylistItem(TypedDict):
        kind: Literal['youtube#playlistItem']
        snippet: _Snippet

    class _Playlist(TypedDict):
        id: str
        snippet: _Snippet


class YouTubeAPI:
    """Client for YouTube Data API."""

    def __init__(self) -> None:
        developer_key = os.getenv('GOOGLE_APPLICATION_DEVELOPER_KEY')
        self._api = googleapiclient.discovery.build(
            'youtube', 'v3', developerKey=developer_key)

    def _list_all_pages(self, service: str, **kwargs: Any) -> Iterable[Iterable[Any]]:
        youtube = getattr(self._api, service)()
        request = youtube.list(**kwargs)
        response = request.execute()
        yield response.get('items', [])

        while response.get('nextPageToken'):
            request = youtube.list_next(previous_request=request, previous_response=response)
            response = request.execute()
            yield response.get('items', [])

    def list_playlist_items(self, playlist_id: str) -> Iterable['_PlaylistItem']:
        """List all items of a playlist."""

        for items in self._list_all_pages(
                'playlistItems', part='id,snippet', playlistId=playlist_id):
            for item in items:
                yield typing.cast('_PlaylistItem', item)

    def list_playlists(self, channel_id: str) -> Iterable['_Playlist']:
        """List all playlists of a channel."""

        for playlists in self._list_all_pages(
                'playlists', part='id,snippet', channelId=channel_id):
            for playlist in playlists:
                yield typing.cast('_Playlist', playlist)

    def list_all_items(self, channel_id: str, filter_pattern: Pattern[str]) \
            -> Iterable[Tuple['_Playlist', '_PlaylistItem']]:
        """List all items of all playlists of a channel."""

        for playlist in self.list_playlists(channel_id):
            if not filter_pattern.match(playlist['snippet']['title']):
                continue
            for item in self.list_playlist_items(playlist['id']):
                yield playlist, item


def main(args: Optional[Sequence[str]] = None) -> None:
    """Download the title and video IDs of a YouTube channel."""

    parser = argparse.ArgumentParser(
        description='Importer for title and videos from YouTube playlists of a given channel',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    parser.add_argument(
        'channel_id', help='ID of the YouTube channel to download.', nargs='?')
    parser.add_argument(
        '--filter_playlist_title', help='Regular expression to filter the playlist by title',
        default='.*')

    flags = parser.parse_args(args)

    youtube = YouTubeAPI()
    all_items = youtube.list_all_items(
        flags.channel_id, re.compile(flags.filter_playlist_title, re.IGNORECASE))
    writer = csv.writer(sys.stdout, lineterminator='\n')
    writer.writerow(('Video ID', 'Title', 'URL'))
    for unused_playlist, item in all_items:
        video_id = item['snippet']['resourceId']['videoId']
        writer.writerow((video_id, item['snippet']['title'], f'https://youtu.be/{video_id}'))


if __name__ == '__main__':
    main()
