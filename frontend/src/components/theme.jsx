import React from 'react'
import PropTypes from 'prop-types'
import ReactMarkdown from 'react-markdown'
import Radium from 'radium'
import VisibilitySensor from 'react-visibility-sensor'
import _ from 'underscore'

import config from 'config'

import {JobSuggest} from 'components/suggestions'

require('styles/fonts/GTWalsheim/font.css')
require('mdi/css/materialdesignicons.min.css')

export const Colors = {
  BACKGROUND_GREY: '#f3f4f7',
  BUTTERSCOTCH: '#ffbc4c',
  CHARCOAL_GREY: '#383f52',
  COOL_GREY: '#9596a0',
  DARK: '#21293d',
  DARK_TWO: '#2c3449',
  GREENISH_TEAL: '#43d484',
  GREYISH_BROWN: '#575757',
  HOVER_GREEN: '#31bd59',
  LIGHTER_PURPLE: '#b755f2',
  LIGHT_GREY: '#f9fafd',
  LIGHT_NAVY_BLUE: '#2b5c7b',
  MODAL_PROJECT_GREY: '#e8eaf0',
  PALE_GREY_TWO: '#eceef2',
  PINKISH_GREY: '#cbcbd5',
  RED_PINK: '#ee4266',
  RED_PINK_HOVER: '#dc3457',
  SILVER: '#d9d9e0',
  SKY_BLUE: '#58bbfb',
  SKY_BLUE_HOVER: '#40a2e1',
  SLATE: '#4e5972',
  SQUASH: '#f5a623',
  SUN_YELLOW: '#ffd930',
  WARM_GREY: '#858585',
  WHITE_HALO: '#dcdcdc',
  WINDOWS_BLUE: '#4695c8',
}

