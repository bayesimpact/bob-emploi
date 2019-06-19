import {AnswerType} from './questions_tree'

export const MINI_ONBOARDING_ANSWER = 'MINI_ONBOARDING_ANSWER'
export const MINI_ONBOARDING_LOAD = 'MINI_ONBOARDING_LOAD'
export const MINI_ONBOARDING_SET_TOPIC_PRIORITY = 'MINI_ONBOARDING_SET_TOPIC_PRIORITY'
export const MINI_ONBOARDING_RESTART = 'MINI_ONBOARDING_RESTART'


export type TopicPriority = boolean | 'later'


interface AnswerAction {
  answer: AnswerType
  question: string
  topic: string
  type: typeof MINI_ONBOARDING_ANSWER
}


interface LoadAction {
  type: typeof MINI_ONBOARDING_LOAD
}


interface RestartAction {
  type: typeof MINI_ONBOARDING_RESTART
}


interface SetTopicPriorityAction {
  priority: TopicPriority
  topic: string
  type: typeof MINI_ONBOARDING_SET_TOPIC_PRIORITY
}


export type Action = AnswerAction | LoadAction | RestartAction | SetTopicPriorityAction


export type DispatchActions = (action: Action) => Action


export interface UserState {
  readonly answers: {
    readonly [topicUrl: string]: {
      readonly [questionUrl: string]: AnswerType
    }
  }
  readonly priorities: {
    readonly [topicUrl: string]: TopicPriority
  }
}


export interface RootState {
  user: UserState
}
