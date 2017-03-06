import React from 'react'
import ReactMarkdown from 'react-markdown'
import Radium from 'radium'
require('styles/fonts/GTWalsheim/font.css')
require('mdi/css/materialdesignicons.min.css')
import _ from 'underscore'

import config from 'config'

import {JobSuggest} from 'components/suggestions'
import {CircularProgress} from 'components/progress'

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
  MODAL_PROJECT_GREY: '#e8eaf0',
  PINKISH_GREY: '#cbcbd5',
  RED_PINK: '#ee4266',
  RED_PINK_HOVER: '#dc3457',
  SILVER: '#d9d9e0',
  SKY_BLUE: '#58bbfb',
  SKY_BLUE_HOVER: '#40a2e1',
  SLATE: '#4e5972',
  SOFT_BLUE: '#78b6e8',
  SQUASH: '#f5a623',
  SUN_YELLOW: '#ffd930',
  WARM_GREY: '#858585',
  WHITE_HALO: '#dcdcdc',
}
// TODO(guillaume): Add WHITE color everywhere in the app.

export const SmoothTransitions = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}


export const Styles = {
  CENTERED_COLUMN: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  // Style to compensate our font (GTWalsheim), that have a lot of space below
  // the baseline, when centering vertically.
  CENTER_FONT_VERTICALLY: {
    paddingTop: '.25em',
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

class RoundButtonBase extends React.Component {
  static propTypes = {
    bounceDurationMs: React.PropTypes.number,
    children: React.PropTypes.node.isRequired,
    disabled: React.PropTypes.bool,
    isHighlighted: React.PropTypes.bool,
    isNarrow: React.PropTypes.bool,
    isProgressShown: React.PropTypes.bool,
    onClick: React.PropTypes.func,
    onMouseDown: React.PropTypes.func,
    style: React.PropTypes.object,
    type: React.PropTypes.oneOf(Object.keys(BUTTON_TYPE_STYLES)),
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
      fontSize: 14,
      fontWeight: 500,
      padding: isNarrow ? '8px 21px 6px' : '10px 39px 8px',
      textAlign: 'center',
      transition: SmoothTransitions.transition + `, transform ${bounceDurationMs}ms`,
      ...style,
    }
    if (isBouncing) {
      buttonStyle.transform = 'scale(.9)'
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
        onMouseDown={this.handleMouseDown}>
      {isProgressShown ?
        <CircularProgress size={23} style={{color: '#fff'}} thickness={2} /> :
        children}
    </button>

  }
}
const RoundButton = Radium(RoundButtonBase)


class SettingsButtonBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const {children, style, ...otherProps} = this.props
    const buttonStyle = {
      ':focused': {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
      },
      ':hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
      },
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      border: 'none',
      borderRadius: 2,
      boxShadow: '0 2px 7px 0 rgba(0, 0, 0, 0.5)',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 'normal',
      height: 35,
      padding: '4px 14px 2px',
      ...SmoothTransitions,
      ...style,
    }

    return <button {...otherProps} style={buttonStyle}>
      <Icon name="settings" /> {children}
    </button>
  }
}
const SettingsButton = Radium(SettingsButtonBase)


class ExternalSiteButtonBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    style: React.PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const linkStyle = {
      ':hover': {backgroundColor: Colors.SKY_BLUE_HOVER, color: '#fff'},
      border: 'solid 2px',
      borderRadius: 100,
      color: Colors.SKY_BLUE,
      display: 'inline-block',
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: .3,
      margin: 9,
      padding: '11px 18px 8px',
      textDecoration: 'none',
      ...style,
    }
    return <a target="_blank" {...extraProps} style={linkStyle}>
      {children} <Icon name="open-in-new" />
    </a>
  }
}
const ExternalSiteButton = Radium(ExternalSiteButtonBase)


class Markdown extends React.Component {
  static propTypes = {
    content: React.PropTypes.string,
  }

  render() {
    const {content, ...extraProps} = this.props
    if (!content) {
      return null
    }
    return <ReactMarkdown source={content} escapeHtml={true}
              // eslint-disable-next-line no-unused-vars
              renderers={{Link: ({literal, nodeKey, ...props}) => <a {...props} target="_blank" />}}
              {...extraProps} />
  }
}


class HorizontalRule extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
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


const COVER_IMAGE_URLS = {
  generic1: require('images/generic-cover1.jpg'),
  generic2: require('images/generic-cover2.jpg'),
  generic3: require('images/generic-cover3.jpg'),
  generic4: require('images/generic-cover4.jpg'),
  generic5: require('images/generic-cover5.jpg'),
}


class PartnerLogos extends React.Component {
  render() {
    return <div {...this.props}>
      <img src={require('images/logo-lfse.svg')} style={{height: 50}} />
    </div>
  }
}


class CoverImage extends React.Component {
  static propTypes = {
    blur: React.PropTypes.number,
    coverOpacity: React.PropTypes.number,
    opaqueCoverColor: React.PropTypes.string,
    opaqueCoverGradient: React.PropTypes.shape({
      left: React.PropTypes.string.isRequired,
      middle: React.PropTypes.string,
      right: React.PropTypes.string.isRequired,
    }),
    style: React.PropTypes.object,
    url: React.PropTypes.string,
  }

  static defaultProps = {
    coverOpacity: .4,
    opaqueCoverColor: '#000',
  }