export const SmoothTransitions = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}
export const FastTransitions = {
  transition: 'all 300ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}


export const Styles = {
  // Style for the sticker on top of a box that tells the users why we show them this box.
  BOX_EXPLANATION: {
    backgroundColor: Colors.SKY_BLUE,
    borderRadius: 4,
    color: '#fff',
    display: 'inline-block',
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: 500,
    left: -12,
    padding: 10,
    position: 'absolute',
    textAlign: 'center',
    top: -12,
  },
  CENTERED_COLUMN: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  // Style to compensate our font (GTWalsheim), that have a lot of space below
  // the baseline, when centering vertically.
  CENTER_FONT_VERTICALLY: {
    paddingTop: '.22em',
  },
  // Style to compensate our italic font (GTWalsheim), that have a lot of space
  // below the baseline, when centering vertically.
  CENTER_ITALIC_FONT: {
    paddingRight: '.08em',
    paddingTop: '.08em',
  },
  // Style for text input.
  // ! Border color is handled in App.css !
  INPUT: {
    background: 'inherit',
    color: Colors.CHARCOAL_GREY,
    fontSize: 15,
    fontWeight: 'normal',
    height: 41,
    paddingLeft: 15,
    paddingTop: 5,
    width: '100%',
    ...SmoothTransitions,
  },
  PROGRESS_GRADIENT: {
    backgroundImage: `linear-gradient(to bottom, #91dffe, ${Colors.SKY_BLUE})`,
  },
  VENDOR_PREFIXED: (property, value) => {
    const style = {}
    const propertySuffix = property.substr(0, 1).toUpperCase() + property.substr(1);
    ['Moz', 'Ms', 'O', 'Webkit'].forEach(prefix => {
      style[prefix + propertySuffix] = value
    })
    style[property] = value
    return style
  },
}


const BUTTON_TYPE_STYLES = {
  back: {
    backgroundColor: Colors.SILVER,
    hoverColor: Colors.COOL_GREY,
  },
  deletion: {
    backgroundColor: Colors.RED_PINK,
    disabledColor: 'rgba(238, 66, 102, .5)',
    hoverColor: Colors.RED_PINK_HOVER,
  },
  discreet: {
    backgroundColor: 'transparent',
    color: Colors.COOL_GREY,
    hoverColor: Colors.SILVER,
  },
  navigation: {
    backgroundColor: Colors.SKY_BLUE,
    disabledColor: 'rgba(88, 187, 251, .5)',
    hoverColor: Colors.SKY_BLUE_HOVER,
  },
  navigationOnImage: {
    backgroundColor: 'rgba(255, 255, 255, .3)',
    hoverColor: 'rgba(255, 255, 255, .5)',
  },
  validation: {
    backgroundColor: Colors.GREENISH_TEAL,
    disabledColor: '#a4e7c1',
    hoverColor: '#31bd59',
  },
}

class ButtonBase extends React.Component {
  static propTypes = {
    bounceDurationMs: PropTypes.number,
    children: PropTypes.node.isRequired,
    // We keep disabled by consistency with the DOM button element.
    // eslint-disable-next-line react/boolean-prop-naming
    disabled: PropTypes.bool,
    isHighlighted: PropTypes.bool,
    isNarrow: PropTypes.bool,
    isProgressShown: PropTypes.bool,
    onClick: PropTypes.func,
    onMouseDown: PropTypes.func,
    style: PropTypes.object,
    type: PropTypes.oneOf(Object.keys(BUTTON_TYPE_STYLES)),
  }
  static defaultProps = {
    bounceDurationMs: 50,
  }

  state = {
    isBouncing: false,
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  blur() {
    this.dom && this.dom.blur()
  }

  handleMouseDown = event => {
    const {bounceDurationMs, onMouseDown} = this.props
    this.setState({isBouncing: true})
    this.timeout = setTimeout(() => this.setState({isBouncing: false}), bounceDurationMs)
    onMouseDown && onMouseDown(event)
  }

  render() {
    const {bounceDurationMs, children, disabled, isNarrow, isProgressShown, type, style,
      isHighlighted, ...otherProps} = this.props
    const {isBouncing} = this.state
    const typeStyle = BUTTON_TYPE_STYLES[type] || BUTTON_TYPE_STYLES.navigation

    const buttonStyle = {
      backgroundColor: typeStyle.backgroundColor,
      border: 'none',
      borderRadius: 100,
      color: typeStyle.color || '#fff',
      cursor: 'pointer',
      flexShrink: 0,
      fontFamily: 'GTWalsheim',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: 500,
      padding: isNarrow ? '8px 21px 6px' : '10px 39px 8px',
      textAlign: 'center',
      transition: SmoothTransitions.transition + `, transform ${bounceDurationMs}ms`,
      ...style,
    }
    if (isBouncing) {
      buttonStyle.transform =
        (buttonStyle.transform ? `${buttonStyle.transform} ` : '') + 'scale(.97)'
    }
    if (!disabled) {
      buttonStyle[':hover'] = {
        backgroundColor: typeStyle.hoverColor,
        ...(style ? style[':hover'] : {}),
      }
      buttonStyle[':focus'] = buttonStyle[':hover']
    } else {
      buttonStyle[':hover'] = {}
      buttonStyle.backgroundColor = typeStyle.disabledColor || 'rgba(67, 212, 132, 0.5)'
      buttonStyle.cursor = 'inherit'
    }
    if (isHighlighted) {
      Object.assign(buttonStyle, buttonStyle[':hover'])
    }
    return <button
      style={buttonStyle} disabled={disabled} {...otherProps}
      onMouseDown={this.handleMouseDown} ref={dom => {
        this.dom = dom
      }}>
      {isProgressShown ?
        <CircularProgress size={23} style={{color: '#fff'}} thickness={2} /> :
        children}
    </button>

  }
}
const Button = Radium(ButtonBase)


class Markdown extends React.Component {
  static propTypes = {
    content: PropTypes.string,
  }

  render() {
    const {content, ...extraProps} = this.props
    if (!content) {
      return null
    }
    return <ReactMarkdown
      source={content} escapeHtml={true}
      // eslint-disable-next-line no-unused-vars
      renderers={{Link: ({literal, nodeKey, ...props}) => <a
        {...props} target="_blank" rel="noopener noreferrer" />}}
      {...extraProps} />
  }
}


class HorizontalRule extends React.Component {
  static propTypes = {
    style: PropTypes.object,
  }

  render() {
    const style = {
      border: 'solid 1px',
      color: Colors.RED_PINK,
      width: 70,
      ...this.props.style,
    }
    return <hr style={style} />
  }
}


class CircularProgress extends React.Component {
  static propTypes = {
    periodMilliseconds: PropTypes.number,
    size: PropTypes.number,
    style: PropTypes.object,
    thickness: PropTypes.number,
  }
  static defaultProps = {
    periodMilliseconds: 1750,
    size: 80,
    thickness: 3.5,
  }

  state = {
    isWrapperRotated: false,
    scalePathStep: 0,
  }

  componentDidMount() {
    this.scalePath(0)
    this.rotateWrapper()
  }

  componentWillUnmount() {
    clearTimeout(this.scalePathTimer)
    clearTimeout(this.rotateWrapperTimer1)
    clearTimeout(this.rotateWrapperTimer2)
  }

  scalePath(step) {
    const {periodMilliseconds} = this.props
    this.setState({scalePathStep: step})
    this.scalePathTimer = setTimeout(
      () => this.scalePath((step + 1) % 3),
      step ? .4 * periodMilliseconds : .2 * periodMilliseconds)
  }

  rotateWrapper() {
    const {periodMilliseconds} = this.props
    this.setState({isWrapperRotated: false})

    this.rotateWrapperTimer1 = setTimeout(() => {
      this.setState({isWrapperRotated: true})
    }, 50)

    this.rotateWrapperTimer2 = setTimeout(
      () => this.rotateWrapper(),
      50 + periodMilliseconds * 5.7143)
  }

  render() {
    const {periodMilliseconds, size, thickness} = this.props
    const {isWrapperRotated, scalePathStep} = this.state
    const style = {
      color: Colors.SKY_BLUE,
      height: size,
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative',
      width: size,
      ...this.props.style,
    }
    const color = style.color
    const wrapperStyle = {
      display: 'inline-block',
      height: size,
      transform: `rotate(${isWrapperRotated ? '1800' : '0'}deg)`,
      transition: `all ${isWrapperRotated ? '10' : '0'}s linear`,
      width: size,
    }
    const getArcLength = fraction => fraction * Math.PI * (size - thickness)
    let strokeDasharray, strokeDashoffset, transitionDuration
    if (scalePathStep === 0) {
      strokeDasharray = `${getArcLength(0)}, ${getArcLength(1)}`
      strokeDashoffset = 0
      transitionDuration = '0'
    } else if (scalePathStep === 1) {
      strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
      strokeDashoffset = getArcLength(-0.3)
      transitionDuration = periodMilliseconds * .4
    } else {
      strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
      strokeDashoffset = getArcLength(-1)
      transitionDuration = periodMilliseconds * .4857
    }
    const pathStyle = {
      stroke: color,
      strokeDasharray,
      strokeDashoffset,
      strokeLinecap: 'round',
      transition: `all ${transitionDuration}ms ease-in-out`,
    }

    return <div style={style}>
      <div style={wrapperStyle}>
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle
            style={pathStyle}
            cx={size / 2} cy={size / 2}
            r={(size - thickness) / 2}
            strokeWidth={thickness}
            strokeMiterlimit="20" fill="none" />
        </svg>
      </div>
    </div>
  }
}


class JobGroupCoverImage extends React.Component {
  static propTypes = {
    blur: PropTypes.number,
    coverOpacity: PropTypes.number,
    grayScale: PropTypes.number,
    opaqueCoverColor: PropTypes.string,
    opaqueCoverGradient: PropTypes.shape({
      left: PropTypes.string.isRequired,
      middle: PropTypes.string,
      right: PropTypes.string.isRequired,
    }),
    romeId: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  static defaultProps = {
    coverOpacity: .4,
    opaqueCoverColor: '#000',
  }

  render() {
    const {blur, coverOpacity, grayScale, opaqueCoverColor,
      opaqueCoverGradient, romeId, style} = this.props
    const url = config.jobGroupImageUrl.replace('ROME_ID', romeId)
    const coverAll = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle = {
      ...coverAll,
      backgroundImage: url ? `url("${url}")` : 'inherit',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    const containerStyle = {
      ...coverAll,
      ...style,
    }
    const filters = []
    if (blur) {
      filters.push(`blur(${blur}px)`)
      containerStyle.overflow = 'hidden'
    }
    if (grayScale) {
      filters.push(`grayscale(${grayScale}%)`)
    }
    if (filters.length) {
      Object.assign(coverImageStyle, Styles.VENDOR_PREFIXED('filter', filters.join(' ')))
    }
    const opaqueCoverStyle = {
      ...coverAll,
      backgroundColor: opaqueCoverColor,
      opacity: coverOpacity,
      zIndex: -1,
    }
    if (opaqueCoverGradient) {
      const gradientParts = ['104deg', opaqueCoverGradient.left]
      if (opaqueCoverGradient.middle) {
        gradientParts.push(opaqueCoverGradient.middle)
      }
      gradientParts.push(opaqueCoverGradient.right)
      opaqueCoverStyle.background = `linear-gradient(${gradientParts.join(', ')})`
    }
    return <div style={containerStyle}>
      {url ? <div style={coverImageStyle} /> : null}
      <div style={opaqueCoverStyle} />
    </div>
  }
}


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
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {options, style, value} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      ...style,
    }
    const radioStyle = index => {
      const baseStyle = {
        marginTop: isMobileVersion ? 10 : 0,
      }
      if (index < options.length - 1) {
        return baseStyle
      }
      return {
        marginBottom: 0,
        ...baseStyle,
      }
    }

    return <div style={containerStyle}>
      {options.map((option, index) => {
        return <LabeledToggle
          key={option.value} label={option.name} type="radio"
          isSelected={option.value === value} style={radioStyle(index)}
          onClick={() => this.props.onChange(option.value)} />
      })}
    </div>
  }
}


class RadioButton extends React.Component {
  static propTypes = {
    isHovered: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func,
  }

  state = {
    isFocused: false,
  }

  render() {
    const {isHovered, isSelected, onClick} = this.props
    const {isFocused} = this.state
    const isHighlighted = isHovered || isFocused
    const outerCircleStyle = {
      backgroundColor: '#fff',
      borderColor: isHighlighted ? Colors.COOL_GREY : Colors.PINKISH_GREY,
      borderRadius: '50%',
      borderStyle: 'solid',
      borderWidth: 1,
      cursor: onClick ? 'pointer' : 'initial',
      height: 20,
      position: 'absolute',
      width: 20,
    }
    const innerCircleStyle = {
      backgroundColor: '#58bbfb',
      borderRadius: '50%',
      height: 10,
      left: 4,
      position: 'absolute',
      top: 4,
      width: 10,
    }
    const containerStyle = {
      display: 'inline-block',
      height: outerCircleStyle.height,
      position: 'relative',
      width: outerCircleStyle.width,
    }
    return <div
      style={containerStyle} tabIndex={0}
      onFocus={() => this.setState({isFocused: true})}
      onBlur={() => this.setState({isFocused: false})}
      onClick={onClick}
      onKeyPress={isFocused ? onClick : null}>
      <div style={outerCircleStyle}>
        {isSelected ? <div style={innerCircleStyle} /> : null}
      </div>
    </div>
  }
}


class FieldSet extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    // We keep disabled by consistency with the DOM fieldset element.
    // eslint-disable-next-line react/boolean-prop-naming
    disabled: PropTypes.bool,
    isInline: PropTypes.bool,
    isValid: PropTypes.bool,
    isValidated: PropTypes.bool,
    label: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, disabled, isInline, isValid, isValidated, label,
      style, ...otherProps} = this.props
    const isMarkedInvalid = !disabled && isValidated && !isValid
    const containerStyle = {
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      marginBottom: isInline ? 0 : 5,
      marginLeft: 0,
      marginRight: 0,
      opacity: disabled ? 0.5 : 'inherit',
      padding: 0,
      position: 'relative',
      ...style,
    }
    let labelStyle = {
      color: isInline && isMarkedInvalid ? Colors.RED_PINK : Colors.CHARCOAL_GREY,
      fontSize: 15,
      lineHeight: 1.3,
      marginBottom: isInline ? 0 : 11,
    }
    if (isInline) {
      labelStyle = {...labelStyle, ...Styles.CENTER_FONT_VERTICALLY}
    }
    const errorStyle = {
      color: Colors.RED_PINK,
      fontSize: 13,
      marginTop: 7,
      visibility: isMarkedInvalid ? 'visible' : 'hidden',
    }
    return <fieldset
      style={containerStyle} disabled={disabled}
      className={isMarkedInvalid ? 'marked-invalid' : ''}
      {...otherProps}>
      <label style={labelStyle}>{label}</label>
      {children}
      {isInline ? null : <div style={errorStyle}>Champ obligatoire</div>}
    </fieldset>
  }
}


