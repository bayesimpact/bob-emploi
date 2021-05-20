interface Constants extends Record<string, unknown> {
  productName: string
}

export default <T extends Constants>(
  name: string, constants: T, demoConstants?: Record<string, unknown>,
): T => ({
  ...constants,
  aliAmplitudeToken: 'c77cb214eabe0ef1bac27983d42f75f2',
  amplitudeToken: 'c77cb214eabe0ef1bac27983d42f75f2',
  clientVersion: `demo.${name}.${process.env.CLIENT_VERSION}`,
  // Do not set the demo Facebook ID, if Facebook id disactivated in prod for this deployment.
  facebookSSOAppId: constants.facebookSSOAppId && '1048782155234293',
  googleSSOClientId: constants.googleSSOClientId &&
    '1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com',
  googleUAID: 'UA-97637389-3',
  linkedInClientId: constants.linkedInClientId && '86r4xh5py0mw9k',
  radarProductName: constants.radarProductName + ' Demo',
  sentryDSN: 'https://d9678cbb35254964b47c21fb2010dff0:97f3f5eb78554dd88c740c0872b13039@sentry.io/218378',
  ...demoConstants,
})
