declare module '*.ico' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

// TODO(pascal): Solve those multiple declarations if https://stackoverflow.com/questions/56078811/
// gets an answer.
declare module '*.svg?fill=%23fff' {
  const content: string
  export default content
}

declare module '*.svg?fill=%23000' {
  const content: string
  export default content
}

declare module '*.svg?fill=%231888ff' {
  const content: string
  export default content
}

declare module '*.svg?stroke=%239596a0' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.txt' {
  const content: string
  export default content
}

declare module '*.pdf' {
  const content: string
  export default content
}

declare module '*/airtable_fields.json5' {
  interface Table {
    readonly altTable?: string
    readonly base: string
    readonly idField?: string
    readonly output: string
    readonly table: string
    readonly translatableFields?: readonly string[]
    readonly view?: string
  }

  const tables: {
    adviceModules: Table
    categories: Table
    emailTemplates: Table
    goals: Table
    vae: Table
  }

  export default tables
}

declare module '*/aux_pages_redirect' {
  const AUX_PAGES: readonly {
    readonly redirect: string
    readonly urlTest: RegExp
  }[]
  interface Request {
    readonly uri: string
  }
  interface Event {
    readonly Records: readonly {
      readonly cf: {
        readonly request: Request
      }
    }[]
  }
  const handler: (
    event: Event, context: unknown, callback: (err: Error, req: Request) => void,
  ) => void
  export {AUX_PAGES, handler}
}

interface RadiumCSSProperties extends React.CSSProperties {
  ':active'?: React.CSSProperties
  ':hover'?: React.CSSProperties
  ':focus'?: React.CSSProperties
}

type ReactStylableElement = React.ReactElement<{style?: RadiumCSSProperties}>

// The value here is just a placeholder as the real values are in colors.json5. However it helps
// to ensure proper typing.

type ConfigColor = '#1888ff'
type CoreColors = {[name in keyof typeof import('/tmp/bob_emploi/colors.json')]: ConfigColor}
// Need an interface (instead of a type) to be mergeable in plugins.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Colors extends CoreColors {}

// Map of colors used in the app.
declare const colors: Colors
declare const colorsMap: Colors

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
  readonly defaultLang: string
  // Name of the external website with LMI (in the sentence "a {{externalLmiSiteName}} website").
  readonly externalLmiSiteName: string
  // Link to an external page with LMI. You can use backticks and reference to job and city to
  // create deep links.
  readonly externalLmiUrl: string
  readonly facebookPixelID: string
  readonly facebookSSOAppId: string
  readonly findOtherActivitiesUrl: string
  readonly frustrationOptionsExcluded: readonly string[]
  readonly emploiStoreClientId: string
  // geoAdminNames are used to handle different geographic zone names (région/département)
  readonly geoAdmin1Name: string
  readonly geoAdmin2Name: string
  readonly githubSourceLink: string
  readonly googleSSOClientId: string
  readonly googleTopLevelDomain: string
  readonly googleUAID: string
  readonly grossToNet: number
  readonly helpRequestUrl: string
  readonly hasVAEData: boolean
  readonly hoursPerWeek: number
  readonly isCoachingEnabled: boolean
  readonly isCurrencySignPrefixed: boolean
  readonly isEmploiStoreEnabled: boolean
  readonly isLmiInBeta: boolean
  readonly jobGroupImageSmallUrl: string
  readonly jobGroupImageUrl: string
  readonly jobSuggestAlgoliaIndex: string
  readonly linkedInClientId: string
  readonly methodAssociationHelpFooterLink: string
  readonly methodAssociationHelpFooterUrl: string
  readonly npsSurvey: 'short' | 'full'
  readonly originOptionsExcluded: readonly bayes.bob.UserOrigin[]
  readonly productName: string
  readonly radarProductName: string
  readonly salaryUnitOptionsExcluded: readonly bayes.bob.SalaryUnit[]
  readonly sentryDSN: string
  readonly spontaneousApplicationSource: string
  readonly trainingFindName: string
  readonly trainingFindUrl: string
  readonly zendeskDomain: string
}
declare const config: Config

declare namespace download {
  interface AdviceModule {
    readonly goal: string
    readonly resourceTheme?: string
    readonly shortTitle: string
    readonly staticExplanations?: string
    readonly title: string
    readonly titleXStars: {readonly [num: string]: string}
    readonly userGainCallout?: string
    readonly userGainDetails?: string
  }

  type ClientFilter = 'for-experienced(2)'|'for-experienced(6)'

  interface EmailTemplate {
    readonly content: string
    readonly filters?: readonly ClientFilter[]
    readonly personalizations?: readonly string[]
    readonly reason?: string
    readonly title: string
  }

  interface StrategyGoal {
    readonly content: string
    readonly goalId: string
    readonly stepTitle: string
    readonly strategyIds?: readonly string[]
  }

  interface Illustration {
    readonly highlight: string
    readonly mainChallenges?: readonly string[]
    readonly text: string
  }

  interface ImpactMeasurement {
    readonly actionId: string
    readonly name: string
  }
}
