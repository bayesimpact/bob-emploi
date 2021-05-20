import chai, {expect} from 'chai'
import chaiAlmost from 'chai-almost'
import {changeColorLightness, colorToHSL} from '../../src/components/colors'

chai.use(chaiAlmost(1e-3))

describe('colorToHSL', (): void => {
  it('should compute Hue Saturation Lightness on a well known case', (): void => {
    expect(colorToHSL('#1888ff')).to.almost.eql({
      hue: 210.909,
      lightness: .547,
      saturation: 1,
    })
  })
})

describe('changeColorLightness', (): void => {
  it('should compute a ligher blue on a welll known case', (): void => {
    expect(changeColorLightness('#1888ff', 20)).to.eql('hsl(211deg 100% 75%)')
  })
})