// TODO: Set border radius to zero.
class Select extends React.Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
      disabled: PropTypes.bool,
      name: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })).isRequired,
    style: PropTypes.object,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }

  handleChange = event => {
    event.stopPropagation()
    this.props.onChange(event.target.value)
  }

  render() {
    const {options, style, value} = this.props
    const containerStyle = {
      ...Styles.INPUT,
      width: '100%',
      ...style,
    }
    return  <select onChange={this.handleChange} value={value} style={containerStyle}>
      {/* Add an empty option if no option matches the selected value. */}
      {options.some(option => option.value === value) ? null : <option />}
      {options.map(option => {
        return <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.name}
        </option>
      })}
    </select>
  }
}


// Convert an array to an object containing the array values as keys and true
// as values.
const arrayToSet = array => _.reduce(array || [], (set, val) => ({...set, [val]: true}), {})


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
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    this.setState({valuesSelected: arrayToSet(this.props.values)})
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.values === nextProps.values) {
      return
    }
    this.setState({
      valuesSelected: arrayToSet(nextProps.values),
    })
  }

  handleChange = optionValue => {
    const values = this.props.values || []
    const isSelected = this.state.valuesSelected[optionValue]
    const newValues = isSelected ?
      _.without(values, optionValue) :
      [optionValue].concat(values)
    this.props.onChange(newValues)
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {options, values, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const {valuesSelected} = this.state
    const checkboxStyle = {
      marginTop: isMobileVersion ? 10 : 0,
    }

    return <div {...extraProps}>
      {(options || []).map(option => {
        const isSelected = valuesSelected[option.value]
        return <LabeledToggle
          key={option.value} label={option.name} type="checkbox" style={checkboxStyle}
          isSelected={isSelected} onClick={() => this.handleChange(option.value)} />
      })}
    </div>
  }
}


