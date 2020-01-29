import {expect} from 'chai'
import {AssetProp, assetProps} from 'store/skills'

// @ts-ignore
import {SkillAsset} from 'api/skill'

describe('assetProps', (): void => {
  const allKnownAssets = Object.keys(SkillAsset).filter((topic): boolean => SkillAsset[topic])
  const describedAssets = Object.keys(assetProps)

  it('covers all assets, and only them', (): void => {
    expect(describedAssets).to.have.members(allKnownAssets)
    expect(describedAssets.length).to.equal(allKnownAssets.length)
  })

  it('gives consistent data for all assets and all users', (): void => {
    describedAssets.map((asset): AssetProp => assetProps[asset]).
      forEach(({icon, name}): void => {
        expect(name).to.be.a('string').that.is.not.empty
        expect(icon).not.to.be.undefined
      })
  })
})
