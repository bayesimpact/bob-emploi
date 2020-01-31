// AWS Lambda @Edge script to redirect URLs going to auxiliary pages (i.e. not
// from the main app) to their respective entrypoints.
//
// We need that because those are actually single page applications that need
// to be served from various URLs by a static html pages.
// As those pages are rarely accessed, it's OK to run this quick lambda to find
// the page to serve.
//
// The source of this file is in bob-emploi-internal git repo:
// frontend/release/aux_pages_redirect.js
// and should be deployed using the frontend/release/deploy_lambda.sh script.

// List of URLs redirect to auxiliary pages.
const AUX_PAGES = [
  {
    redirect: '/bootstrap.html',
    urlTest: /^\/conseiller\/(nouveau-profil-et-projet|ressources)/,
  },
  {
    redirect: '/eval.html',
    urlTest: /^\/eval/,
  },
  {
    redirect: '/mini-onboarding.html',
    urlTest: /^\/mini/,
  },
  {
    redirect: '/mini-onboarding.html',
    urlTest: /^\/unml\/a-li/,
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

// For testing only.
exports.AUX_PAGES = AUX_PAGES

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request
  AUX_PAGES.forEach(({redirect, urlTest}) => {
    if (request.uri.match(urlTest)) {
      request.uri = redirect
    }
  })
  return callback(null, request)
}
