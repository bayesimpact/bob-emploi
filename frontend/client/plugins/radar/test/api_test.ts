import {expect} from 'chai'
import {getDossierId} from '../src/api'

// TODO(cyrille): Add more tests.
describe('getDossierId', () => {
  it('should parse the relevant dossier ID in real URLs', () => {
    expect(getDossierId('/dossier/12345')).to.eq('12345')
    expect(getDossierId('/dossier/12345/synthese')).to.eq('12345')
    expect(getDossierId('/dossier/12345/suivi/programmes')).to.eq('12345')
  })
})
