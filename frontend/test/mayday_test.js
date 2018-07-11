import {expect} from 'chai'

import {imageSets} from 'components/pages/mayday'
import actions from 'components/pages/mayday/actions.json'

describe('Mayday Actions', () => {
  it('has an imageSet for every imported action', () => {
    const actionIds = actions.map(({id}) => id)
    expect(actionIds).to.have.members(Object.keys(imageSets))
    expect(Object.keys(imageSets)).to.have.members(actionIds)
  })
})
