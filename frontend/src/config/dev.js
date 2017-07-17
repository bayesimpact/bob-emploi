'use strict'

// There is more documentation about those parameters in the dist config
// (./dist.js).
const config = {
  amplitudeToken: '84272c8018835dff932e59447cc33694',
  appEnv: 'dev',
  backendHostName: '',
  donationUrl: 'https://www.helloasso.com/associations/bayes-impact-france/formulaires/3',
  facebookSSOAppId: '1048782155234293',
  githubSourceLink: 'https://github.com/bayesimpact/bob-emploi',
  googleSSOClientId: '1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com',
  googleUAID: 'UA-97637389-2',
  helpRequestUrl: 'https://aide.bob-emploi.fr/hc/fr/requests/new',
  jobGroupImageUrl: 'https://storage.gra1.cloud.ovh.net/v1/AUTH_7b9ade05d5f84f719adc2cbc76c07eec/Cover%20Images/ROME_ID.jpg',
  productName: 'Bob emploi DEV',
  // The dashboard is in:
  // https://sentry.io/bayes-impact/bob-emploi-dev/
  // You need to log in with florian@bayes.org
  // Ask password to Florian, as we have only one user in our current plan.
  sentryDSN: 'https://3e822889b32a40b28722074cc68e1bc5@sentry.io/192128',
  zendeskDomain: 'bob-emploi.zendesk.com',
}

export default config
