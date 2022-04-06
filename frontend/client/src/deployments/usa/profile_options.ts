import type {LocalizableString} from 'store/i18n'
import {prepareT, prepareT as prepareTNoExtract} from 'store/i18n'

import type {LocalizedSelectOption} from 'components/select'

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}

const DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[] = [
  {name: prepareTNoExtract('Lower than high-school'), value: 'NO_DEGREE'},
  {name: prepareTNoExtract('Some High-school'), value: 'CAP_BEP'},
  {name: prepareTNoExtract('High-school Diploma / GED'), value: 'BAC_BACPRO'},
  {
    name: prepareTNoExtract("Associate's Degree or Other Professional Certification"),
    value: 'BTS_DUT_DEUG',
  },
  {name: prepareTNoExtract("Bachelor's Degree"), value: 'LICENCE_MAITRISE'},
  {name: prepareTNoExtract("Master's Degree or Higher"), value: 'DEA_DESS_MASTER_PHD'},
]

const RACE_OPTIONS: readonly LocalizedSelectOption<string>[] = [
  {name: prepareT('asiatique'), value: 'ASIAN'},
  {name: prepareT('noir·e ou afro-américain·e', {context: ''}), value: 'BLACK_OR_AFRICAN_AMERICAN'},
  {name: prepareT('hispanique ou latino'), value: 'HISPANIC_OR_LATINO'},
  {
    name: prepareT('multiracial·e ou multiethnique', {context: ''}),
    value: 'MULTIRACIAL_OR_MULTIETHNIC',
  },
  {
    name: prepareT("indien·ne d'Amérique ou autochtone de l'Alaska", {context: ''}),
    value: 'NATIVE_AMERICAN_OR_ALASKA',
  },
  {name: prepareT('blanc·he', {context: ''}), value: 'WHITE'},
]

export {DEGREE_OPTIONS, RACE_OPTIONS}
