import _omit from 'lodash/omit'
import _without from 'lodash/without'
import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'
import ReactSelect from 'react-select'

import {isMobileVersion} from 'components/mobile'
import {LabeledToggle} from 'components/theme'


class RadioGroup extends React.Component {
  static propTypes = {
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

  render() {
    const {options, style, value} = this.props
    const containerStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      ...style,
    }
    return <div style={containerStyle}>
      {options.map(option => {
        return <LabeledToggle
          key={option.value} label={option.name} type="radio"
          isSelected={option.value === value}
          onClick={() => this.props.onChange(option.value)} />
      })}
    </div>
  }
}


class CheckboxList extends React.Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    // The sorted list of selectable options.
    options: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.node.isRequired,
      value: PropTypes.string,
    })),
    style: PropTypes.object,
    values: PropTypes.arrayOf(PropTypes.string),
  }

  state = {}

  static getDerivedStateFromProps({values = []}, {values: prevValues}) {
    if (values === prevValues) {
      return null
    }
    return {
      values,
      valuesSelected: new Set(values),
    }
  }

  handleChange = optionValue => {
    const {values, valuesSelected} = this.state
    const isSelected = valuesSelected.has(optionValue)
    const newValues = isSelected ?
      _without(values, optionValue) :
      [optionValue].concat(values)
    this.props.onChange(newValues)
  }

  render() {
    const {options, ...extraProps} = this.props
    const {valuesSelected} = this.state
    const checkboxStyle = {
      marginTop: isMobileVersion ? 10 : 0,
    }

    return <div {..._omit(extraProps, ['values'])}>
      {(options || []).map(option => {
        const isSelected = valuesSelected.has(option.value)
        return <LabeledToggle
          key={option.value} label={option.name} type="checkbox" style={checkboxStyle}
          isSelected={isSelected} onClick={() => this.handleChange(option.value)} />
      })}
    </div>
  }
}


class FieldCheck extends React.Component {
  static propTypes = {
    isMarkedInvalid: PropTypes.bool,
    isValid: PropTypes.bool,
    style: PropTypes.object,
  }

  render() {
    const {isMarkedInvalid, isValid, style} = this.props
    const checkboxStyle = {
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
    const iconStyle = {
      fill: '#fff',
      width: 20,
    }

    return <div style={checkboxStyle}>
      {isMarkedInvalid ? <CloseIcon style={iconStyle} /> : null}
      {isValid ? <CheckIcon style={iconStyle} /> : null}
    </div>
  }
}


class FieldSet extends React.Component {
  static propTypes = {
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

  render() {
    const {children, disabled, hasCheck, hasNoteOrComment, isInline, isValid, isValidated, label,
      style, ...otherProps} = this.props
    const isMarkedInvalid = !disabled && isValidated && !isValid
    const containerStyle = {
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
    const fieldStyle = {
      position: 'relative',
    }

    const labelStyle = {
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


class Select extends React.Component {
  static propTypes = {
    areUselessChangeEventsMuted: PropTypes.bool.isRequired,
    // Number of options to scroll the menu when first opened.
    defaultMenuScroll: PropTypes.number,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
      disabled: PropTypes.bool,
      name: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })).isRequired,
    placeholder: PropTypes.string,
    style: PropTypes.object,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }

  static defaultProps = {
    areUselessChangeEventsMuted: true,
  }

  handleChange = option => {
    if (!option) {
      return
    }
    const {areUselessChangeEventsMuted, onChange, value: oldValue} = this.props
    const {value} = option
    if (!areUselessChangeEventsMuted || (value !== oldValue)) {
      onChange(value)
    }
  }

  handleMenuOpen = () => {
    const {defaultMenuScroll, options, value} = this.props
    if (!defaultMenuScroll || value || !this.subComponent || !this.subComponent.select) {
      return
    }
    setTimeout(() => {
      this.subComponent.select.setState(
        {focusedOption: options[defaultMenuScroll - 1]},
        () => {
          this.subComponent.select.focusOption('pagedown')
        },
      )
    })
  }

  render() {
    const {options, placeholder, style, value, ...otherProps} = this.props
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
    return <ReactSelect
      onChange={this.handleChange}
      value={options.find(({value: optionValue}) => value === optionValue)}
      getOptionLabel={({name}) => name}
      isOptionDisabled={({disabled}) => !!disabled}
      styles={{
        container: base => ({...base, ...selectStyle}),
        control: (base, {isFocused, isSelected}) => ({
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
        placeholder: base => ({
          ...base,
          color: colors.COOL_GREY,
        }),
      }}
      options={options}
      clearable={false}
      placeholder={placeholder}
      menuContainerStyle={menuContainerStyle}
      onMenuOpen={this.handleMenuOpen}
      ref={subComponent => {
        this.subComponent = subComponent
      }}
      {..._omit(otherProps, ['defaultMenuScroll', 'onChange'])} />
  }
}

export {CheckboxList, FieldSet, RadioGroup, Select}
