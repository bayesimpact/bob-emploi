var chai = require('chai')
var expect = chai.expect
import {extractDomainName} from 'store/link'


describe('extractDomainName', () => {
  it('extracts the domain name of an URL', () => {
    const domain = extractDomainName('http://www.pole-emploi.fr/page')
    expect(domain).to.equal('www.pole-emploi.fr')
  })

  it('returns an empty string for malformed URLs', () => {
    const domain = extractDomainName('^http:/o/')
    expect(domain).to.equal('')
  })
})
