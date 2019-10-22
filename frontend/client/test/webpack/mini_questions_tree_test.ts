import {expect} from 'chai'
import {QUESTIONS_TREE} from 'components/pages/mini/questions_tree'


describe('QUESTIONS_TREE', (): void => {
  it('should have a URL for each topic and question that do not use special chars', (): void => {
    QUESTIONS_TREE.forEach((topic): void => {
      expect(topic.url).to.be.a('string').that.match(/^[a-z]+$/);
      (topic.questions || []).forEach((question): void => {
        expect(question.url).to.be.a('string').that.match(/^[a-z]+$/)
      })
    })
  })
})
