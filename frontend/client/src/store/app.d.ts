interface InitialFeatures {
  [featureName: string]: 'ACTIVE' | 'CONTROL' | true
}


type ValidDiagnosticComment = bayes.bob.DiagnosticComment & {field: bayes.bob.ProjectOrProfileField}


interface AppState {
  adviceData: {[adviceId: string]: {[projectId: string]: {}}}
  adviceTips?: {[adviceId: string]: {[projectId: string]: readonly {actionId: string}[]}}
  applicationModes?: {[romeId: string]: {[fap: string]: bayes.bob.RecruitingModesDistribution}}
  authToken?: string
  defaultProjectProps?: {}
  demo?: keyof bayes.bob.Features
  diagnosticCategories?: {[key: string]: readonly bayes.bob.DiagnosticCategory[]}
  hasLoadedApp?: boolean
  hasSeenComment?: {
    [commentKey: string]: true
  }
  hasSeenShareModal?: boolean
  hasTokenExpired?: boolean
  initialFeatures?: InitialFeatures
  initialUtm?: {}
  isMobileVersion?: boolean
  jobRequirements?: {[codeOgr: string]: bayes.bob.JobRequirements}
  laborStats?: {[projectId: string]: bayes.bob.LaborStatsData}
  lastAccessAt?: string
  loginModal?: {
    defaultValues?: {
      email?: string
      isReturningUser?: boolean
      resetToken?: string
    }
  }
  quickDiagnostic?: {
    after: {
      [field in bayes.bob.ProjectOrProfileField]?: ValidDiagnosticComment
    }
    before: {
      [field in bayes.bob.ProjectOrProfileField]?: ValidDiagnosticComment
    }
  }
  specificJobs?: {
    [romeId: string]: bayes.bob.JobGroup
  }
  userHasAcceptedCookiesUsage?: boolean
}

interface AsyncState<AllActions extends {type: string}> {
  authMethod?: string
  errorMessage?: string
  // TODO(pascal): Restrict to asynchronous action types.
  isFetching: {[actionType in AllActions['type']]?: boolean}
  pendingFetch: {[key: string]: Promise<{}>}
}
