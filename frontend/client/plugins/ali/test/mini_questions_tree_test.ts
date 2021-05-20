import {expect} from 'chai'
import QUESTIONS_TREE from '../src/components/questions_tree'


describe('QUESTIONS_TREE', (): void => {
  it('should have a URL for each topic and question that do not use special chars', (): void => {
    for (const topic of QUESTIONS_TREE) {
      expect(topic.url).to.be.a('string').that.match(/^[a-z]+$/)
      for (const question of (topic.questions || [])) {
        expect(question.url).to.be.a('string').that.match(/^[a-z]+$/)
      }
    }
  })
})
