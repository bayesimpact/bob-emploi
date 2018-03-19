'use strict'

import jsonConfig from './dist.json'

// Documentation for the configs in JSON:
// - amplitudeToken: configured in https://www.amplitude.com/app/159830/manage.
// - facebookSSOAppId: configured in
//   https://developers.facebook.com/apps/1576288225722008/dashboard/
// - googleSSOClientId: configured in
//   https://console.cloud.google.com/apis/credentials?project=bob-emploi
//   When serving from a new host or a new port, you'll need to update the page
//   above to include it as an authorized Javascript source.
// - googleUAID: configured in https://analytics.google.com/analytics/web
// - linkedInClientId: configured in
//   https://www.linkedin.com/developer/apps/4800174/auth
//   When serving from a new host or a new port, you'll need to update the page
//   above to include it as an authorized Javascript source.
// - sentryDSN: configured in
//   https://sentry.io/bayes-impact/bob-emploi/settings/install/javascript-react/
//   You need to log in with florian@bayes.org Ask password to Florian, as we
//   have only one user in our current plan.  The dashboard is in:
//   https://sentry.io/bayes-impact/bob-emploi/

const config = {
  ...jsonConfig,
  donationUrl: 'https://www.helloasso.com/associations/bayes-impact-france/formulaires/3',
  emploiStoreClientId:
    'PAR_bobemploi_be1afe53827b15e37c95e9439c7429936c74876cbc1ff3d42d6f28ca78676825',
  githubSourceLink: 'https://github.com/bayesimpact/bob-emploi',
  helpRequestUrl: 'https://aide.bob-emploi.fr/hc/fr/requests/new',
  jobGroupImageSmallUrl: 'https://storage.gra1.cloud.ovh.net/v1/AUTH_7b9ade05d5f84f719adc2cbc76c07eec/Cover%20Images/small/ROME_ID.jpg',
  jobGroupImageUrl: 'https://storage.gra1.cloud.ovh.net/v1/AUTH_7b9ade05d5f84f719adc2cbc76c07eec/Cover%20Images/ROME_ID.jpg',
  productName: 'Bob',
  zendeskDomain: 'aide.bob-emploi.fr',
}

export default config
