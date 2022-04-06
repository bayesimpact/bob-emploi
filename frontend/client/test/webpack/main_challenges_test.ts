import {expect} from 'chai'
import i18n from 'i18next'
import {diagnosticMainChallengesI18nFields} from 'store/main_challenges'


i18n.init({
  compatibilityJSON: 'v3',
  keySeparator: false,
  lng: 'fr',
  nsSeparator: false,
  resources: {},
})


function toCamelCase(snakeCase: string): string {
  return snakeCase.split('_').
    map((word, index) => index ? word.slice(0, 1).toUpperCase() + word.slice(1) : word).
    join('')
}

describe('diagnosticMainChallengesI18nFields', (): void => {
  let translatableFields: readonly string[] = []
  before(async () => {
    const {default: airtableFields} = await import('../../airtable_fields.json5')
    translatableFields = (airtableFields.diagnosticMainChallenges.translatableFields || []).
      filter(field => !field.startsWith('title_')).
      map(toCamelCase)
  })

  it('should be in sync with translated values', () => {
    expect(diagnosticMainChallengesI18nFields).to.eql(translatableFields)
  })
})
