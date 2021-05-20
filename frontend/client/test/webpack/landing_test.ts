import {expect} from 'chai'
import RandExp from 'randexp'
import {landingPageContents} from 'components/pages/landing'

describe('Landinge Page Contents', () => {
  const entries = Object.entries(landingPageContents)
  it('should not match overlapping utm_content values', () => {
    for (const [name, {match}] of entries) {
      const example = new RandExp(match).gen()
      for (const [otherName, {match: otherMatch}] of entries) {
        if (otherName === name) {
          continue
        }
        expect(example).not.to.match(otherMatch, `Conflict between "${name}" and "${otherName}"`)
      }
    }
  })
})
