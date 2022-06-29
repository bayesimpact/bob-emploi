import _range from 'lodash/range'
import React from 'react'

import type {Focusable} from 'components/select'
import Select from 'components/select'


interface BirthYearSelectOption {
  name: string
  value: number
}


interface Props {
  ['aria-labelledby']?: string
  ['aria-describedby']?: string
  onChange: (value: number) => void
  placeholder?: string
  value?: number
}


const yearOfBirthRange = ((): readonly BirthYearSelectOption[] => {
  const currentYear = new Date().getFullYear()
  // We probably don't have any users under the age of 14 or over 100
  const maxBirthYear = currentYear - 14
  const minBirthYear = currentYear - 100
  return _range(minBirthYear, maxBirthYear).map((year): BirthYearSelectOption =>
    ({name: year + '', value: year}),
  )
})()


const BirthYearSelector = (props: Props, ref?: React.Ref<Focusable>): React.ReactElement => {
  return <Select<number>
    isSearchableOnMobile={true}
    options={yearOfBirthRange}
    defaultMenuScroll={yearOfBirthRange.length - 20}
    ref={ref}
    {...props} />
}


export default React.memo(React.forwardRef(BirthYearSelector))
