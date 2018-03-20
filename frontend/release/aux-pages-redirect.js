'use strict'
// AWS Lambda @Edge script to redirect URLs going to auxiliary pages (i.e. not
// from the main app) to their respective entrypoints.
//
// We need that because those are actually single page applications that need
// to be served from various URLs by a static html pages.
// As those pages are rarely accessed, it's OK to run this quick lambda to find
// the page to serve.
//
// The source of this file is in bob-emploi-internal git repo:
// frontend/release/aux-pages-redirect.js
// and should be deployed using the frontend/release/deploy_lambda.sh script.

// List of URLs redirect to auxiliary pages.
// ATTENTION: Keep this in sync with nginx.conf.
const AUX_PAGES = [
  {
    redirect: '/bootstrap.html',
    urlTest: /^\/conseiller\/nouveau-profil-et-projet/,
  },
  {
    redirect: '/eval.html',
    urlTest: /^\/eval/,
  },
  {
    redirect: '/nps.html',
    urlTest: /^\/retours/,
  },
  {
    redirect: '/statut.html',
    urlTest: /^\/statut/,
  },
  {
    redirect: '/unsubscribe.html',
    urlTest: /^\/unsubscribe/,
  },
]

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request
  AUX_PAGES.forEach(({redirect, urlTest}) => {
    if (request.uri.match(urlTest)) {
      request.uri = redirect
    }
  })
  return callback(null, request)
}
