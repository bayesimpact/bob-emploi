import _mapValues from 'lodash/mapValues'

// TODO(cyrille): Move this file to store.
import topics from 'components/advisor/data/categories.json'

const topicSets = _mapValues(topics, list => new Set(list))

// The number of low rated advices a user can read in a given topic without unlocking any.
const MAX_FREE_TOPIC_ADVICES = 2

// TODO(cyrille): Add tests.
export const getLockedAdvices = (user, advices) => {
  const {appPoints: {unlockedAdviceModules = {}} = {}, featuresEnabled: {bobPoints} = {}} = user
  if (bobPoints !== 'ACTIVE') {
    return new Set()
  }
  const locked = new Set()
  // This keeps the count of encountered advices in each topic.
  const adviceCountByTopic = _mapValues(topics, () => 0)
  advices.forEach(({adviceId, numStars}) => {
    // Three stars rated advices are free. Unlocked advices are not locked.
    if (numStars === 3 || unlockedAdviceModules[adviceId]) {
      return
    }
    const adviceTopics = Object.keys(topicSets).filter(topic => topicSets[topic].has(adviceId))
    adviceTopics.forEach(topic => adviceCountByTopic[topic] += 1)
    // Advice is one of the first ones in one of their topics, it's given as free.
    if (adviceTopics.some(topic => adviceCountByTopic[topic] <= MAX_FREE_TOPIC_ADVICES)) {
      return
    }
    // Other advices are locked.
    locked.add(adviceId)
  })
  return locked
}
