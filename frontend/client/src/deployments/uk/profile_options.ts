import {LocalizableString, prepareT as prepareTNoExtract} from 'store/i18n'

import {LocalizedSelectOption} from 'components/select'

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}

const DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[] = [
  {name: prepareTNoExtract('--'), value: 'NO_DEGREE'},
  {name: prepareTNoExtract('GCSEs, NVQ level 2 or Intermediate 2'), value: 'CAP_BEP'},
  {name: prepareTNoExtract('A levels, NVQ level 3 or Highers'), value: 'BAC_BACPRO'},
  {name: prepareTNoExtract('Foundation degree or Higher National Diploma'), value: 'BTS_DUT_DEUG'},
  {name: prepareTNoExtract("Bachelor's degree"), value: 'LICENCE_MAITRISE'},
  {name: prepareTNoExtract('Postgraduate degree or diploma'), value: 'DEA_DESS_MASTER_PHD'},
]

// eslint-disable-next-line import/prefer-default-export
export {DEGREE_OPTIONS}
