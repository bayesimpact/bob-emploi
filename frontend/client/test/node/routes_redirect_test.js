const {expect} = require('chai')
const {NginxConfFile} = require('nginx-conf')
const path = require('path')
const RandExp = require('randexp')

const entrypoints = require('../../cfg/entrypoints.js')
const {AUX_PAGES, handler} = require('../../release/aux_pages_redirect.js')
const cloudfront = require('../../release/cloudfront.json')


function computeUriRedirect(uri) {
  let calledUri = ''
  handler({Records: [{cf: {request: {uri}}}]}, undefined, (error, result) => {
    calledUri = result.uri
  })
  return calledUri
}

// Select the CloudFront cache behavior for a given URL.
function selectCloudfrontBehavior(url) {
  const matchBehavior = cloudfront.CacheBehaviors.Items.find((behavior) => {
    return new RegExp(behavior.PathPattern.replace(/\*/, '.*')).test(url)
  })
  if (matchBehavior) {
    return matchBehavior
  }
  return cloudfront.DefaultCacheBehavior
}

// The URN of the lambda Aux Pages Redirect.
const auxPagesLambda = cloudfront.CacheBehaviors.Items.
  filter(({LambdaFunctionAssociations}) =>
    LambdaFunctionAssociations && LambdaFunctionAssociations.Items).
  map(({LambdaFunctionAssociations}) =>
    LambdaFunctionAssociations.Items[0].LambdaFunctionARN).
  find(lambda => lambda.includes('bob-aux-pages-redirect'))

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
      return nginxConf.then(conf => {
        const matchingEndpoints = conf.nginx.server.location.
          filter(({_value: pathStart, try_files: {_value = ''} = {}}) => {
            const nginxRedirect = _value && _value.split(' ')[1]
            return redirect === nginxRedirect && urlExample.startsWith(pathStart)
          })
        expect(matchingEndpoints).to.have.lengthOf(1)
      })
    })
  })

  // CloudFront => aux_pages_redirect lambda.

  cloudfront.CacheBehaviors.Items.forEach(({LambdaFunctionAssociations, PathPattern}) => {
    if (!LambdaFunctionAssociations || !LambdaFunctionAssociations.Items) {
      return
    }
    if (!LambdaFunctionAssociations.Items[0].LambdaFunctionARN.includes('bob-aux-pages-redirect')) {
      return
    }
    const urlExample = new RandExp(PathPattern.replace(/\*/, '.*')).gen()
    it(`redirects "${urlExample}" in Cloudfront to a client endpoint`, () => {
      expect(LambdaFunctionAssociations.Items[0].LambdaFunctionARN).to.equal(auxPagesLambda)
      const redirected = computeUriRedirect(urlExample)
      expect(redirected).to.be.ok
      expect(redirected).not.to.equal('/')
    })
  })

  // aux_pages_redirect lambda => CloudFront

  // Set of redirects that are excluded from Cloudfront on purpose.
  const notInCloudFront = [
    // No need to redirect /mini in Prod.
    '/mini',
    // TODO(pascal): Fix this one.
    '/unml/a-li',
    // TODO(pascal): Fix this one.
    '/statut',
  ]

  AUX_PAGES.forEach(({redirect, urlTest}) => {
    const urlExample = new RandExp(urlTest).gen()
    if (notInCloudFront.some(url => urlTest.test(url))) {
      return
    }
    it(`redirects "${urlExample}" to "${redirect}" and CloudFront knows about it`, () => {
      expect(auxPagesLambda).to.be.ok
      const {LambdaFunctionAssociations: associations} = selectCloudfrontBehavior(urlExample)
      const lambdas = (associations && associations.Items || []).
        map(({LambdaFunctionARN}) => LambdaFunctionARN)
      expect(lambdas).to.include(auxPagesLambda)
    })
  })
})
