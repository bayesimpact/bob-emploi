
declare namespace color {
  type JobflixColors =
    Record<keyof typeof import('/tmp/bob_emploi/jobflix_colors.json'), import('config').ConfigColor>
  // The interface is actually extended with CoreColors in frontend/client/custom.d.ts.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Colors extends JobflixColors {}
}

declare namespace configuration {
  interface Config {
    areaSuggest: bayes.bob.AreaType
    coachingType: 'coach' | 'counselor'
    font: string
    hasDeploymentImages?: boolean
    hasLogo: boolean
    hasOCR: boolean
    hasRoundEdges: boolean
    // TODO(cyrille): Use a more proper way to do this.
    hasTProHeader: boolean
    // What users are expected to look for. It is a context to be used in i18next.
    goalWordingContext: 'promising-job' | 'career'
    hasUpskillingCoaching: boolean
    isJobRounded: boolean
    isMenuProfile: boolean
    isSelectedFavoriteWording: boolean
    jobMoreInfoUrl: string
    jobOffersUrl: string
    // URL to open when clicking on the logo.
    logoUrl: string
    menuLink: string
    prodDistinctiveFragment: string
    // The region where the search should be restricted.
    regionId: string
    // Whether we should show salary as a min/max fork, or a single estimate.
    showSalaryFork: boolean
    titleFont: string
    // used to set the right training URL for a job.
    trainingLinkTemplate: string
    // DEPRECATED. Use trainingLinkTemplate only instead.
    trainingPartner: 'cpf'|'via-competences'|'national-careers'
    useLMI4All: boolean
  }
}

declare module '*/open_classrooms.json5' {
  const section: bayes.upskilling.Section & {
    id: string
    isOCR: true
    jobs: readonly ValidUpskillingJob[]
    name: string
  }
  export default section
}

// TODO(cyrille): Find a way to get this from src/deployments/types.
declare module 'plugin/deployment/favicon' {
  const url: string
  export default url
}

declare module 'plugin/deployment/welcome_header' {
  const Header: React.ComponentType
  export default Header
}

declare module 'plugin/deployment/coaching_modal' {
  const Modal: React.ComponentType
  export default Modal
}

declare module 'plugin/deployment/netflix_banner' {
  const Banner: React.ComponentType
  export default Banner
}

declare module 'plugin/deployment/welcome_background' {
  const url: string
  export default url
}

declare module 'plugin/deployment/training_link' {
  const createTrainingLink: (job: ValidUpskillingJob, city: bayes.bob.FrenchCity) => Promise<string>
  export default createTrainingLink
}
