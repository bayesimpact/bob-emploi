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

declare module '*.svg?stroke=%239596a0' {
  const content: string
  export default content
}

declare module '*.svg?stroke=%23fff' {
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

declare module '*/static_i18n?static' {
  const content: () => Promise<import('i18next').TFunction>
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
    diagnosticMainChallenges: Table
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

declare namespace color {
  type CoreColors = import('config').Colors
  // Need an interface (instead of a type) to be mergeable in plugins.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Colors extends CoreColors {}
}

declare namespace configuration {
  type CoreConfig = import('config').Config
  // Need an interface (instead of a type) to be mergeable in plugins.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Config extends CoreConfig {}
}

// Map of colors used in the app.
declare const colors: color.Colors
declare const colorsMap: color.Colors

declare const config: configuration.Config

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
