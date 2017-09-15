"""Tests for the bob_emploi.frontend.opengraph module."""
import unittest
import xmltodict

from bob_emploi.frontend import base_test


class OpengraphTestCase(base_test.ServerTestCase):
    """Unit tests for opengraph endpoints."""

    def test_opengraph_transparency(self):
        """Check the /og/transparence endpoint"""
        response = self.app.get('/og/transparence')
        response_text = xmltodict.parse(response.get_data(as_text=True))
        response_head_dict = response_text['html']['head']
        response_meta_list = response_head_dict['meta']
        self.assertEqual(200, response.status_code, response_head_dict['title'])
        for meta in response_meta_list:
            if meta['@property'] == 'og:title':
                self.assertEqual(
                    'Bob Emploi - Transparence', meta['@content'])
            if meta['@property'] == 'og:description':
                self.assertIn(
                    'Bob Emploi en toute transparence', meta['@content'])
            if meta['@property'] == 'og:url':
                self.assertEqual(
                    'http://localhost/transparence', meta['@content'])

    def test_opengraph_mission(self):
        """Check the /og/notre-mission endpoint"""
        response = self.app.get('/og/notre-mission')
        response_text = xmltodict.parse(response.get_data(as_text=True))
        response_head_dict = response_text['html']['head']
        response_meta_list = response_head_dict['meta']
        self.assertEqual(200, response.status_code, response_text)
        for meta in response_meta_list:
            if meta['@property'] == 'og:title':
                self.assertEqual(
                    'Bob Emploi - Notre mission', meta['@content'])
            if meta['@property'] == 'og:description':
                self.assertIn(
                    'apporter des solutions aux problèmes de société', meta['@content'])
            if meta['@property'] == 'og:url':
                self.assertEqual(
                    'http://localhost/notre-mission', meta['@content'])

    def test_opengraph_privacy(self):
        """Check the /og/vie-privee endpoint"""
        response = self.app.get('/og/vie-privee')
        response_text = xmltodict.parse(response.get_data(as_text=True))
        response_head_dict = response_text['html']['head']
        response_meta_list = response_head_dict['meta']
        self.assertEqual(200, response.status_code, response_text)
        for meta in response_meta_list:
            if meta['@property'] == 'og:title':
                self.assertEqual(
                    'Bob Emploi - Vie privée', meta['@content'])
            if meta['@property'] == 'og:description':
                self.assertIn(
                    'meilleur niveau de protection', meta['@content'])
            if meta['@property'] == 'og:url':
                self.assertEqual(
                    'http://localhost/vie-privee', meta['@content'])

    def test_opengraph_contribution(self):
        """Check the /og/contribuer endpoint"""
        response = self.app.get('/og/contribuer')
        response_text = xmltodict.parse(response.get_data(as_text=True))
        response_head_dict = response_text['html']['head']
        response_meta_list = response_head_dict['meta']
        self.assertEqual(200, response.status_code, response_text)
        for meta in response_meta_list:
            if meta['@property'] == 'og:title':
                self.assertEqual(
                    'Bob Emploi - Contribuer', meta['@content'])
            if meta['@property'] == 'og:description':
                self.assertIn(
                    'Ensemble créons le service public', meta['@content'])
            if meta['@property'] == 'og:url':
                self.assertEqual(
                    'http://localhost/contribuer', meta['@content'])

    def test_opengraph_main(self):
        """Check the /og endpoint"""
        response = self.app.get('/og/')
        response_text = xmltodict.parse(response.get_data(as_text=True))
        response_head_dict = response_text['html']['head']
        response_meta_list = response_head_dict['meta']
        self.assertEqual(200, response.status_code, response_text)
        for meta in response_meta_list:
            if meta['@property'] == 'og:title':
                self.assertEqual(
                    'Bob Emploi', meta['@content'])
            if meta['@property'] == 'og:description':
                self.assertIn(
                    "Accélérez votre recherche d'emploi avec Bob Emploi.", meta['@content'])
            if meta['@property'] == 'og:url':
                self.assertEqual(
                    'http://localhost/', meta['@content'])


if __name__ == '__main__':
    unittest.main()  # pragma: no cover
