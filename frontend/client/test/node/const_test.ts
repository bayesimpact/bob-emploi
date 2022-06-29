import {expect} from 'chai'
import type {Deployments, PluginInDeployment} from '../../cfg/deployment'
import getAllDeployments from '../../cfg/deployment'

describe('allDeployments', () => {
  let allDeployments: Deployments|undefined
  let corePlugin: PluginInDeployment|undefined
  let configKeys: readonly string[] = []

  before(async () => {
    allDeployments = await getAllDeployments()
    corePlugin = allDeployments.dev.plugins.find(({name}) => name === 'core')
    if (corePlugin) {
      configKeys = Object.keys(corePlugin.constants.config || {})
    }
  })

  it('should have at least an fr, usa, uk, dev and demo deployments', () => {
    expect(allDeployments).to.be.an('object').that.include.
      all.keys('fr', 'dev', 'demo', 'usa', 'uk')
  })

  it('should have at least a core plugin', () => {
    expect(corePlugin).to.be.an('object')
  })

  it('should have at least a few constants', () => {
    if (!corePlugin) {
      return
    }
    expect(configKeys).to.be.an('array').that.includes.members(
      ['clientVersion', 'canonicalUrl', 'productName'])
  })

  describe('each deployment', () => {
    it('should have at least one plugin', () => {
      if (!allDeployments) {
        return
      }
      for (const [deploymentName, deploymentConfig] of Object.entries(allDeployments)) {
        expect(deploymentConfig, deploymentName).to.be.an('object').
          that.includes.all.keys('plugins')
        expect(deploymentConfig.plugins, deploymentName).to.be.an('array').that.is.not.empty
      }
    })

    describe('each plugin', () => {
      it('should have all the constants found in the core plugin in dev deployment', () => {
        if (!allDeployments) {
          return
        }
        for (const [deploymentName, deploymentConfig] of Object.entries(allDeployments)) {
          for (const {name, constants: {config}} of deploymentConfig.plugins) {
            if (deploymentName === 'dev' && name === 'core') {
              continue
            }
            expect(config, `${deploymentName} ${name}`).to.be.an('object').
              that.includes.all.keys(configKeys)
          }
        }
      })
    })
  })
})
