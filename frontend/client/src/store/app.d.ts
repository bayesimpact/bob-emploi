interface InitialFeatures {
  [featureName: string]: 'ACTIVE' | 'CONTROL' | true
}


interface AppState {
  adviceData: {[adviceId: string]: {[projectId: string]: {}}}
  adviceTips: {[adviceId: string]: {[projectId: string]: {actionId: string}[]}}
  applicationModes: {[romeId: string]: {[fap: string]: bayes.bob.RecruitingModesDistribution}}
  authToken: string
  defaultProjectProps: {}
  demo?: string
  hasSeenShareModal: boolean
  initialFeatures: InitialFeatures
  initialUtm: {}
  isMobileVersion: boolean
  jobRequirements: {[codeOgr: string]: {
    diplomas: string[]
    drivingLicenses: string[]
  }}
  lastAccessAt?: string
  loginModal: {
    defaultValues?: {
      email?: string
      isReturningUser?: boolean
      resetToken?: string
    }
  }
  newProjectProps: {}
  quickDiagnostic: {
    after: {}
    before: {}
  }
  specificJobs: {}
  submetricsExpansion: {}
  userHasAcceptedCookiesUsage: boolean
}

interface AsyncState {
  authMethod?: string
  errorMessage: string
  isFetching: {[actionType: string]: boolean}
}