class Checkbox extends React.Component {
  static propTypes = {
    isHovered: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func,
  }

  state = {
    isFocused: false,
  }

  render() {
    const {isHovered, isSelected, onClick} = this.props
    const {isFocused} = this.state
    const isHighlighted = isHovered || isFocused
    const size = 20
    const outerBoxStyle = {
      alignItems: 'center',
      backgroundColor: isSelected ? Colors.SKY_BLUE : '#fff',
      borderColor: isSelected ? Colors.SKY_BLUE : (
        isHighlighted ? Colors.COOL_GREY : Colors.PINKISH_GREY
      ),
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      color: '#fff',
      cursor: onClick ? 'pointer' : 'initial',
      display: 'flex',
      fontSize: 16,
      height: size,
      justifyContent: 'center',
      position: 'absolute',
      width: size,
    }
    const containerStyle = {
      display: 'inline-block',
      height: outerBoxStyle.height,
      position: 'relative',
      width: outerBoxStyle.width,
    }
    return <div
      style={containerStyle} tabIndex={0}
      onFocus={() => this.setState({isFocused: true})}
      onBlur={() => this.setState({isFocused: false})}
      onClick={onClick}
      onKeyPress={isFocused ? onClick : null}>
      <div style={outerBoxStyle}>
        {isSelected ? <Icon name="check" /> : null}
      </div>
    </div>
  }
}


