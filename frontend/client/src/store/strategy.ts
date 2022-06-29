import * as Sentry from '@sentry/browser'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import type {TFunction} from 'i18next'
import i18next from 'i18next'

import goals from 'store/data/strategy_goals.json'
import {getFieldsTranslator} from 'store/i18n'


export type StrategyGoal = download.StrategyGoal

const translatedGoals = _memoize(
  (translate: TFunction): {[k in keyof typeof goals]: readonly StrategyGoal[]} => {
    const translator = getFieldsTranslator<'content'|'stepTitle', StrategyGoal>(
      translate, ['content', 'stepTitle'], 'goals', {productName: config.productName})
    return _mapValues(goals, goalsForStrat => goalsForStrat.map(translator))
  },
  (): string => i18next.language,
)


const emptyArray = [] as const


const getStrategyGoals =
  (strategyId: string, translate?: TFunction): readonly StrategyGoal[] => {
    const goalsRaw = translate ? translatedGoals(translate) : goals
    const strategyGoals = goalsRaw[strategyId as keyof typeof goals] || emptyArray
    if (!strategyGoals.length) {
      Sentry.captureMessage(`No goals defined for the strategy "${strategyId}"`)
    }
    return strategyGoals
  }


type ValidWorkingStrategy = bayes.bob.WorkingStrategy & {strategyId: string}
const getStartedStrategy = (project: bayes.bob.Project, sId: string): ValidWorkingStrategy =>
  project.openedStrategies && project.openedStrategies.
    find((s: bayes.bob.WorkingStrategy): s is ValidWorkingStrategy => s.strategyId === sId) ||
    {strategyId: sId}


const getStrategyProgress =
(goals: ReturnType<typeof getStrategyGoals>, reachedGoals: {[key: string]: boolean}): number => {
  const numReachedGoals = Object.values(reachedGoals).filter(Boolean).length
  return numReachedGoals * 100 / (goals.length || 1)
}


export interface StrategyCompletion {
  isComplete: boolean
  isStarted: boolean
  progress: number
  startedAt?: string
}


const getStrategyCompletion = (project: bayes.bob.Project, strategyId: string):
StrategyCompletion => {
  const {startedAt, reachedGoals = {}} = getStartedStrategy(project, strategyId)
  const isStarted = !!startedAt
  const goals = getStrategyGoals(strategyId)
  const progress = getStrategyProgress(goals, reachedGoals)
  const isComplete = progress === 100
  return {isComplete, isStarted, progress, startedAt}
}


const isValidStrategy = (s: bayes.bob.Strategy): s is bayes.bob.Strategy & {strategyId: string} =>
  !!s.strategyId


export {getStartedStrategy, getStrategyCompletion, getStrategyGoals, getStrategyProgress,
  isValidStrategy}
