import {expect} from 'chai'
import {QUESTIONS_TREE} from 'components/pages/mini/questions_tree'


describe('QUESTIONS_TREE', () => {
  it('should have a URL for each topic and question that do not use special chars', () => {
    QUESTIONS_TREE.forEach(topic => {
      expect(topic.url).to.be.a('string').that.match(/^[a-z]+$/);
      (topic.questions || []).forEach(question => {
        expect(question.url).to.be.a('string').that.match(/^[a-z]+$/)
      })
    })
  })
})