const TOGGLE_INPUTS = {
  checkbox: Checkbox,
  radio: RadioButton,
}

class LabeledToggle extends React.Component {
  static propTypes = {
    isSelected: PropTypes.bool,
    label: PropTypes.node.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
    type: PropTypes.oneOf(Object.keys(TOGGLE_INPUTS)).isRequired,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {isSelected, label, onClick, style, type, ...otherProps} = this.props
    const {isHovered} = this.state
    const containerStyle = {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      listStyle: 'none',
      marginBottom: 7,
      ...style,
    }
    const ToggleInput = TOGGLE_INPUTS[type]
    return <div
      {...otherProps} style={containerStyle}
      onMouseOver={() => this.setState({isHovered: true})}
      onMouseOut={() => this.setState({isHovered: false})} >
      <ToggleInput isSelected={isSelected} isHovered={isHovered} onClick={onClick} />
      <span onClick={onClick} style={{marginLeft: 10, ...Styles.CENTER_FONT_VERTICALLY}}>
        {label}
      </span>
    </div>
  }
}


// Abstraction for Icons from https://materialdesignicons.com/
class Icon extends React.Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
  }

  focus() {
    this.dom && this.dom.focus()
  }

  render () {
    const {name, ...otherProps} = this.props
    return <i
      className={`mdi mdi-${name}`} {...otherProps}
      ref={dom => {
        this.dom = dom
      }} />
  }
}


