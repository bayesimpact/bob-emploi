import {expect} from 'chai'
import {getStartedStrategy, getStrategyCompletion, getStrategyProgress} from 'store/strategy'

describe('getStartedStrategy', () => {
  it('should get a started strategy from a project, if it exists', () => {
    const project = {
      openedStrategies: [{
        reachedGoals: [],
        strategyId: 'my-strategy',
      }],
    }
    const startedStrategy = getStartedStrategy(project, 'my-strategy')
    expect(startedStrategy.strategyId).to.equal('my-strategy')
    expect(startedStrategy.reachedGoals).to.be.empty
  })

  it('should get an empty object if the strategy is not started yet.', () => {
    expect(Object.keys(getStartedStrategy({}, 'my-strategy'))).to.be.empty
    expect(Object.keys(getStartedStrategy({openedStrategies: []}, 'my-strategy'))).to.be.empty
  })
})

describe('getStrategyProgress', () => {
  it('should get progress from a list of goals', () => {
    const goals = ['goal1', 'goal2', 'goal3', 'goal4']
    const reachedGoals = {'goal1': true, 'goal2': false}
    expect(getStrategyProgress(goals, reachedGoals)).to.equal(25)
  })

  it('should not crash if there are no goals', () => {
    const goals = []
    const reachedGoals = {}
    expect(getStrategyProgress(goals, reachedGoals)).to.equal(0)
  })
})

describe('getStrategyCompletion', () => {
  it('should give all completion information for a strategy', () => {
    const startedAt = new Date().toISOString()
    const strategyId = 'application-methods'
    const startedStrategy = {
      reachedGoals: {'application-keywords': true},
      startedAt,
      strategyId,
    }
    const project = {openedStrategies: [startedStrategy]}
    const completion = getStrategyCompletion(project, strategyId)
    expect(completion.isComplete).to.be.false
    expect(completion.isStarted).to.be.true
    expect(completion.progress).to.equal(25)
    expect(completion.startedAt).to.equal(startedAt)
  })

  it('should not crash if there are no goals', () => {
    const startedAt = new Date().toISOString()
    const strategyId = 'unknown'
    const startedStrategy = {
      startedAt,
      strategyId,
    }
    const project = {openedStrategies: [startedStrategy]}
    const completion = getStrategyCompletion(project, strategyId)
    expect(completion.isComplete).to.be.false
    expect(completion.isStarted).to.be.true
    expect(completion.progress).to.equal(0)
    expect(completion.startedAt).to.equal(startedAt)
  })
})
