import {expect} from 'chai'
import type {Rewrite} from 'connect-history-api-fallback'
import RandExp from 'randexp'

import getDevServer from '../../cfg/dev_server'

import {AUX_PAGES, handler} from '../../release/lambdas/aux_pages_redirect'
import cloudformation from '../../release/cloudformation/main_template.json'


interface LambdaAtEdgeRequest {
  uri: string
}


interface CloudFrontCacheBehavior {
  LambdaFunctionAssociations?: readonly {
    LambdaFunctionARN: {Ref: string}
  }[]
  PathPattern?: string
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

const cloudfront = cloudformation.Resources.CloudfrontDistribution.Properties.DistributionConfig
// Select the CloudFront cache behavior for a given URL.
function selectCloudfrontBehavior(url: string): CloudFrontCacheBehavior {
  const matchBehavior = cloudfront.CacheBehaviors.find((behavior: CloudFrontCacheBehavior) =>
    behavior.PathPattern && new RegExp(behavior.PathPattern.replace(/\*/, '.*')).test(url))
  return matchBehavior || cloudfront.DefaultCacheBehavior
}


const cacheBehaviors: readonly CloudFrontCacheBehavior[] = cloudfront.CacheBehaviors
// The ARN of the lambda Aux Pages Redirect.
const auxPagesLambdaRef = 'LambdaAuxPageRedirect'
const matchAllPatternString = '/.*/'

describe('aux-pages-redirect lambda function', () => {
  let devRedirects: readonly (Rewrite & {to: string})[] = []
  before(async () => {
    const {historyApiFallback: {rewrites}} = await getDevServer()
    devRedirects = rewrites
  })

  it('should not touch the landing page', (): void => {
    expect(computeUriRedirect('/')).to.equal('/')
  })

  it('redirects URL examples to the proper client endpoint', (): void => {
    expect(devRedirects).not.to.be.empty
    for (const {from, to} of devRedirects) {
      if (!from || !to || from.toString() === matchAllPatternString) {
        continue
      }
      const urlExample = new RandExp(from).gen()
      expect(computeUriRedirect(urlExample), `${urlExample} => ${to}`).to.equal(to)
    }
  })

  for (const {redirect, urlTest} of AUX_PAGES) {
    const urlExample = new RandExp(urlTest).gen()
    it(`redirects "${urlExample}" to "${redirect}" and the client knows about it`, (): void => {
      const matchingEndpoints: string[] = []
      for (const {from, to} of devRedirects) {
        if (to && from && from.toString() !== matchAllPatternString && from.test(urlExample)) {
          const name = to.slice(1).split('.')[0]
          matchingEndpoints.push(name)
        }
      }
      expect(matchingEndpoints, JSON.stringify(matchingEndpoints)).to.have.lengthOf(1)
    })
  }

  // TODO(cyrille): Test the nginx conf somehow.

  // CloudFront => aux_pages_redirect lambda.

  for (const {LambdaFunctionAssociations, PathPattern} of cacheBehaviors) {
    if (!LambdaFunctionAssociations) {
      continue
    }
    if (LambdaFunctionAssociations[0].LambdaFunctionARN.Ref !== auxPagesLambdaRef) {
      continue
    }
    if (!PathPattern) {
      continue
    }
    const urlExample = new RandExp(PathPattern.replace(/\*/, '.*')).gen()
    it(`redirects "${urlExample}" in Cloudfront to a client endpoint`, (): void => {
      if (!LambdaFunctionAssociations) {
        return
      }
      expect(LambdaFunctionAssociations[0].LambdaFunctionARN.Ref).to.equal(auxPagesLambdaRef)
      const redirected = computeUriRedirect(urlExample)
      expect(redirected).to.be.ok
      expect(redirected).not.to.equal('/')
    })
  }

  // aux_pages_redirect lambda => CloudFront

  // Set of redirects that are excluded from Cloudfront on purpose.
  const notInCloudFront = [
    // No need to show the design-system in prod.
    '/design-system',
    // No need to redirect /mini in Prod.
    '/mini',
  ]

  for (const {redirect, urlTest} of AUX_PAGES) {
    const urlExample = new RandExp(urlTest).gen()
    if (notInCloudFront.some(url => urlTest.test(url))) {
      continue
    }
    it(`redirects "${urlExample}" to "${redirect}" and CloudFront knows about it`, (): void => {
      const {LambdaFunctionAssociations: associations = []} = selectCloudfrontBehavior(urlExample)
      const lambdas = associations.map(({LambdaFunctionARN: {Ref}}) => Ref)
      expect(lambdas, JSON.stringify(lambdas)).to.include(auxPagesLambdaRef)
    })
  }
})
