interface InitialFeatures {
  [featureName: string]: 'ACTIVE' | 'CONTROL' | true
}


interface AppState {
  adviceData: {[adviceId: string]: {[projectId: string]: {}}}
  adviceTips?: {[adviceId: string]: {[projectId: string]: readonly {actionId: string}[]}}
  applicationModes?: {[romeId: string]: {[fap: string]: bayes.bob.RecruitingModesDistribution}}
  authToken?: string
  defaultProjectProps?: {}
  demo?: string
  hasLoadedApp?: boolean
  hasSeenShareModal?: boolean
  hasTokenExpired?: boolean
  initialFeatures?: InitialFeatures
  initialUtm?: {}
  isMobileVersion?: boolean
  jobRequirements?: {[codeOgr: string]: {
    diplomas: readonly string[]
    drivingLicenses: readonly string[]
  }}
  laborStats?: {[projectId: string]: bayes.bob.LaborStatsData}
  lastAccessAt?: string
  loginModal?: {
    defaultValues?: {
      email?: string
      isReturningUser?: boolean
      resetToken?: string
    }
  }
  newProjectProps?: {}
  quickDiagnostic?: {
    after: {}
    before: {}
  }
  specificJobs?: {}
  submetricsExpansion?: {}
  userHasAcceptedCookiesUsage?: boolean
}

interface AsyncState<AllActions extends {type: string}> {
  authMethod?: string
  errorMessage?: string
  isFetching: {[actionType in AllActions['type']]?: boolean}
}
