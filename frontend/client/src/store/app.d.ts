interface InitialFeatures {
  [featureName: string]: 'ACTIVE' | 'CONTROL' | true
}


type ValidDiagnosticComment = bayes.bob.DiagnosticComment & {field: bayes.bob.ProjectOrProfileField}
type ValidMainChallenge = bayes.bob.DiagnosticMainChallenge & {categoryId: string}

interface ValidUpskillingJob extends bayes.upskilling.Job {
  jobGroup: bayes.bob.JobGroup & {romeId: string}
}

interface AppState {
  adviceData: {[adviceId: string]: {[projectId: string]: unknown}}
  adviceTips?: {[adviceId: string]: {[projectId: string]: readonly {actionId: string}[]}}
  applicationModes?: {[romeId: string]: {[fap: string]: bayes.bob.RecruitingModesDistribution}}
  areAdsCookieUsageRequested?: boolean
  authToken?: string
  defaultProjectProps?: bayes.bob.Project
  diagnosticMainChallenges?: {[key: string]: bayes.bob.DiagnosticMainChallenges}
  experiments?: readonly (keyof bayes.bob.Features)[]
  hasLoadedApp?: boolean
  hasSeenComment?: {
    [commentKey: string]: true
  }
  hasSeenShareModal?: boolean
  hasTokenExpired?: boolean
  hasVolunteeredFeedback?: boolean
  initialFeatures?: InitialFeatures
  initialUtm?: bayes.bob.TrackingParameters
  jobGroupInfos?: {[romeId: string]: bayes.bob.JobGroup}
  jobRequirements?: {[codeOgr: string]: bayes.bob.JobRequirements}
  laborStats?: {[projectId: string]: bayes.bob.LaborStatsData}
  lastAccessAt?: string
  localStats?: {[localId: string]: bayes.bob.LocalJobStats}
  loginModal?: {
    defaultValues?: {
      email?: string
      isReturningUser?: boolean
      resetToken?: string
    }
  }
  mainChallengesUserCount?: {[categoryId: string]: number}
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
}
