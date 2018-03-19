# encoding: utf-8
"""End to end test for the onboarding flow.

As opposed to unit tests, we should only check real case scenario, and
regression tests. Do not test all corner cases: that should happen in component
or unit tests.
"""
import os
import unittest

import splinter


# TODO: Add test for actual onboarding.
class OnboardingTestCase(unittest.TestCase):
    """End-to-end tests for onboarding."""

    @classmethod
    def setUpClass(cls):
        """Initialize - get browser."""
        cls.browser = splinter.Browser('phantomjs')
        cls.base_url = os.getenv('BASE_URL', 'http://frontend')

    def _find_by_placeholder(self, placeholder):
        return self.browser.find_by_css('input[placeholder="%s"]' % placeholder)

    def _find_by_partial_text(self, text):
        return self.browser.find_by_xpath('//*[contains(text(), "%s")]' % text)

    def test_no_console_output(self):
        """Test that there is nothing (no errors) on the javascript console."""
        self.browser.visit(self.base_url + '/')
        console_log = self.browser.driver.get_log('browser')
        self.assertFalse(console_log)

if __name__ == '__main__':
    unittest.main()
