"""Tests for the batch module."""

import unittest

from bob_emploi.data_analysis.lib import batch


class MatchTestCase(unittest.TestCase):
    """Tests for the batch_iterator function."""

    def test_batch_list(self) -> None:
        """Basic usage on a list."""

        list_to_iterate = list(range(120))
        batches = list(batch.batch_iterator(list_to_iterate, 10))
        self.assertEqual(12, len(batches))
        for each_batch in batches:
            self.assertEqual(10, len(each_batch))
        self.assertEqual(
            list_to_iterate, [a for each_batch in batches for a in each_batch])

    def test_batch_not_round_list(self) -> None:
        """Works with a smaller last batch if needed."""

        list_to_iterate = list(range(115))
        batches = list(batch.batch_iterator(list_to_iterate, 10))
        self.assertEqual(12, len(batches))
        self.assertEqual(
            list_to_iterate, [a for each_batch in batches for a in each_batch])
        last_batch = batches.pop()
        self.assertEqual([110, 111, 112, 113, 114], last_batch)
        for each_batch in batches:
            self.assertEqual(10, len(each_batch))

    def test_batch_iterator(self) -> None:
        """Basic usage on an iterator."""

        iterator = iter(range(120))
        batches = list(batch.batch_iterator(iterator, 10))
        expected_list = list(range(120))
        self.assertEqual(12, len(batches))
        for each_batch in batches:
            self.assertEqual(10, len(each_batch))
        self.assertEqual(
            expected_list, [a for each_batch in batches for a in each_batch])


if __name__ == '__main__':
    unittest.main()