  render() {
    const {blur, coverOpacity, opaqueCoverColor, opaqueCoverGradient, style, url} = this.props
    const coverImageUrl = COVER_IMAGE_URLS[url] || url
    const coverAll = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle = {
      ...coverAll,
      backgroundImage: coverImageUrl ? `url("${coverImageUrl}")` : 'inherit',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    if (blur) {
      Object.assign(coverImageStyle, Styles.VENDOR_PREFIXED('filter', `blur(${blur}px)`))
      coverImageStyle.overflow = 'hidden'
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
    return <div style={{...coverAll, ...style}}>
      {coverImageUrl ? <div style={coverImageStyle} /> : null}
      <div style={opaqueCoverStyle} />
    </div>
  }
}


class JobGroupCoverImage extends React.Component {
  static propTypes = {
    romeId: React.PropTypes.string.isRequired,
  }

  render() {
    const {romeId, ...extraProps} = this.props
    return <CoverImage {...extraProps} url={config.jobGroupImageUrl.replace('ROME_ID', romeId)} />
  }
}


class RadioGroup extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    options: React.PropTypes.arrayOf(React.PropTypes.shape({
      name: React.PropTypes.string.isRequired,
      value: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]).isRequired,
    })).isRequired,
    style: React.PropTypes.object,
    value: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
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


class RadioButton extends React.Component {
  static propTypes = {
    isHovered: React.PropTypes.bool,
    isSelected: React.PropTypes.bool,
    onClick: React.PropTypes.func,
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
        onKeyPress={isFocused ? onClick : null}>
      <div style={outerCircleStyle}>
        {isSelected ? <div style={innerCircleStyle} /> : null}
      </div>
    </div>
  }
}


class FieldSet extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    disabled: React.PropTypes.bool,
    isInline: React.PropTypes.bool,
    isValid: React.PropTypes.bool,
    isValidated: React.PropTypes.bool,
    label: React.PropTypes.node,
    style: React.PropTypes.object,
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
      {isInline ? null : <div style={errorStyle}>Champs obligatoire</div>}
    </fieldset>
  }
}


// TODO: Set border radius to zero.
class Select extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    options: React.PropTypes.arrayOf(React.PropTypes.shape({
      disabled: React.PropTypes.bool,
      name: React.PropTypes.string.isRequired,
      value: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]).isRequired,
    })).isRequired,
    style: React.PropTypes.object,
    value: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
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
      {value ? null : <option></option>}
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
    onChange: React.PropTypes.func.isRequired,
    // The sorted list of selectable options.
    options: React.PropTypes.arrayOf(React.PropTypes.shape({
      name: React.PropTypes.string,
      value: React.PropTypes.string,
    })),
    style: React.PropTypes.object,
    values: React.PropTypes.arrayOf(React.PropTypes.string),
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
    const {valuesSelected} = this.state
    return <div {...extraProps}>
      {(options || []).map(option => {
        const isSelected = valuesSelected[option.value]
        return <LabeledToggle
            key={option.value} label={option.name} type="checkbox"
            isSelected={isSelected} onClick={() => this.handleChange(option.value)} />
      })}
    </div>
  }
}


class Checkbox extends React.Component {
  static propTypes = {
    isHovered: React.PropTypes.bool,
    isSelected: React.PropTypes.bool,
    onClick: React.PropTypes.func,
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
    isSelected: React.PropTypes.bool,
    label: React.PropTypes.node.isRequired,
    onClick: React.PropTypes.func,
    style: React.PropTypes.object,
    type: React.PropTypes.oneOf(Object.keys(TOGGLE_INPUTS)).isRequired,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {isSelected, label, onClick, style, type, ...otherProps} = this.props
    const {isHovered} = this.state
    const containerStyle = {
      alignItems: 'center',
      color: isSelected ? Colors.SKY_BLUE : 'inherit',
      cursor: 'pointer',
      display: 'flex',
      listStyle: 'none',
      marginBottom: 7,
      ...style,
    }
    const ToggleInput = TOGGLE_INPUTS[type]
    return <div
        {...otherProps} onClick={onClick} style={containerStyle}
        onMouseOver={() => this.setState({isHovered: true})}
        onMouseOut={() => this.setState({isHovered: false})} >
      <ToggleInput isSelected={isSelected} isHovered={isHovered} onClick={onClick} />
      <span style={{marginLeft: 10, ...Styles.CENTER_FONT_VERTICALLY}}>{label}</span>
    </div>
  }
}


// Abstraction for Icons from https://materialdesignicons.com/
class Icon extends React.Component {
  static propTypes = {
    name: React.PropTypes.string.isRequired,
  }

  focus() {
    this.refs.i.focus()
  }

  render () {
    const {name, ...otherProps} = this.props
    return <i className={`mdi mdi-${name}`} {...otherProps} ref="i" />
  }
}


class IconInput extends React.Component {
  static propTypes = {
    autofocus: React.PropTypes.bool,
    iconName: React.PropTypes.string.isRequired,
    inputStyle: React.PropTypes.object,
    style: React.PropTypes.object,
  }

  componentDidMount() {
    if (this.props.autofocus) {
      this.input.focus()
    }
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {autofocus, iconName, inputStyle, style, ...otherProps} = this.props
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
            style={linkStyle} href="https://airtable.com/shreUw3GYqAwVAA27" target="_blank">
          Cliquez ici pour l'ajouter
        </a>.
      </div>
    </div>
  }
}


class Input extends React.Component {
  static propTypes = {
    applyFunc: React.PropTypes.func,
    onChange: React.PropTypes.func,
    style: React.PropTypes.object,
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


export {
  Markdown, PartnerLogos, HorizontalRule, CoverImage, FieldSet, LabeledToggle,
  Select, CheckboxList, Icon, RoundButton, IconInput, RadioGroup, ExternalSiteButton,
  SettingsButton, JobSuggestWithNote, Input, JobGroupCoverImage,
}
