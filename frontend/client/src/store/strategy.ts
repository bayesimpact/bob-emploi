import {getStrategyGoals, tutoyer} from 'store/french'

const getStartedStrategy = (project: bayes.bob.Project, sId: string): bayes.bob.WorkingStrategy =>
  project.openedStrategies && project.openedStrategies.
    find(({strategyId}: bayes.bob.WorkingStrategy): boolean => strategyId === sId) || {}


const getStrategyProgress = (goals, reachedGoals): number => {
  const numReachedGoals = Object.values(reachedGoals).
    filter((hasGoal: boolean): boolean => hasGoal).length
  return numReachedGoals * 100 / (goals.length || 1)
}


export interface StrategyCompletion {
  isComplete: boolean
  isStarted: boolean
  progress: number
  startedAt: string
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

export {getStartedStrategy, getStrategyCompletion, getStrategyProgress}
