"""Tests on Dockerfiles."""
from os import path
import unittest

_BLOCK_SEPARATOR = '\n\n'
# Prefix of blocks that are allowed to be only in Dockerfile.test.
_TEST_BLOCK_PREFIX = '# TEST ONLY.\n'


class SyncTestCase(unittest.TestCase):
    """Test that Dockerfile and Dockerfile.test are in sync.

    In order to run test as close as possible to the real environment we want
    to build almost the same Docker images, only adding what's needed for
    testing.
    """

    def test_sync(self):
        """Dockerfiles are in sync."""
        self.maxDiff = None  # pylint: disable=invalid-name
        dockerfile = [
            block.replace('COPY ', 'COPY frontend/server/')
            for block in _read_blocks('Dockerfile')
        ]
        dockerfile_test = [
            block for block in _read_blocks('Dockerfile.test')
            if not block.startswith(_TEST_BLOCK_PREFIX)
        ]
        self.assertEqual(
            _BLOCK_SEPARATOR.join(dockerfile),
            _BLOCK_SEPARATOR.join(dockerfile_test),
            msg='Keep Dockerfile and Dockerfile.test in sync.',
        )


def _read_blocks(filename):
    with open(path.join(path.dirname(path.dirname(__file__)), filename), 'r') as file_handle:
        file_content = file_handle.read()
    return [block.strip() for block in file_content.split(_BLOCK_SEPARATOR)]


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
