import _isEqual from 'lodash/isEqual'
import _memoize from 'lodash/memoize'
import _without from 'lodash/without'
import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'
import ReactSelect from 'react-select'
// TODO(pascal): Try to find a way to drop this.
import {Props as ReactSelectProps} from 'react-select/lib/Select'

import {isMobileVersion} from 'components/mobile'
import {LabeledToggle} from 'components/theme'


const getName = ({name}): string => name
const getIsDisabled = ({disabled}: {disabled?: boolean}): boolean => !!disabled


interface RadioGroupProps<T> {
  onChange: (value: T) => void
  options: readonly {
    name: string
    value: T
  }[]
  style?: React.CSSProperties
  value?: T
}


class RadioGroup<T> extends React.PureComponent<RadioGroupProps<T>> {
  public static propTypes = {
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.number,
        PropTypes.string,
      ]).isRequired,
    })).isRequired,
    style: PropTypes.object,
    value: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.number,
      PropTypes.string,
    ]),
  }

  private handleChange = _memoize((value: T): (() => void) =>
    (): void => this.props.onChange(value))

  public render(): React.ReactNode {
    const {options, style, value} = this.props
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      ...style,
    }
    return <div style={containerStyle}>
      {options.map((option): React.ReactNode => {
        return <LabeledToggle
          key={option.value + ''} label={option.name} type="radio"
          isSelected={option.value === value}
          onClick={this.handleChange(option.value)} />
      })}
    </div>
  }
}


interface CheckboxListProps<T> {
  checkboxStyle?: React.CSSProperties
  onChange: (value: T[]) => void
  options: readonly {
    name: React.ReactNode
    value: T
  }[]
  style?: React.CSSProperties
  values: T[]
}


interface CheckboxListState<T> {
  values?: T[]
  valuesSelected?: Set<T>
}


class CheckboxList<T = string>
  extends React.PureComponent<CheckboxListProps<T>, CheckboxListState<T>> {
  public static propTypes = {
    checkboxStyle: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    // The sorted list of selectable options.
    options: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.node.isRequired,
      value: PropTypes.string,
    })),
    style: PropTypes.object,
    values: PropTypes.arrayOf(PropTypes.string),
  }

  public state: CheckboxListState<T> = {}

  public static getDerivedStateFromProps<T>({values = []}, {values: prevValues}):
  CheckboxListState<T> {
    if (values === prevValues) {
      return null
    }
    return {
      values,
      valuesSelected: new Set(values),
    }
  }

  private handleChange = _memoize((optionValue: T): (() => void) => (): void => {
    const {values, valuesSelected} = this.state
    const isSelected = valuesSelected.has(optionValue)
    const newValues = isSelected ?
      _without(values, optionValue) :
      [optionValue].concat(values)
    this.props.onChange(newValues)
  })

  public render(): React.ReactNode {
    const {options, checkboxStyle, onChange: omittedOnChange, values: omittedValues,
      ...extraProps} = this.props
    const {valuesSelected} = this.state
    const labelStyle = {
      marginTop: isMobileVersion ? 10 : 0,
      ...checkboxStyle,
    }

    return <div {...extraProps}>
      {(options || []).map((option): React.ReactNode => {
        const isSelected = valuesSelected.has(option.value)
        return <LabeledToggle
          key={option.value + ''} label={option.name} type="checkbox" style={labelStyle}
          isSelected={isSelected} onClick={this.handleChange(option.value)} />
      })}
    </div>
  }
}


interface FieldCheckProps {
  isMarkedInvalid?: boolean
  isValid?: boolean
  style?: React.CSSProperties
}


class FieldCheck extends React.PureComponent<FieldCheckProps> {
  public static propTypes = {
    isMarkedInvalid: PropTypes.bool,
    isValid: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {isMarkedInvalid, isValid, style} = this.props
    const checkboxStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: isMarkedInvalid ? colors.RED_PINK : colors.GREENISH_TEAL,
      borderRadius: '50%',
      bottom: 0,
      color: '#fff',
      display: 'flex',
      fontSize: 16,
      height: isMobileVersion ? 20 : 30,
      justifyContent: 'center',
      margin: 'auto',
      opacity: (!isMobileVersion && isValid) || isMarkedInvalid ? 1 : 0,
      overflow: 'hidden',
      position: 'absolute',
      right: isMobileVersion ? 30 : -10,
      top: isMobileVersion ? -70 : 0,
      transform: 'translateX(100%)',
      width: isMobileVersion ? 20 : 30,
      ...style,
    }
    const iconStyle: React.CSSProperties = {
      fill: '#fff',
      width: 20,
    }

    return <div style={checkboxStyle}>
      {isMarkedInvalid ? <CloseIcon style={iconStyle} /> : null}
      {isValid ? <CheckIcon style={iconStyle} /> : null}
    </div>
  }
}


interface FieldSetProps {
  children: React.ReactNode
  disabled?: boolean
  hasCheck?: boolean
  hasNoteOrComment?: boolean
  isInline?: boolean
  isValid?: boolean
  isValidated?: boolean
  label?: React.ReactNode
  style?: React.CSSProperties
}


