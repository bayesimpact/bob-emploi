import {expect} from 'chai'
import {computeBobScore} from 'store/score'

import {DiagnosticTopic} from 'api/diagnostic'

describe('computeBobScore', () => {
  const allKnownTopics = Object.keys(DiagnosticTopic).filter(topic => DiagnosticTopic[topic])

  it('covers all topics', () => {
    const {components} = computeBobScore({
      overallScore: 50,
      subDiagnostics: [
        {
          score: 37,
          text: 'Vous avez un bon profil.',
          topic: 'PROFILE_DIAGNOSTIC',
        },
        {
          score: 53,
          text: 'Vous avez un bon projet.',
          topic: 'PROJECT_DIAGNOSTIC',
        },
        {
          score: 93,
          text: 'Vous recherche est efficace.',
          topic: 'JOB_SEARCH_DIAGNOSTIC',
        },
        {
          score: 17,
          text: 'Le marché vous est favorable.',
          topic: 'MARKET_DIAGNOSTIC',
        },
        {
          score: 50,
          text: 'Votre métier devrait être de plus en plus recherché dans les prochaines années.',
          topic: 'JOB_OF_THE_FUTURE_DIAGNOSTIC',
        },
      ],
    })
    expect(components.map(({topic}) => topic)).
      to.have.members(allKnownTopics)
    expect(components.map(({title}) => title)).to.have.lengthOf(allKnownTopics.length)
    const computedTexts = components.map(({text}) => text)
    computedTexts.forEach(computed => {
      expect(computed).to.be.a('string').that.is.not.empty
    })
    expect(computedTexts).to.have.lengthOf(allKnownTopics.length)
  })

  it('puts placeholders for missing topics', () => {
    const {components} = computeBobScore({
      overallScore: 50,
      subDiagnostics: [{
        score: 37,
        text: 'Vous avez un bon profil.',
        topic: 'PROFILE_DIAGNOSTIC',
      }],
    })
    expect(components.map(({topic}) => topic)).
      to.have.members(allKnownTopics, components.map(({topic}) => topic))
    expect(components.map(({title}) => title)).to.have.lengthOf(allKnownTopics.length)
    const computedTexts = components.map(({text}) => text)
    computedTexts.forEach(computed => {
      expect(computed).to.be.a('string').that.is.not.empty
    })
    expect(computedTexts).to.have.lengthOf(allKnownTopics.length)
    const {text} = components.filter(({topic}) => topic === 'PROJECT_DIAGNOSTIC')[0]
    expect(text).to.equal("Nous n'avons pas assez d'informations pour vous aider sur ce point.")
  })

  it('caps scores above 10 and below 90', () => {
    const {components, percent} = computeBobScore({
      overallScore: 9,
      subDiagnostics: [{
        score: 98,
        text: 'Vous avez un bon profil.',
        topic: 'PROFILE_DIAGNOSTIC',
      }],
    })
    expect(percent).to.equal(10)
    const profileComponent = components.filter(({topic}) => topic === 'PROFILE_DIAGNOSTIC')[0]
    expect(profileComponent.percent).to.equal(90)
  })

  it('uses short title from server, if given', () => {
    const {shortTitle} = computeBobScore({
      overallScore: 50,
      overallSentence: 'Projet pas très clair',
      subDiagnostics: [],
    })
    expect(shortTitle).to.equal('Projet pas très clair')
  })

  it('never has paragraphs in shortTitle', () => {
    const {shortTitle} = computeBobScore({
      overallScore: 50,
      subDiagnostics: [{
        score: 37,
        text: 'Vous avez un bon profil.',
        topic: 'PROFILE_DIAGNOSTIC',
      }],
    })
    expect(shortTitle).not.to.include('\n\n')
  })
})
