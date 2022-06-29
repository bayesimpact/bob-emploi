import {expect} from 'chai'
import i18n from 'i18next'
import {vaeI18nFields} from 'store/statistics'


i18n.init({
  compatibilityJSON: 'v3',
  keySeparator: false,
  lng: 'fr',
  nsSeparator: false,
  resources: {},
})

describe('vaeI18nFields', (): void => {
  let translatableFields: readonly string[] = []
  before(async () => {
    const {default: airtableFields} = await import('../../airtable_fields.json5')
    translatableFields = airtableFields.vae.translatableFields || []
  })

  it('should be in sync with translated values', () => {
    expect(vaeI18nFields).to.eql(translatableFields)
  })
})