class FieldSet extends React.PureComponent<FieldSetProps> {
  public static propTypes = {
    children: PropTypes.node,
    // We keep disabled by consistency with the DOM fieldset element.
    // eslint-disable-next-line react/boolean-prop-naming
    disabled: PropTypes.bool,
    hasCheck: PropTypes.bool,
    hasNoteOrComment: PropTypes.bool,
    isInline: PropTypes.bool,
    isValid: PropTypes.bool,
    isValidated: PropTypes.bool,
    label: PropTypes.node,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, disabled, hasCheck, hasNoteOrComment, isInline, isValid, isValidated, label,
      style, ...otherProps} = this.props
    const isMarkedInvalid = !disabled && isValidated && !isValid
    const containerStyle: React.CSSProperties = {
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      marginBottom: hasNoteOrComment || isInline ? 0 : 25,
      marginLeft: 0,
      marginRight: 0,
      opacity: disabled ? 0.5 : 'inherit',
      padding: 0,
      position: 'relative',
      ...style,
    }
    const fieldStyle: React.CSSProperties = {
      position: 'relative',
    }

    const labelStyle: React.CSSProperties = {
      color: isInline && isMarkedInvalid ? colors.RED_PINK : colors.CHARCOAL_GREY,
      fontSize: 15,
      lineHeight: 1.3,
      marginBottom: isInline ? 0 : 11,
    }

    return <fieldset
      style={containerStyle} disabled={disabled}
      className={isMarkedInvalid ? 'marked-invalid' : ''}
      {...otherProps}>
      <label style={labelStyle}>{label}</label>
      <div style={fieldStyle}>
        <div>
          {children}
        </div>
        {(hasCheck && isValid) || isMarkedInvalid ?
          <FieldCheck isValid={isValid} isMarkedInvalid={isMarkedInvalid} /> : null}
      </div>
    </fieldset>
  }
}


interface SelectOption<T> {
  disabled?: boolean
  name: string
  value: T
}


type Omit<T, Keys> = Pick<T, Exclude<keyof T, Keys>>


interface SelectProps<T> extends Omit<ReactSelectProps<SelectOption<T>>, 'onChange'> {
  areUselessChangeEventsMuted?: boolean
  defaultMenuScroll?: number
  isMulti?: boolean
  onChange: ((value: T) => void) | ((value: T[]) => void)
  options: readonly SelectOption<T>[]
  style?: React.CSSProperties
  value?: T | T[]
}


type ReactSelectCSSProperties = React.CSSProperties & {'&:hover': React.CSSProperties}


class Select<T = string> extends React.PureComponent<SelectProps<T>> {
  public static propTypes = {
    areUselessChangeEventsMuted: PropTypes.bool.isRequired,
    // Number of options to scroll the menu when first opened.
    defaultMenuScroll: PropTypes.number,
    isMulti: PropTypes.bool,
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

  public static defaultProps = {
    areUselessChangeEventsMuted: true,
  }

  private handleChange = (option): void => {
    if (!option) {
      return
    }
    const {areUselessChangeEventsMuted, isMulti, onChange, value: oldValue} = this.props
    if (isMulti) {
      const values = option.map(({value}): T => value)
      if (!areUselessChangeEventsMuted || !_isEqual(values, oldValue)) {
        onChange(values)
      }
      return
    }
    const {value} = option
    if (!areUselessChangeEventsMuted || (value !== oldValue)) {
      onChange(value)
    }
  }

  private subComponent: React.RefObject<ReactSelect<SelectOption<T>>> = React.createRef()

  private handleMenuOpen = (): void => {
    const {defaultMenuScroll, options, value} = this.props
    if (!defaultMenuScroll || value ||
      !this.subComponent.current || !this.subComponent.current.select) {
      return
    }
    const select = this.subComponent.current.select
    setTimeout((): void => {
      select.setState(
        {focusedOption: options[defaultMenuScroll - 1]},
        (): void => {
          select.focusOption('pagedown')
        },
      )
    })
  }

  private makeValueProp = (): SelectOption<T> | SelectOption<T>[] => {
    const {isMulti, options, value} = this.props
    if (isMulti) {
      return (value as T[]).map(
        (v): SelectOption<T> => options.find(({value: optionValue}): boolean => v === optionValue))
    }
    return options.find(({value: optionValue}): boolean => value === optionValue)
  }

  public render(): React.ReactNode {
    const {defaultMenuScroll: omittedDefaultMenuScroll, onChange: omittedOnChange, options, style,
      value: omittedValue, ...otherProps} = this.props
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
    const ref = (this.subComponent as unknown) as React.RefObject<ReactSelect<SelectOption<T>>>
    return <ReactSelect<SelectOption<T>>
      onChange={this.handleChange}
      value={this.makeValueProp()}
      getOptionLabel={getName}
      isOptionDisabled={getIsDisabled}
      styles={{
        container: (base): React.CSSProperties => ({...base, ...selectStyle}),
        control: (base, {isFocused, isSelected}): ReactSelectCSSProperties => ({
          ...base,
          '&:hover': {
            ...base['&:hover'],
            borderColor: (isFocused || isSelected) ? colors.BOB_BLUE : colors.COOL_GREY,
          },
          borderColor: (isFocused || isSelected) ? colors.BOB_BLUE : colors.SILVER,
          borderRadius: 0,
          boxShadow: 'initial',
          height: selectStyle.height,
        }),
        placeholder: (base): React.CSSProperties => ({
          ...base,
          color: colors.COOL_GREY,
        }),
      }}
      options={options}
      clearable={false}
      menuContainerStyle={menuContainerStyle}
      onMenuOpen={this.handleMenuOpen}
      ref={ref}
      {...otherProps} />
  }
}


export {CheckboxList, FieldSet, RadioGroup, Select}
