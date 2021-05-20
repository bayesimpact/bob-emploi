import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React from 'react'

import Select from 'components/select'


interface BirthYearSelectOption {
  name: string
  value: number
}


interface Props {
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


const BirthYearSelector = (props: Props): React.ReactElement => {
  return <Select<number>
    options={yearOfBirthRange}
    defaultMenuScroll={yearOfBirthRange.length - 20}
    {...props} />
}
BirthYearSelector.propTypes = {
  value: PropTypes.number,
}


export default React.memo(BirthYearSelector)
