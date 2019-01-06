import {expect} from 'chai'
import {assetProps} from 'store/skills'

import {SkillAsset} from 'api/skill'

describe('assetProps', () => {
  const allKnownAssets = Object.keys(SkillAsset).filter(topic => SkillAsset[topic])
  const describedAssets = Object.keys(assetProps)

  it('covers all assets, and only them', () => {
    expect(describedAssets).to.have.members(allKnownAssets)
    expect(describedAssets.length).to.equal(allKnownAssets.length)
  })

  it('gives consistent data for all assets and all users', () => {
    const tutoie = (tu, unusedVous) => tu
    const vouvoie = (tu, vous) => vous
    describedAssets.map(asset => assetProps[asset]).forEach(({description, icon, name}) => {
      expect(name).to.be.a('string').that.is.not.empty
      expect(icon).not.to.be.undefined
      expect(description).to.be.a('function')
      expect(description(tutoie)).to.be.a('string').that.is.not.empty
      expect(description(vouvoie)).to.be.a('string').that.is.not.empty
    })
  })
})
