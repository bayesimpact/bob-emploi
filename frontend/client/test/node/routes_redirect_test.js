const {expect} = require('chai')
const {NginxConfFile} = require('nginx-conf')
const path = require('path')
const RandExp = require('randexp')

const entrypoints = require('../../cfg/entrypoints.js')
const {AUX_PAGES, handler} = require('../../release/aux_pages_redirect.js')


function computeUriRedirect(uri) {
  let calledUri = ''
  handler({Records: [{cf: {request: {uri}}}]}, undefined, (error, result) => {
    calledUri = result.uri
  })
  return calledUri
}

const nginxConf = new Promise((resolve, reject) =>
  NginxConfFile.create(path.join(__dirname, '../../release/nginx.conf'), (err, conf) => {
    if (err) {
      reject(err)
      return
    }
    resolve(conf)
  }))


describe('aux-pages-redirect lambda function', () => {
  it('should not touch the landing page', () => {
    expect(computeUriRedirect('/')).to.equal('/')
  })

  Object.keys(entrypoints).forEach(name => {
    const {htmlFilename, rewrite} = entrypoints[name]
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
      Object.keys(entrypoints).forEach(name => {
        const {htmlFilename, rewrite} = entrypoints[name]
        if (htmlFilename && rewrite && rewrite.test(urlExample)) {
          matchingEndpoints.push(name)
        }
      })
      expect(matchingEndpoints).to.have.lengthOf(1)
    })
  })

  AUX_PAGES.forEach(({redirect, urlTest}) => {
    const urlExample = new RandExp(urlTest).gen()
    it(`redirects "${urlExample}" to "${redirect}" and nginx knows about it`, () => {
      nginxConf.then(conf => {
        const matchingEndpoints = conf.nginx.server.location.
          filter(({_value: pathStart, try_files: {_value = ''} = {}}) => {
            const nginxRedirect = _value && _value.split(' ')[1]
            return redirect === nginxRedirect && urlExample.startsWith(pathStart)
          })
        expect(matchingEndpoints).to.have.lengthOf(1)
      })
    })
  })
})
