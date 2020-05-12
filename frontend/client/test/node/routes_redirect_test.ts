const {expect} = require('chai')
const RandExp = require('randexp')

const {historyApiFallback: {rewrites: devRedirects}} = require('../../cfg/dev_server.js')
const {AUX_PAGES, handler} = require('../../release/aux_pages_redirect.js')
const cloudfront = require('../../release/cloudfront.json')


interface LambdaAtEdgeRequest {
  uri: string
}


interface CloudFrontCacheBehavior {
  LambdaFunctionAssociations?: {
    Items?: readonly {
      LambdaFunctionARN: string
    }[]
    Quantity: number
  }
  PathPattern?: string
}


interface DevServerRewrite {
  from?: RegExp
  to?: string
}


function computeUriRedirect(uri: string): string {
  let calledUri = ''
  handler(
    {Records: [{cf: {request: {uri}}}]}, undefined,
    (error: unknown, result: LambdaAtEdgeRequest) => {
      calledUri = result.uri
    })
  return calledUri
}

// Select the CloudFront cache behavior for a given URL.
function selectCloudfrontBehavior(url: string): CloudFrontCacheBehavior {
  const matchBehavior = cloudfront.CacheBehaviors.Items.find(
    (behavior: CloudFrontCacheBehavior & {PathPattern: string}) => {
      return new RegExp(behavior.PathPattern.replace(/\*/, '.*')).test(url)
    })
  if (matchBehavior) {
    return matchBehavior
  }
  return cloudfront.DefaultCacheBehavior
}

interface BehaviorWithLambdaFunctions extends CloudFrontCacheBehavior {
  LambdaFunctionAssociations: CloudFrontCacheBehavior['LambdaFunctionAssociations'] & {
    Items: readonly {LambdaFunctionARN: string}[]
  }
}


// The URN of the lambda Aux Pages Redirect.
const auxPagesLambda = cloudfront.CacheBehaviors.Items.
  filter((b: CloudFrontCacheBehavior): b is BehaviorWithLambdaFunctions =>
    !!(b.LambdaFunctionAssociations && b.LambdaFunctionAssociations.Items)).
  map(({LambdaFunctionAssociations}: BehaviorWithLambdaFunctions) =>
    LambdaFunctionAssociations.Items[0].LambdaFunctionARN).
  find((lambda: string): boolean => lambda.includes('bob-aux-pages-redirect'))

describe('aux-pages-redirect lambda function', (): void => {
  it('should not touch the landing page', (): void => {
    expect(computeUriRedirect('/')).to.equal('/')
  })

  devRedirects.forEach(({from, to}: DevServerRewrite): void => {
    if (!from || !to) {
      return
    }
    const urlExample = new RandExp(from).gen()
    it(`redirects "${urlExample}" to the client endpoint "${to}"`, (): void => {
      expect(computeUriRedirect(urlExample)).to.equal(to)
    })
  })

  AUX_PAGES.forEach(({redirect, urlTest}: typeof AUX_PAGES[0]): void => {
    const urlExample = new RandExp(urlTest).gen()
    it(`redirects "${urlExample}" to "${redirect}" and the client knows about it`, (): void => {
      const matchingEndpoints: string[] = []
      devRedirects.forEach(({from, to}: DevServerRewrite) => {
        if (to && from && from.test(urlExample)) {
          const name = to.slice(1).split('.')[0]
          matchingEndpoints.push(name)
        }
      })
      expect(matchingEndpoints).to.have.lengthOf(1)
    })
  })

  // TODO(cyrille): Test the nginx conf somehow.

  // CloudFront => aux_pages_redirect lambda.

  cloudfront.CacheBehaviors.Items.forEach(
    ({LambdaFunctionAssociations, PathPattern}:
    CloudFrontCacheBehavior & {PathPattern: string}): void => {
      if (!LambdaFunctionAssociations || !LambdaFunctionAssociations.Items) {
        return
      }
      if (!LambdaFunctionAssociations.Items[0].LambdaFunctionARN.includes(
        'bob-aux-pages-redirect')) {
        return
      }
      const urlExample = new RandExp(PathPattern.replace(/\*/, '.*')).gen()
      it(`redirects "${urlExample}" in Cloudfront to a client endpoint`, (): void => {
        if (!LambdaFunctionAssociations || !LambdaFunctionAssociations.Items) {
          return
        }
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

  AUX_PAGES.forEach(({redirect, urlTest}: typeof AUX_PAGES[0]): void => {
    const urlExample = new RandExp(urlTest).gen()
    if (notInCloudFront.some(url => urlTest.test(url))) {
      return
    }
    it(`redirects "${urlExample}" to "${redirect}" and CloudFront knows about it`, (): void => {
      expect(auxPagesLambda).to.be.ok
      const {LambdaFunctionAssociations: associations} = selectCloudfrontBehavior(urlExample)
      const lambdas = (associations && associations.Items || []).
        map(({LambdaFunctionARN}) => LambdaFunctionARN)
      expect(lambdas).to.include(auxPagesLambda)
    })
  })
})

export {}
