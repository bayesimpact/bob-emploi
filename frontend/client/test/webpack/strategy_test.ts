import {expect} from 'chai'
import {getStartedStrategy, getStrategyCompletion, getStrategyProgress} from 'store/strategy'

describe('getStartedStrategy', (): void => {
  it('should get a started strategy from a project, if it exists', (): void => {
    const project: bayes.bob.Project = {
      openedStrategies: [{
        reachedGoals: {},
        strategyId: 'my-strategy',
      }],
    }
    const startedStrategy = getStartedStrategy(project, 'my-strategy')
    expect(startedStrategy.strategyId).to.equal('my-strategy')
    expect(startedStrategy.reachedGoals).to.be.empty
  })

  it('should get a dummy strategy if the strategy is not started yet.', (): void => {
    expect(getStartedStrategy({}, 'my-strategy')).to.eql({strategyId: 'my-strategy'})
    expect(getStartedStrategy({openedStrategies: []}, 'my-strategy')).
      to.eql({strategyId: 'my-strategy'})
  })
})

describe('getStrategyProgress', (): void => {
  it('should get progress from a list of goals', (): void => {
    const goals = ['goal1', 'goal2', 'goal3', 'goal4']
    const reachedGoals = {'goal1': true, 'goal2': false}
    expect(getStrategyProgress(goals, reachedGoals)).to.equal(25)
  })

  it('should not crash if there are no goals', (): void => {
    const goals = []
    const reachedGoals = {}
    expect(getStrategyProgress(goals, reachedGoals)).to.equal(0)
  })
})

describe('getStrategyCompletion', (): void => {
  it('should give all completion information for a strategy', (): void => {
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

  it('should not crash if there are no goals', (): void => {
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