class IconInput extends React.Component {
  static propTypes = {
    iconName: PropTypes.string.isRequired,
    iconStyle: PropTypes.object,
    inputStyle: PropTypes.object,
    shouldFocusOnMount: PropTypes.bool,
    style: PropTypes.object,
  }

  componentDidMount() {
    if (this.props.shouldFocusOnMount) {
      this.input.focus()
    }
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {shouldFocusOnMount, iconName, iconStyle, inputStyle, style,
      ...otherProps} = this.props
    const iconContainer = {
      alignItems: 'center',
      backgroundColor: 'white',
      bottom: 0,
      color: '#cbcbd5',
      cursor: 'text',
      display: 'flex',
      fontSize: 20,
      margin: 1,
      paddingLeft: 5,
      paddingRight: 5,
      position: 'absolute',
      right: 0,
      top: 0,
      ...iconStyle,
    }
    return <div style={{position: 'relative', ...style}}>
      <Input
        {...otherProps}
        ref={input => this.input = input}
        style={inputStyle} />
      <div style={iconContainer} onClick={() => this.input.focus()}>
        <Icon name={iconName} />
      </div>
    </div>
  }
}


class JobSuggestWithNote extends React.Component {
  render() {
    const noteStyle = {
      color: Colors.COOL_GREY,
      lineHeight: 1.1,
      marginTop: 8,
    }
    const linkStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 15,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      <JobSuggest {...this.props} style={{padding: 1, ...Styles.INPUT}} />
      <div style={noteStyle}>
        Vous ne trouvez pas votre métier&nbsp;? <a
          style={linkStyle} href="https://airtable.com/shreUw3GYqAwVAA27"
          target="_blank" rel="noopener noreferrer">
          Cliquez ici pour l'ajouter
        </a>.
      </div>
    </div>
  }
}


class Input extends React.Component {
  static propTypes = {
    applyFunc: PropTypes.func,
    onChange: PropTypes.func,
    style: PropTypes.object,
  }

  handleChange = event => {
    event.stopPropagation()
    const {applyFunc, onChange} = this.props
    const value = applyFunc ? applyFunc(event.target.value) : event.target.value
    onChange && onChange(value)
  }

  focus() {
    this.dom && this.dom.focus()
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {applyFunc, style, ...otherProps} = this.props
    const inputStyle = {
      ...Styles.INPUT,
      ...style,
    }
    return <input
      {...otherProps} style={inputStyle} onChange={this.handleChange}
      ref={dom => this.dom = dom} />
  }
}


class PieChart extends React.Component {
  static propTypes = {
    backgroundColor: PropTypes.string,
    children: PropTypes.node,
    durationMillisec: PropTypes.number.isRequired,
    percentage: PropTypes.number.isRequired,
    size: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number.isRequired,
    style: PropTypes.object,
  }
  static defaultProps = {
    durationMillisec: 1000,
    size: 60,
    strokeWidth: 15,
  }

  componentWillMount() {
    this.setState({hasStartedGrowing: false})
  }

  startGrowing = isVisible => {
    if (!isVisible) {
      return
    }
    this.setState({
      hasStartedGrowing: true,
    })
  }

  render() {
    const {backgroundColor, children, durationMillisec, percentage, size,
      strokeWidth, style} = this.props
    const {hasStartedGrowing} = this.state
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 28,
      fontWeight: 'bold',
      height: 2 * size,
      justifyContent: 'center',
      position: 'relative',
      width: 2 * size,
      ...Styles.CENTER_FONT_VERTICALLY,
      ...style,
    }
    const currentPercentage = hasStartedGrowing ? percentage : 0
    const radius = size - strokeWidth / 2
    const perimeter = radius * 2 * Math.PI
    const strokeLength = perimeter * currentPercentage / 100
    return <span style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250}
        onChange={this.startGrowing} />
      <svg style={{left: 0, position: 'absolute', top: 0}} viewBox={`0 0 ${2 * size} ${2 * size}`}>
        <circle
          cx={size} cy={size} r={radius} fill="none"
          stroke={backgroundColor} strokeWidth={strokeWidth} />
        <circle
          cx={size} cy={size} r={radius} fill="none"
          stroke={style.color} strokeDashoffset={perimeter / 4}
          strokeDasharray={`${strokeLength},${perimeter -strokeLength}`}
          strokeWidth={strokeWidth} style={{transition: `${durationMillisec}ms`}} />
      </svg>
      {children}
    </span>
  }
}


