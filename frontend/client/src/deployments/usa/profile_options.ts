import {LocalizableString, prepareT as prepareTNoExtract} from 'store/i18n'

import {LocalizedSelectOption} from 'components/select'

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}

const DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[] = [
  {name: prepareTNoExtract('--'), value: 'NO_DEGREE'},
  {name: prepareTNoExtract('Some High-school'), value: 'CAP_BEP'},
  {name: prepareTNoExtract('High-school Diploma / GED'), value: 'BAC_BACPRO'},
  {
    name: prepareTNoExtract("Associate's Degree or Other Professional Certification"),
    value: 'BTS_DUT_DEUG',
  },
  {name: prepareTNoExtract("Bachelor's Degree"), value: 'LICENCE_MAITRISE'},
  {name: prepareTNoExtract("Master's Degree or Higher"), value: 'DEA_DESS_MASTER_PHD'},
]

// eslint-disable-next-line import/prefer-default-export
export {DEGREE_OPTIONS}
