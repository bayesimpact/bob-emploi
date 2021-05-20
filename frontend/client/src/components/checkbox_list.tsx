import _without from 'lodash/without'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import isMobileVersion from 'store/mobile'
import LabeledToggle from 'components/labeled_toggle'


interface Props<T> {
  checkboxStyle?: React.CSSProperties | ((index: number) => React.CSSProperties)
  onChange: (value: readonly T[]) => void
  options: readonly {
    name: React.ReactNode
    value: T
  }[]
  selectedCheckboxStyle?: React.CSSProperties
  style?: React.CSSProperties
  values: readonly T[] | undefined
}


const emptyArray = [] as const
const typedMemo: <T>(c: T) => T = React.memo


type LabeledToggleProps = React.ComponentProps<typeof LabeledToggle>
interface CheckboxListItemProps<T> extends Omit<LabeledToggleProps, 'onClick'|'type'> {
  onClick: (value: T) => void
  value: T
}


const CheckboxListItemBase = <T extends string>(
  props: CheckboxListItemProps<T>): React.ReactElement => {
  const {onClick, value, ...otherProps} = props
  const handleClick = useCallback((): void => {
    onClick?.(value)
  }, [onClick, value])
  return <LabeledToggle type="checkbox" onClick={handleClick} {...otherProps} />
}
const CheckboxListItem = typedMemo(CheckboxListItemBase)


const CheckboxList = <T extends string = string>(props: Props<T>): React.ReactElement => {
  const {options, checkboxStyle, onChange, selectedCheckboxStyle, values = emptyArray,
    ...extraProps} = props
  const valuesSelected = useMemo((): Set<T> => new Set(values), [values])

  const handleChange = useCallback((optionValue: T): void => {
    const isSelected = valuesSelected.has(optionValue)
    const newValues = isSelected ?
      _without(values, optionValue) :
      [optionValue, ...values]
    onChange(newValues)
  }, [onChange, values, valuesSelected])

  const labelStyle = {
    marginTop: isMobileVersion ? 10 : 0,
  }

  return <div {...extraProps}>
    {(options || []).map((option, index): React.ReactNode => {
      const isSelected = valuesSelected.has(option.value)
      return <CheckboxListItem<T>
        key={option.value + ''} label={option.name}
        style={{
          ...labelStyle,
          ...(typeof checkboxStyle === 'function' ? checkboxStyle(index) : checkboxStyle),
          ...isSelected && selectedCheckboxStyle,
        }}
        isSelected={isSelected} onClick={handleChange} value={option.value} />
    })}
  </div>
}
CheckboxList.propTypes = {
  onChange: PropTypes.func.isRequired,
  // The sorted list of selectable options.
  options: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.node.isRequired,
    value: PropTypes.string,
  })),
  selectedCheckboxStyle: PropTypes.object,
  style: PropTypes.object,
  values: PropTypes.arrayOf(PropTypes.string),
}


export default typedMemo(CheckboxList)
