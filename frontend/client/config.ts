// The value here is just a placeholder as the real values are in colors.json5. However it helps
// to ensure proper typing.
type ConfigColor = '#1888ff'
type Colors = Record<keyof typeof import('/tmp/bob_emploi/colors.json'), ConfigColor>

// TODO(cyrille): Separate different kinds of constants in sub-objects.
interface Config {
  // TODO(cyrille): Move as override in ali plugin.
  readonly aliAmplitudeToken: string
  readonly amplitudeToken: string
  readonly canonicalUrl: string
  readonly citySuggestAlgoliaIndex: string
  readonly clientVersion: string
  // country ID is used for translation contexts
  readonly countryId: string
  // Name of the SVG file in images/maps. See doc in src/images/maps/README.md
  readonly countryMapName: string
  // countryName is used for Google search terms
  readonly countryName: string
  readonly currencySign: string
  readonly dataSourceAutomation: string
  readonly dataSourceLMI: string
  readonly departementSuggestAlgoliaIndex: string
  readonly donationUrl: string
  // URL of the landing page of the product when we don't use Bob's.
  readonly externalLandingPageUrl: string
  readonly defaultLang: string
  readonly emploiStoreClientId: string
  // Name of the external website with LMI (in the sentence "a {{externalLmiSiteName}} website").
  readonly externalLmiSiteName: string
  // Link to an external page with LMI. You can use backticks and reference to job and city to
  // create deep links.
  readonly externalLmiUrl: string
  readonly facebookPixelID: string
  readonly facebookSSOAppId: string
  readonly findOtherActivitiesUrl: string
  readonly frustrationOptionsExcluded: readonly string[]
  // geoAdminNames are used to handle different geographic zone names (région/département)
  readonly geoAdmin1Name: string
  readonly geoAdmin2Name: string
  readonly githubSourceLink: string
  readonly googleSSOClientId: string
  readonly googleTopLevelDomain: string
  readonly googleUAID: string
  // A Google Tag Manager ID, to track only real users (guests or account).
  readonly googleTMID: string
  readonly grossToNet: number
  // A URL where users can find the contact of their counselor for their handicap situation.
  readonly handicapCounselorUrl: string
  readonly hasCovidBanner: boolean
  readonly helpRequestUrl: string
  readonly hasVAEData: boolean
  readonly hoursPerWeek: number
  readonly isActionPlanEnabled: boolean
  readonly isCoachingEnabled: boolean
  readonly isCurrencySignPrefixed: boolean
  readonly isDark: boolean
  readonly isEmploiStoreEnabled: boolean
  readonly isLmiInBeta: boolean
  readonly isLoginEnabled: boolean
  readonly isRaceEnabled: boolean
  readonly isSimpleOnboardingEnabled: boolean
  readonly isStableDemo: boolean
  readonly isVeteranEnabled: boolean
  readonly jobGroupImageSmallUrl: string
  readonly jobGroupImageUrl: string
  readonly jobSuggestAlgoliaIndex: string
  readonly linkedInClientId: string
  readonly npsSurvey: 'short' | 'full'
  readonly orgName: string
  readonly originOptionsExcluded: readonly bayes.bob.UserOrigin[]
  // URL to go after showing the diagnostic.
  readonly postDiagnosticUrl: string
  readonly productName: string
  readonly projectEmploymentTypeOptionsExcluded: readonly bayes.bob.EmploymentType[]
  readonly radarProductName: string
  // eslint-disable-next-line max-len
  readonly salaryUnitOptionsExcluded: readonly Exclude<bayes.bob.SalaryUnit, 'ANNUAL_GROSS_SALARY'|'UNKNOWN_SALARY_UNIT'>[]
  readonly sentryDSN: string
  readonly spontaneousApplicationSource: string
  readonly zendeskDomain: string
}

export type {ConfigColor, Colors, Config}
