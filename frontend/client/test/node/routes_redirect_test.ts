import {expect} from 'chai'
import RandExp from 'randexp'

import getDevServer from '../../cfg/dev_server'

import {AUX_PAGES, handler} from '../../release/lambdas/aux_pages_redirect'
// TODO(cyrille): Consider testing with other deployments.
import cloudfront from '../../release/cloudfront/fr.json'


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
  const matchBehavior = cloudfront.CacheBehaviors.Items.find((behavior: CloudFrontCacheBehavior) =>
    behavior.PathPattern && new RegExp(behavior.PathPattern.replace(/\*/, '.*')).test(url))
  return matchBehavior || cloudfront.DefaultCacheBehavior
}

interface BehaviorWithLambdaFunctions extends CloudFrontCacheBehavior {
  LambdaFunctionAssociations: CloudFrontCacheBehavior['LambdaFunctionAssociations'] & {
    Items: readonly {LambdaFunctionARN: string}[]
  }
}


const cacheBehaviors: readonly CloudFrontCacheBehavior[] = cloudfront.CacheBehaviors.Items
// The URN of the lambda Aux Pages Redirect.
const auxPagesLambda = cacheBehaviors.
  filter((b: CloudFrontCacheBehavior): b is BehaviorWithLambdaFunctions =>
    !!(b.LambdaFunctionAssociations && b.LambdaFunctionAssociations.Items)).
  map(({LambdaFunctionAssociations}: BehaviorWithLambdaFunctions) =>
    LambdaFunctionAssociations.Items[0].LambdaFunctionARN).
  find((lambda: string): boolean => lambda.includes('bob-aux-pages-redirect'))

describe('aux-pages-redirect lambda function', async (): Promise<void> => {
  it('should not touch the landing page', (): void => {
    expect(computeUriRedirect('/')).to.equal('/')
  })

  const {historyApiFallback: {rewrites: devRedirects}} = await getDevServer()
  for (const {from, to} of devRedirects) {
    if (!from || !to) {
      continue
    }
    const urlExample = new RandExp(from).gen()
    it(`redirects "${urlExample}" to the client endpoint "${to}"`, (): void => {
      expect(computeUriRedirect(urlExample)).to.equal(to)
    })
  }

  for (const {redirect, urlTest} of AUX_PAGES) {
    const urlExample = new RandExp(urlTest).gen()
    it(`redirects "${urlExample}" to "${redirect}" and the client knows about it`, (): void => {
      const matchingEndpoints: string[] = []
      for (const {from, to} of devRedirects) {
        if (to && from && from.test(urlExample)) {
          const name = to.slice(1).split('.')[0]
          matchingEndpoints.push(name)
        }
      }
      expect(matchingEndpoints, JSON.stringify(matchingEndpoints)).to.have.lengthOf(1)
    })
  }

  // TODO(cyrille): Test the nginx conf somehow.

  // CloudFront => aux_pages_redirect lambda.

  for (const {LambdaFunctionAssociations, PathPattern} of cloudfront.CacheBehaviors.Items) {
    if (!LambdaFunctionAssociations || !LambdaFunctionAssociations.Items) {
      continue
    }
    if (!LambdaFunctionAssociations.Items[0].LambdaFunctionARN.includes(
      'bob-aux-pages-redirect')) {
      continue
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
      expect(auxPagesLambda).to.be.ok
      const {LambdaFunctionAssociations: associations} = selectCloudfrontBehavior(urlExample)
      const lambdas = (associations && associations.Items || []).
        map(({LambdaFunctionARN}) => LambdaFunctionARN)
      expect(lambdas, JSON.stringify(lambdas)).to.include(auxPagesLambda)
    })
  }
})