class GrowingNumber extends React.Component {
  static propTypes = {
    durationMillisec: PropTypes.number.isRequired,
    isSteady: PropTypes.bool,
    number: PropTypes.number.isRequired,
    style: PropTypes.object,
  }
  static defaultProps = {
    durationMillisec: 1000,
  }

  componentWillMount() {
    this.setState({growingForMillisec: 0, hasGrown: false, hasStartedGrowing: false})
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  startGrowing = isVisible => {
    if (!isVisible) {
      return
    }
    this.grow(0)
  }

  grow(growingForMillisec) {
    clearTimeout(this.timeout)
    if (growingForMillisec >= this.props.durationMillisec) {
      this.setState({hasGrown: true})
      return
    }
    this.setState({
      growingForMillisec,
      hasStartedGrowing: true,
    })
    this.timeout = setTimeout(() => this.grow(growingForMillisec + 50), 50)
  }

  render() {
    const {durationMillisec, isSteady, number, style} = this.props
    const {growingForMillisec, hasGrown, hasStartedGrowing} = this.state
    const maxNumDigits = Math.floor(Math.log10(number)) + 1
    const containerStyle = isSteady ? {
      display: 'inline-block',
      textAlign: 'right',
      // 0.625 was found empirically.
      width: `${maxNumDigits * 0.625}em`,
      ...style,
    } : style
    return <span style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250}
        onChange={this.startGrowing} />
      {hasGrown ? number :
        Math.round(growingForMillisec / durationMillisec * number)}
    </span>
  }
}


// This component avoids that the element touches the border when on mobile.
// For now, we only use is for text, hence a solution that does not require a component would be,
// better, but we didn't find one yet.
class PaddedOnMobile extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {children, style} = this.props
    const containerStyle = {
      ...style,
      padding: this.context.isMobileVersion ? '0 20px' : 0,
    }
    return <div style={containerStyle}>{children}</div>
  }
}


class AppearingList extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    maxNumChildren: PropTypes.number,
  }

  state = {
    isShown: false,
  }

  render() {
    const {children, maxNumChildren, ...extraProps} = this.props
    const {isShown} = this.state
    const itemStyle = (index, style) => ({
      opacity: isShown ? 1 : 0,
      transition: `opacity 300ms ease-in ${index * 700 / children.length}ms`,
      ...style,
    })
    const shownChildren = maxNumChildren ? children.slice(0, maxNumChildren) : children
    return <div {...extraProps}>
      <VisibilitySensor
        active={!isShown} intervalDelay={250}
        onChange={isShown => this.setState({isShown})} />
      {shownChildren.map((item, index) =>
        React.cloneElement(item, {
          key: item.key || index,
          style: itemStyle(index, item.props.style),
        }))}
    </div>
  }
}


class Tag extends React.Component {
  static propTypes = {
    children: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {children, style} = this.props
    const containerStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      borderRadius: 2,
      color: '#fff',
      display: 'inline-block',
      flexShrink: 0,
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: .3,
      padding: 6,
      textTransform: 'uppercase',
      ...style,
    }
    return <span style={containerStyle}>
      <div style={Styles.CENTER_FONT_VERTICALLY}>
        {children}
      </div>
    </span>
  }
}


class StringJoiner extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    lastSeparator: PropTypes.node.isRequired,
    separator: PropTypes.node.isRequired,
  }
  static defaultProps = {
    lastSeparator: ' ou ',
    separator: ', ',
  }

  render() {
    const {children, lastSeparator, separator} = this.props
    if (Object.prototype.toString.call(children) !== '[object Array]') {
      return children
    }
    if (children.length === 1) {
      return children[0]
    }
    const parts = []
    children.forEach((child, index) => {
      if (index) {
        const nextSeparator = (index === children.length - 1) ? lastSeparator : separator
        parts.push(<span key={`sep-${index}`}>{nextSeparator}</span>)
      }
      parts.push(child)
    })
    return <span>{parts}</span>
  }
}


export {
  Markdown, HorizontalRule, FieldSet, LabeledToggle, Tag,
  Select, CheckboxList, Icon, Button, IconInput, RadioGroup,
  JobSuggestWithNote, Input, JobGroupCoverImage, PieChart,
  GrowingNumber, PaddedOnMobile, AppearingList, CircularProgress,
  StringJoiner, Checkbox,
}
