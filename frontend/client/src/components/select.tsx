import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useRef} from 'react'
import ReactSelect from 'react-select'

import {WithLocalizableName} from 'store/i18n'

const getName = ({name}: {name: string}): string => name
const getIsDisabled = ({disabled}: {disabled?: boolean}): boolean => !!disabled


export interface SelectOption<T = string> {
  disabled?: boolean
  name: string
  value: T
}


export type LocalizedSelectOption<T> = Omit<SelectOption<T>, 'name'> & WithLocalizableName


type ReactSelectProps<T> = ReactSelect<T>['props']

interface SelectProps<T> extends Omit<ReactSelectProps<SelectOption<T>>, 'onChange'> {
  areUselessChangeEventsMuted?: boolean
  defaultMenuScroll?: number
  onChange: (value: T) => void
  options: readonly SelectOption<T>[]
  style?: React.CSSProperties
  value?: T
}


const Select = <T extends unknown = string>(props: SelectProps<T>): React.ReactElement => {
  const {areUselessChangeEventsMuted = true, defaultMenuScroll, onChange, options, style,
    value, ...otherProps} = props

  const handleChange = useCallback(
    (option?: SelectOption<T>|null): void => {
      if (!option) {
        return
      }
      const {value: newValue} = option
      if (!areUselessChangeEventsMuted || (newValue !== value)) {
        onChange(newValue)
      }
    },
    [areUselessChangeEventsMuted, onChange, value],
  )

  const subComponent = useRef<ReactSelect<SelectOption<T>, false>>()

  const handleMenuOpen = useCallback((): void => {
    const {select = undefined} = subComponent.current || {}
    if (!select) {
      return
    }
    // Either focus on the value or the defaultMenuScroll.
    const focusedOption = value &&
      options.findIndex(({value: thisValue}): boolean => value === thisValue) + 1 || 1 - 1 ||
      defaultMenuScroll
    if (!focusedOption) {
      return
    }
    window.setTimeout((): void => {
      // Hack to have the desired element at the start of the menu page.
      select.setState(
        {focusedOption: options[focusedOption - 1]},
        (): void => {
          select.focusOption('pagedown')
        },
      )
    })
  }, [defaultMenuScroll, options, value])

  const valueProp = useMemo(
    (): SelectOption<T> | undefined =>
      options.find(({value: optionValue}): boolean => value === optionValue),
    [options, value])

  const selectStyle = {
    color: colors.CHARCOAL_GREY,
    height: 41,
    lineHeight: 1.5,
    width: '100%',
    ...style,
  }
  const menuContainerStyle = {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  }
  // TODO(pascal): Fix type of ReactSelect exported component.
  const ref = (subComponent as unknown) as React.Ref<ReactSelect<SelectOption<T>, false>>
  return <ReactSelect<SelectOption<T>, false>
    onChange={handleChange}
    value={valueProp}
    getOptionLabel={getName}
    isOptionDisabled={getIsDisabled}
    styles={{
      container: (base) => ({...base, ...selectStyle}),
      control: (base, {isFocused}) => ({
        ...base,
        '&:hover': {
          ...base['&:hover'] as typeof base,
          borderColor: isFocused ? colors.BOB_BLUE : colors.COOL_GREY,
        },
        'borderColor': isFocused ? colors.BOB_BLUE : colors.SILVER,
        'borderRadius': 0,
        'boxShadow': 'initial',
        'height': selectStyle.height,
      }),
      placeholder: (base) => ({
        ...base,
        color: colors.COOL_GREY,
      }),
    }}
    options={options}
    clearable={false}
    menuContainerStyle={menuContainerStyle}
    onMenuOpen={handleMenuOpen}
    ref={ref}
    {...otherProps} />
}
Select.propTypes = {
  areUselessChangeEventsMuted: PropTypes.bool,
  // Number of options to scroll the menu when first opened.
  defaultMenuScroll: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    disabled: PropTypes.bool,
    name: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  })).isRequired,
  style: PropTypes.object,
  value: PropTypes.oneOfType(
    [PropTypes.string, PropTypes.number, PropTypes.arrayOf(PropTypes.string.isRequired)]),
}


const typedMemo: <T>(c: T) => T = React.memo


export default typedMemo(Select)
