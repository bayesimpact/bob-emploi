import {expect} from 'chai'
import getAllDeployments from '../../cfg/deployment'

describe('allDeployments', async () => {
  const allDeployments = await getAllDeployments()

  it('should have at least an fr, usa, uk, dev and demo deployments', () => {
    expect(allDeployments).to.be.an('object').that.include.
      all.keys('fr', 'dev', 'demo', 'usa', 'uk')
  })

  const corePlugin = allDeployments.dev.plugins.find(({name}) => name === 'core')
  it('should have at least a core plugin', () => {
    expect(corePlugin).to.be.an('object')
  })
  if (!corePlugin) {
    return
  }
  const configKeys = Object.keys(corePlugin.constants || {})
  it('should have at least a few constants', () => {
    expect(configKeys).to.be.an('array').that.includes.members(
      ['clientVersion', 'canonicalUrl', 'productName'])
  })

  for (const [deploymentName, deploymentConfig] of Object.entries(allDeployments)) {
    describe(`"${deploymentName}" deployment`, () => {
      it('should have at least one plugin', () => {
        expect(deploymentConfig).to.be.an('object').
          that.includes.all.keys('plugins')
        expect(deploymentConfig.plugins).to.be.an('array').that.is.not.empty
      })

      for (const {name, constants} of deploymentConfig.plugins) {
        if (deploymentName === 'dev' && name === 'core') {
          continue
        }
        describe(`"${name}" plugin`, () => {
          it('should have all the constants found in the core plugin in dev deployment', () => {
            expect(constants).to.be.an('object').
              that.includes.all.keys(configKeys)
          })
        })
      }
    })
  }
})
