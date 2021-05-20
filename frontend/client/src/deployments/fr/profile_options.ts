import {LocalizableString, prepareT as prepareTNoExtract} from 'store/i18n'

import {LocalizedSelectOption} from 'components/select'

interface SelectOption<T = string> extends LocalizedSelectOption<T> {
  readonly equivalent?: LocalizableString
}
const DEGREE_OPTIONS: readonly SelectOption<bayes.bob.DegreeLevel>[] = [
  {name: prepareTNoExtract('--'), value: 'NO_DEGREE'},
  {name: prepareTNoExtract('CAP - BEP'), value: 'CAP_BEP'},
  {name: prepareTNoExtract('Bac - Bac Pro'), value: 'BAC_BACPRO'},
  {
    equivalent: prepareTNoExtract('Bac+2'),
    name: prepareTNoExtract('BTS - DUT - DEUG'),
    value: 'BTS_DUT_DEUG',
  },
  {
    equivalent: prepareTNoExtract('Bac+3'),
    name: prepareTNoExtract('Licence - Maîtrise'),
    value: 'LICENCE_MAITRISE',
  },
  {
    equivalent: prepareTNoExtract('Bac+5 et plus'),
    name: prepareTNoExtract('DEA - DESS - Master - PhD'),
    value: 'DEA_DESS_MASTER_PHD',
  },
]

// eslint-disable-next-line import/prefer-default-export
export {DEGREE_OPTIONS}
