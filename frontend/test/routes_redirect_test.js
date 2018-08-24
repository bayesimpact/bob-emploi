import {expect} from 'chai'
import _forEach from 'lodash/forEach'
import RandExp from 'randexp'

import entrypoints from '../cfg/entrypoints'
import {AUX_PAGES, handler} from '../release/aux_pages_redirect'


function computeUriRedirect(uri) {
  let calledUri = ''
  handler({Records: [{cf: {request: {uri}}}]}, undefined, (error, result) => {
    calledUri = result.uri
  })
  return calledUri
}


describe('aux-pages-redirect lambda function', () => {
  it('should not touch the landing page', () => {
    expect(computeUriRedirect('/')).to.equal('/')
  })

  _forEach(entrypoints, ({htmlFilename, rewrite}, name) => {
    if (!htmlFilename || !rewrite) {
      return
    }
    const urlExample = new RandExp(rewrite).gen()
    it(`redirects "${urlExample}" to the client endpoint "${name}"`, () => {
      expect(computeUriRedirect(urlExample)).to.equal(`/${htmlFilename}`)
    })
  })

  AUX_PAGES.forEach(({redirect, urlTest}) => {
    const urlExample = new RandExp(urlTest).gen()
    it(`redirects "${urlExample}" to "${redirect}" and the client knows about it`, () => {
      const matchingEndpoints = []
      _forEach(entrypoints, ({htmlFilename, rewrite}, name) => {
        if (htmlFilename && rewrite && rewrite.test(urlExample)) {
          matchingEndpoints.push(name)
        }
      })
      expect(matchingEndpoints).to.have.lengthOf(1)
    })
  })
})
