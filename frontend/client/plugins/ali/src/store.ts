import {detect} from 'detect-browser'
import {Dispatch} from 'redux'
import {ThunkDispatch} from 'redux-thunk'

import {AsyncAction} from 'store/actions'

import {AnswerType} from './components/answers'
import {TopicId} from './components/questions_tree'

export const Routes = {
  BILAN_PAGE: '/bilan',
  HUB_PAGE: '/themes',
  LANDING_PAGE: '/commencer',
  PRIORITY_PATH: '/aborder/:topicUrl',
  QUESTION_PATH: '/:topicUrl/:questionUrl',
  THANKS_PAGE: '/merci',
  USER_LANDING_PAGE: '/presentation',
} as const


export type TopicPriority = boolean | 'later'


interface AnswerAction {
  answer: AnswerType
  question: string
  topic: TopicId
  type: 'MINI_ONBOARDING_ANSWER'
}


export interface DisplayToasterMessageAction {
  error: string
  type: 'MINI_DISPLAY_TOASTER_MESSAGE'
}


interface HideToasterMessageAction {
  type: 'MINI_HIDE_TOASTER_MESSAGE'
}


interface LoadAction {
  hash: string
  type: 'MINI_ONBOARDING_LOAD'
}

interface UnloadAction {
  type: 'MINI_ONBOARDING_UNLOAD'
}

interface RestartAction {
  type: 'MINI_ONBOARDING_RESTART'
}

interface GenerateSummaryAction {
  type: 'MINI_GENERATE_SUMMARY'
}

interface OpenSummaryAction {
  type: 'MINI_OPEN_SUMMARY'
}

interface PrintSummaryAction {
  type: 'MINI_PRINT_SUMMARY'
}

export interface OrgInfo {
  advisor: string
  city: bayes.bob.FrenchCity
  email: string
  milo: string
}

interface UpdateOrgInfo {
  orgInfo: Partial<OrgInfo>
  type: 'MINI_UPDATE_ORG_INFO'
}

interface SeeLandingAction {
  isUserSupervised: boolean
  type: 'MINI_ONBOARDING_FINISH_LANDING'
}


interface SetTopicPriorityAction {
  priority: TopicPriority
  topic: string
  type: 'MINI_ONBOARDING_SET_TOPIC_PRIORITY'
}

export type SaveAction = AsyncAction<'MINI_ONBOARDING_SAVE', void>


export type Action =
  | AnswerAction
  | DisplayToasterMessageAction
  | GenerateSummaryAction
  | HideToasterMessageAction
  | LoadAction
  | OpenSummaryAction
  | PrintSummaryAction
  | RestartAction
  | SaveAction
  | SeeLandingAction
  | SetTopicPriorityAction
  | UnloadAction
  | UpdateOrgInfo


export type DispatchActions =
  ThunkDispatch<MiniRootState, unknown, SaveAction> &
  Dispatch<Action>

export interface AppState {
  readonly errorMessage?: string
  readonly hasSeenLanding?: boolean
  readonly isUserSupervised?: boolean
  readonly orgInfo: OrgInfo
}

export interface UserState {
  readonly answers: {
    readonly [topicUrl in TopicId]?: {
      readonly [questionUrl: string]: AnswerType
    }
  }
  readonly isUserSupervised?: boolean
  readonly orgInfo: OrgInfo
  readonly priorities: {
    readonly [topicUrl in TopicId]?: TopicPriority
  }
  // See README.md#analytics for the design.
  readonly userId?: string
}

export interface PageProps {
  dispatch: DispatchActions
  hasSeenLanding: boolean
  isUserSupervised?: boolean
}


export interface MiniRootState {
  app: AppState
  user: UserState
}

export const makeUrlUser = (user: UserState): string => encodeURIComponent(JSON.stringify(user))


interface Properties {
  [keyName: string]: string
}

export class Logger {
  private actionTypesToLog: {[action in Action['type']]?: string}

  private browser: {name?: string} = detect() || {}

  public constructor(actionTypesToLog: {[action in Action['type']]?: string}) {
    this.actionTypesToLog = actionTypesToLog
  }

  public getEventName(action: Action): string {
    return this.actionTypesToLog[action.type] || ''
  }

  public getEventProperties(unusedAction: Action, unusedState: MiniRootState): Properties {
    const properties: Properties = {}
    if (this.browser.name) {
      properties['$browser'] = this.browser.name
    }
    return properties
  }

  public getUserId(action: Action, state: MiniRootState): string|undefined {
    // See README.md#analytics for the design.
    if (action.type === 'MINI_ONBOARDING_UNLOAD') {
      return undefined
    }
    return state.user.userId
  }

  public getUserProperties(unusedAtion: Action, state: MiniRootState): Properties|null {
    const {app: {orgInfo}} = state

    const {
      milo = '',
      city = {},
    } = orgInfo || {}
    const orgData: Properties = {}
    if (milo) {
      orgData['Mission locale'] = milo
    }
    if (city && city.departementId) {
      orgData['Département'] = city.departementId
    }
    if (city && city.name) {
      orgData['Ville'] = city.name
    }
    return orgData
  }

  public shouldLogAction(action: Action): boolean {
    if (!this.actionTypesToLog[action.type]) {
      return false
    }
    // TODO(pascal): Be careful with async actions not to log it twice.
    return true
  }
}
