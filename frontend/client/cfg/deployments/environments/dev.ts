interface Constants extends Record<string, unknown> {
  productName: string
}

export default <T extends Constants>(
  name: string, constants: T, devConstants?: Record<string, unknown>,
): T => ({
  ...constants,
  aliAmplitudeToken: '84272c8018835dff932e59447cc33694',
  amplitudeToken: '84272c8018835dff932e59447cc33694',
  clientVersion: `dev.${name}`,
  facebookSSOAppId: constants.facebookSSOAppId && '1048782155234293',
  googleSSOClientId: constants.googleSSOClientId &&
    '1052239456978-tgef7mpqd3qoq723hag0v45035nqnivt.apps.googleusercontent.com',
  googleUAID: 'UA-97637389-2',
  linkedInClientId: constants.linkedInClientId && '86r4xh5py0mw9k',
  productName: constants.productName + ' DEV',
  radarProductName: constants.radarProductName + ' Dev',
  zendeskDomain: '',
  ...devConstants,
})
