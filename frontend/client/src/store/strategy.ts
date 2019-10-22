import {getStrategyGoals, tutoyer} from 'store/french'

type ValidWorkingStrategy = bayes.bob.WorkingStrategy & {strategyId: string}
const getStartedStrategy = (project: bayes.bob.Project, sId: string): ValidWorkingStrategy =>
  project.openedStrategies && project.openedStrategies.
    find((s: bayes.bob.WorkingStrategy): s is ValidWorkingStrategy => s.strategyId === sId) ||
    {strategyId: sId}


const getStrategyProgress = (goals, reachedGoals): number => {
  const numReachedGoals = Object.values(reachedGoals).
    filter((hasGoal: boolean): boolean => hasGoal).length
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
  const {startedAt, reachedGoals = []} = getStartedStrategy(project, strategyId)
  const isStarted = !!startedAt
  const goals = getStrategyGoals(tutoyer, strategyId)
  const progress = getStrategyProgress(goals, reachedGoals)
  const isComplete = progress === 100
  return {isComplete, isStarted, progress, startedAt}
}


const isValidStrategy = (s: bayes.bob.Strategy): s is bayes.bob.Strategy & {strategyId: string} =>
  !!s.strategyId


export {getStartedStrategy, getStrategyCompletion, getStrategyProgress, isValidStrategy}
