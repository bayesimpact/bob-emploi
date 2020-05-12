import {expect} from 'chai'
import {computeBobScore} from 'store/score'

describe('computeBobScore', (): void => {
  it('caps scores above 10 and below 90', (): void => {
    const {percent} = computeBobScore({
      overallScore: 9,
    })
    expect(percent).to.equal(10)
  })

  it('uses short title from server, if given', (): void => {
    const {shortTitle} = computeBobScore({
      overallScore: 50,
      overallSentence: 'Projet pas très clair',
    })
    expect(shortTitle).to.equal('Projet pas très clair')
  })

  it('never has paragraphs in shortTitle', (): void => {
    const {shortTitle} = computeBobScore({
      overallScore: 50,
    })
    expect(shortTitle).not.to.include('\n\n')
  })
})
