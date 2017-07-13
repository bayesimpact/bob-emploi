import {expect} from 'chai'
import ReactDOM from 'react-dom'
import {computeBobScore} from 'store/score'

const renderText = component => {
  const div = document.createElement('div')
  ReactDOM.render(component, div)
  return div.innerText
}


describe('computeScore', () => {
  it('gives a neutral score on empty project', () => {
    const {components, percent} = computeBobScore({}, {})
    components.forEach(({score}) => expect(score).to.eq(0))
    expect(percent).to.equal(62.5)
  })

  it('gives a great score on perfect project', () => {
    const {components, percent} = computeBobScore({}, {
      jobSearchLengthMonths: 3,
      localStats: {
        imt: {
          employmentTypePercentages: [{
            employmentType: 'CDI',
            percentage: 100,
          }],
          yearlyAvgOffersDenominator: 10,
          yearlyAvgOffersPer10Candidates: 25,
        },
        jobOffersChange: 120,
        unemploymentDuration: {days: 10},
      },
      totalInterviewsEstimate: 'A_LOT',
      weeklyApplicationsEstimate: 'A_LOT',
    })
    components.forEach(({display, score}) => {
      expect(score).to.be.above(3)
      expect(display).to.be.ok
    })
    expect(percent).to.equal(95)
  })

  it('gives a very low score on weakest project', () => {
    const {components, percent} = computeBobScore({}, {
      jobSearchLengthMonths: 18,
      localStats: {
        imt: {
          employmentTypePercentages: [{
            employmentType: 'INTERIM',
            percentage: 100,
          }],
          yearlyAvgOffersDenominator: 10,
          yearlyAvgOffersPer10Candidates: 0.9,
        },
        jobOffersChange: -120,
        unemploymentDuration: {days: 360},
      },
      totalInterviewsEstimate: 'LESS_THAN_2',
      weeklyApplicationsEstimate: 'LESS_THAN_2',
    })
    components.forEach(({display, score}) => {
      expect(score).to.be.below(-3)
      expect(display).to.be.ok
    })
    expect(percent).to.equal(30)
  })

  it('surfaces the most important components first', () => {
    const {components, percent} = computeBobScore({}, {
      localStats: {
        imt: {
          employmentTypePercentages: [{
            employmentType: 'INTERIM',
            percentage: 100,
          }],
        },
        jobOffersChange: 10,
      },
    })
    expect(percent).to.be.within(30, 95)
    expect(components).to.have.length.above(2)

    expect(components[0].score).to.be.below(-3)
    expect(renderText(components[0].display)).to.eq("0% d'offres en CDI")
    expect(components[1].score).to.be.within(0, 2)
    expect(renderText(components[1].display)).to.eq("+10% d'offres en 2016")
  })
})
