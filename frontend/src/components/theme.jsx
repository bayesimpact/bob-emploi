import omit from 'lodash/omit'
import without from 'lodash/without'
import ArrowDownIcon from 'mdi-react/ArrowDownIcon'
import ArrowUpIcon from 'mdi-react/ArrowUpIcon'
import CheckIcon from 'mdi-react/CheckIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronUpIcon from 'mdi-react/ChevronUpIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuDownIcon from 'mdi-react/MenuDownIcon'
import MenuUpIcon from 'mdi-react/MenuUpIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import ReactSelect from 'react-select'
import VisibilitySensor from 'react-visibility-sensor'

import config from 'config'

import 'react-select/dist/react-select.css'
import 'styles/fonts/GTWalsheim/font.css'
import 'styles/fonts/Lato/font.css'

// Keep this at top of this file, for color linter.
export const Colors = {
  BACKGROUND_GREY: '#f3f4f7',
  BOB_BLUE: '#1888ff',
  BOB_BLUE_HOVER: '#287cda',
  BUTTERSCOTCH: '#ffbc4c',
  CHARCOAL_GREY: '#383f52',
  COOL_GREY: '#9596a0',
  DARK: '#21293d',
  DARK_BLUE: '#09223f',
  DARK_TWO: '#2c3449',
  DODGER_BLUE: '#4fa2fe',
  GREENISH_TEAL: '#43d484',
  GREYISH_BROWN: '#575757',
  HOVER_GREEN: '#31bd59',
  LIGHT_BLUE: '#badbff',
  LIGHT_GREY: '#f9fafd',
  MODAL_PROJECT_GREY: '#e8eaf0',
  NEW_GREY: '#f0f0f0',
  PINKISH_GREY: '#cbcbd5',
  RED_PINK: '#ee4266',
  RED_PINK_HOVER: '#dc3457',
  ROBINS_EGG: '#58f5fb',
  SEA_BLUE: '#45e1ff',
  SILVER: '#d9d9e0',
  SLATE: '#4e5972',
  SQUASH: '#f5a623',
  SUN_YELLOW: '#ffd930',
  SUN_YELLOW_80: '#f8e71c',
  VERY_LIGHT_BLUE: '#d8ebff',
  WARM_GREY: '#858585',
}

// Extract color components.
export const colorToComponents = color => ([
  parseInt(color.substring(1, 3), 16),
  parseInt(color.substring(3, 5), 16),
  parseInt(color.substring(5, 7), 16),
])

// Change #rrbbgg color to rgba(r, b, g, alpha)
export const colorToAlpha = (color, alpha) => {
  const [red, green, blue] = colorToComponents(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha || 1})`
}

export const SmoothTransitions = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}

// Maximum width of content on super wide screen.
export const MAX_CONTENT_WIDTH = 1000

// Minimum padding between screen borders and content on medium screens.
export const MIN_CONTENT_PADDING = 20

export const Styles = {
  // Style for the sticker on top of a box that tells the users why we show them this box.
  BOX_EXPLANATION: {
    backgroundColor: Colors.BOB_BLUE,
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
    borderRadius: 0,
    color: Colors.CHARCOAL_GREY,
    fontFamily: 'GTWalsheim',
    fontSize: 15,
    fontWeight: 'normal',
    height: 41,
    paddingLeft: 15,
    paddingTop: 5,
    width: '100%',
    ...SmoothTransitions,
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
    disabledColor: colorToAlpha(Colors.RED_PINK, .5),
    hoverColor: Colors.RED_PINK_HOVER,
  },
  discreet: {
    backgroundColor: 'transparent',
    color: Colors.COOL_GREY,
    hoverColor: Colors.SILVER,
  },
  navigation: {
    backgroundColor: Colors.BOB_BLUE,
    disabledColor: colorToAlpha(Colors.BOB_BLUE, .5),
    hoverColor: Colors.BOB_BLUE_HOVER,
  },
  navigationOnImage: {
    backgroundColor: 'rgba(255, 255, 255, .3)',
    hoverColor: 'rgba(255, 255, 255, .5)',
  },
  validation: {
    backgroundColor: Colors.GREENISH_TEAL,
    disabledColor: colorToAlpha(Colors.GREENISH_TEAL, .5),
    hoverColor: Colors.HOVER_GREEN,
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
    // TODO(pascal): Fix all remaining occurences, then get rid of this.
    isOldStyle: PropTypes.bool,
    isProgressShown: PropTypes.bool,
    isRound: PropTypes.bool,
    onClick: PropTypes.func,
    onMouseDown: PropTypes.func,
    style: PropTypes.object,
    type: PropTypes.oneOf(Object.keys(BUTTON_TYPE_STYLES)),
  }

  static defaultProps = {
    bounceDurationMs: 50,
  }

  state = {
    isClicking: false,
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  blur() {
    this.dom && this.dom.blur()
  }

  handleClick = event => {
    const {bounceDurationMs, onClick} = this.props
    if (event && event.stopPropagation) {
      event.stopPropagation()
    }
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    this.setState({isClicking: true})
    this.timeout = setTimeout(() => {
      this.setState({isClicking: false})
      onClick && onClick(event)
    }, bounceDurationMs)
  }

  render() {
    const {bounceDurationMs, children, disabled, isNarrow, isProgressShown, type, style,
      isHighlighted, isOldStyle, isRound, ...otherProps} = this.props
    const {isClicking} = this.state
    const typeStyle = BUTTON_TYPE_STYLES[type] || BUTTON_TYPE_STYLES.navigation

    const buttonStyle = {
      backgroundColor: typeStyle.backgroundColor,
      border: 'none',
      borderRadius: isOldStyle ? 100 : isRound ? 30 : 5,
      boxShadow: isOldStyle ? 'initial' :
        '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
      color: typeStyle.color || '#fff',
      cursor: 'pointer',
      flexShrink: 0,
      fontFamily: isOldStyle ? 'GTWalsheim' : 'Lato, Helvetica',
      fontSize: isOldStyle ? 14 : isRound ? 15 : 16,
      fontStyle: 'normal',
      fontWeight: isOldStyle ? 500 : 'normal',
      padding: isOldStyle ?
        isNarrow ? '8px 21px 6px' : '10px 39px 8px' :
        isNarrow ? '10px 14px 8px' : isRound ? '12px 35px 13px' : '12px 20px 13px',
      textAlign: 'center',
      transform: isOldStyle ? 'initial' : 'translateY(0)',
      transition: isOldStyle ?
        SmoothTransitions.transition + `, transform ${bounceDurationMs}ms` :
        `ease ${bounceDurationMs}ms`,
      ...style,
    }
    if (!disabled) {
      buttonStyle[':hover'] = {
        backgroundColor: isOldStyle ? typeStyle.hoverColor : buttonStyle.backgroundColor,
        boxShadow: isOldStyle ? 'initial' :
          '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
        transform: isOldStyle ? 'initial' : 'translateY(-1px)',
        ...(style ? style[':hover'] : {}),
      }
      buttonStyle[':focus'] = buttonStyle[':hover']
      buttonStyle[':active'] = {
        boxShadow: isOldStyle ? 'initial' :
          '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
        transform: isOldStyle ? 'scale(.97)' : 'translateY(1px)',
        ...(style ? style[':active'] : {}),
      }
    } else {
      buttonStyle[':hover'] = {}
      buttonStyle.backgroundColor = typeStyle.disabledColor ||
        (typeStyle.backgroundColor && colorToAlpha(typeStyle.backgroundColor, .5)) ||
        'rgba(67, 212, 132, 0.5)'
      buttonStyle.cursor = 'inherit'
    }
    if (isHighlighted) {
      Object.assign(buttonStyle, buttonStyle[':hover'])
    }
    if (isClicking) {
      Object.assign(buttonStyle, buttonStyle[':active'])
    }
    return <button
      style={buttonStyle} disabled={disabled} {...otherProps}
      onClick={this.handleClick} ref={dom => {
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
      renderers={{link: props => <a
        {...omit(props, ['nodeKey', 'value'])} target="_blank" rel="noopener noreferrer" />}}
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
      color: Colors.BOB_BLUE,
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

// Function to use smaller version of image on mobile in css.
// Uses responsive-loader format, so image must be imported as
// 'myImage.jpg?multi&sizes[]=<fullSize>&sizes[]=<mobileSize>'
function chooseImageVersion(responsiveImage, isMobileVersion) {
  return !isMobileVersion ? responsiveImage.src :
    responsiveImage.images[1] ?
      responsiveImage.images[1].path :
      responsiveImage.src
}


const IMAGE_SIZE_SHAPE = PropTypes.PropTypes.shape({
  mediaCondition: PropTypes.string,
  width: PropTypes.string.isRequired,
})


// A component using output from dynamic loader for multi-sized images.
// You must still implement the sizes, although a default is set to first image width.
// You can get most of the props directly from responsive-loader:
// `import myImageAllSizes from 'myImage.jpg/png?multi&sizes[]=<defaultSize>&sizes[]=<otherSize>'`
class MultiSizeImage extends React.Component {
  static propTypes = {
    alt: PropTypes.string.isRequired,
    sizes: PropTypes.arrayOf(IMAGE_SIZE_SHAPE.isRequired),
    srcs: PropTypes.shape({
      src: PropTypes.string.isRequired,
      srcSet: PropTypes.string,
      width: PropTypes.number,
    }).isRequired,
  }


  sizeRow(size) {
    const {mediaCondition, width} = size
    return mediaCondition ? `${mediaCondition} ${width}` : width
  }

  makeSizesProp(sizes, width) {
    if (!sizes || !sizes.length) {
      return width || ''
    }
    return sizes.map(this.sizeRow).join(', ')
  }

  render() {
    const {alt, srcs, sizes, ...props} = this.props
    const sizesProp = this.makeSizesProp(sizes, srcs.width)
    return <img alt={alt} src={srcs.src} srcSet={srcs.srcSet} sizes={sizesProp} {...props} />
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

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  static defaultProps = {
    coverOpacity: .4,
    opaqueCoverColor: '#000',
  }

  render() {
    const {blur, coverOpacity, grayScale, opaqueCoverColor,
      opaqueCoverGradient, romeId, style} = this.props
    const {isMobileVersion} = this.context
    const url = (isMobileVersion ? config.jobGroupImageSmallUrl : config.jobGroupImageUrl).
      replace('ROME_ID', romeId)
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
      backgroundColor: Colors.BOB_BLUE,
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
    hasCheck: PropTypes.bool,
    hasNote: PropTypes.bool,
    isInline: PropTypes.bool,
    isUserCountTipShown: PropTypes.bool,
    isValid: PropTypes.bool,
    isValidated: PropTypes.bool,
    label: PropTypes.node,
    style: PropTypes.object,
    tip: PropTypes.node,
  }

  render() {
    const {children, disabled, hasCheck, hasNote, isInline, isUserCountTipShown, isValid,
      isValidated, label, style, tip, ...otherProps} = this.props
    const isMarkedInvalid = !disabled && isValidated && !isValid
    const containerStyle = {
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      marginBottom: hasNote || isInline ? 0 : 25,
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

    let labelStyle = {
      color: isInline && isMarkedInvalid ? Colors.RED_PINK : Colors.CHARCOAL_GREY,
      fontSize: 15,
      lineHeight: 1.3,
      marginBottom: isInline ? 0 : 11,
    }
    if (isInline) {
      labelStyle = {...labelStyle, ...Styles.CENTER_FONT_VERTICALLY}
    }

    return <fieldset
      style={containerStyle} disabled={disabled}
      className={isMarkedInvalid ? 'marked-invalid' : ''}
      {...otherProps}>
      <label style={labelStyle}>{label}</label>
      <div style={fieldStyle}>
        {tip && isUserCountTipShown ? <ToolTip content={tip} isValid={isValid} /> : null}
        <div>
          {children}
        </div>
        {(hasCheck && isValid) || isMarkedInvalid ?
          <FieldCheck isValid={isValid} isMarkedInvalid={isMarkedInvalid} /> : null}
      </div>
    </fieldset>
  }
}


class ToolTip extends React.Component {
  static propTypes = {
    content: PropTypes.node,
    isValid: PropTypes.bool,
    style: PropTypes.object,
  }

  state = {
    isVisible: true,
  }

  render() {
    const {content, isValid, style} = this.props
    const {isVisible} = this.state
    const tipStyle = {
      backgroundColor: Colors.DARK,
      borderRadius: 4,
      color: '#fff',
      display: (isValid && isVisible) ? 'inherit' : 'none',
      left: -10,
      padding: 8,
      position: 'absolute',
      right: -10,
      top: -10,
      transform: 'translateY(-100%)',
      ...style,
    }

    const arrowStyle = {
      borderBottom: '10px solid transparent',
      borderLeft: '10px solid transparent',
      borderRight: '10px solid transparent',
      borderTop: `10px solid ${Colors.DARK}`,
      bottom: 0,
      height: 20,
      left: 20,
      position: 'absolute',
      transform: 'translate(100%, 100%)',
    }

    return <div style={tipStyle} onClick={() => this.setState({isVisible: false})}>
      {content}
      <div style={arrowStyle}></div>
    </div>
  }
}


class Select extends React.Component {
  static propTypes = {
    // Number of options to scroll the menu when first opened.
    defaultMenuScroll: PropTypes.number,
    isValueInt: PropTypes.bool,
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

  handleChange = option => {
    if (!option) {
      return
    }
    const {isValueInt, onChange} = this.props
    const {value} = option
    onChange(isValueInt ? parseInt(value) : value)
  }

  handleMenuOpen = () => {
    const {defaultMenuScroll, value} = this.props
    if (!defaultMenuScroll || value || !this.subComponent || !this.subComponent.menu) {
      return
    }
    const {children} = this.subComponent.menu
    if (children && children.length > defaultMenuScroll) {
      this.subComponent.menu.scrollTop = children[defaultMenuScroll].offsetTop
    }
  }

  render() {
    const {options, placeholder, style, value, ...otherProps} = this.props
    const asString = value => value ? '' + value : ''
    const selectStyle = {
      borderRadius: 0,
      color: (value ? Colors.CHARCOAL_GREY : Colors.COOL_GREY) + ' !important',
      height: 41,
      lineHeight: 1,
      width: '100%',
      ...style,
    }
    const menuContainerStyle = {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    }
    const allOptions = []
    allOptions.push.apply(allOptions, options.map(option => ({
      disabled: !!option.disabled,
      label: option.name,
      value: asString(option.value),
    })))

    return <ReactSelect
      onChange={this.handleChange}
      value={asString(value)}
      style={selectStyle}
      options={allOptions}
      clearable={false}
      placeholder={placeholder}
      menuContainerStyle={menuContainerStyle}
      onOpen={this.handleMenuOpen}
      ref={subComponent => {
        this.subComponent = subComponent
      }}
      {...omit(otherProps, ['isValueInt', 'onChange'])} />
  }
}


class FieldCheck extends React.Component {
  static propTypes = {
    isMarkedInvalid: PropTypes.bool,
    isValid: PropTypes.bool,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMarkedInvalid, isValid, style} = this.props
    const {isMobileVersion} = this.context
    const checkboxStyle = {
      alignItems: 'center',
      backgroundColor: isMarkedInvalid ? Colors.RED_PINK : Colors.GREENISH_TEAL,
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

  state = {
    valuesSelected: new Set(this.props.values),
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.values === nextProps.values) {
      return
    }
    this.setState({
      valuesSelected: new Set(nextProps.values),
    })
  }

  handleChange = optionValue => {
    const values = this.props.values || []
    const isSelected = this.state.valuesSelected.has(optionValue)
    const newValues = isSelected ?
      without(values, optionValue) :
      [optionValue].concat(values)
    this.props.onChange(newValues)
  }

  render() {
    const {options, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const {valuesSelected} = this.state
    const checkboxStyle = {
      marginTop: isMobileVersion ? 10 : 0,
    }

    return <div {...omit(extraProps, ['values'])}>
      {(options || []).map(option => {
        const isSelected = valuesSelected.has(option.value)
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
      backgroundColor: isSelected ? Colors.BOB_BLUE : '#fff',
      borderColor: isSelected ? Colors.BOB_BLUE : (
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
        {isSelected ? <CheckIcon style={{fill: '#fff', width: 16}} /> : null}
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


class UpDownIcon extends React.Component {
  static propTypes = {
    icon: PropTypes.oneOf(['arrow', 'chevron', 'menu']).isRequired,
    isUp: PropTypes.bool,
  }

  chooseIcon(icon, isUp) {
    if (icon === 'arrow') {
      return isUp ? ArrowUpIcon : ArrowDownIcon
    }
    if (icon === 'chevron') {
      return isUp ? ChevronUpIcon : ChevronDownIcon
    }
    return isUp ? MenuUpIcon : MenuDownIcon
  }

  render() {
    const {icon, isUp, ...otherProps} = this.props
    const Icon = this.chooseIcon(icon, isUp)
    return <Icon {...otherProps} />
  }
}


class IconInput extends React.Component {
  static propTypes = {
    iconComponent: PropTypes.func.isRequired,
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
    const {iconComponent, iconStyle, inputStyle, style, ...otherProps} = this.props
    const iconContainer = {
      alignItems: 'center',
      backgroundColor: 'white',
      bottom: 0,
      color: Colors.PINKISH_GREY,
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
    const Icon = iconComponent
    return <div style={{position: 'relative', ...style}}>
      <Input
        {...omit(otherProps, ['shouldFocusOnMount'])}
        ref={input => this.input = input}
        style={inputStyle} />
      <div style={iconContainer} onClick={() => this.input.focus()}>
        <Icon style={iconStyle} />
      </div>
    </div>
  }
}


class WithNote extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    link: PropTypes.string,
    note: PropTypes.string,
  }

  render() {
    const {children, link, note} = this.props
    const noteStyle = {
      color: Colors.COOL_GREY,
      fontSize: 15,
      lineHeight: 1.1,
      marginBottom: 20,
      marginTop: 8,
    }
    const linkStyle = {
      color: Colors.BOB_BLUE,
      fontSize: 15,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {children}
      <div style={noteStyle}>
        {note + ' '}
        {link ? <a style={linkStyle} href={link}
          target="_blank" rel="noopener noreferrer">
          Cliquez ici pour l'ajouter
        </a> : null}
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

  select() {
    this.dom && this.dom.select()
  }

  render() {
    const {style, ...otherProps} = this.props
    const inputStyle = {
      ...Styles.INPUT,
      ...style,
    }
    return <input
      {...omit(otherProps, ['applyFunc'])} style={inputStyle} onChange={this.handleChange}
      ref={dom => this.dom = dom} />
  }
}


// TODO(cyrille): Use this in transparency page.
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

  state = {
    hasStartedGrowing: false,
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
          strokeDasharray={`${strokeLength},${perimeter - strokeLength}`}
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

  state = {
    growingForMillisec: 0,
    hasGrown: false,
    hasStartedGrowing: false,
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
    const maxNumDigits = number ? Math.floor(Math.log10(number)) + 1 : 1
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


// A component to handle when mouse is clicked outside its children.
// All clicks on children won't be handled. All clicks outside will trigger onOutsideClick. You can
// also add other props such as style.
class OutsideClickHandler extends React.Component {
  static propTypes = {
    children: PropTypes.element.isRequired,
    onOutsideClick: PropTypes.func.isRequired,
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  handleClickOutside = event => {
    if (this.wrapperRef && !this.wrapperRef.contains(event.target)) {
      this.props.onOutsideClick()
    }
  }

  render() {
    const {children, ...otherProps} = this.props
    const extraProps = omit(otherProps, ['onOutsideClick'])
    return <div ref={ref => this.wrapperRef = ref} {...extraProps}>
      {children}
    </div>
  }
}


class PercentBar extends React.Component {
  static propTypes = {
    color: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
    percent: PropTypes.number,
    showPercent: PropTypes.bool.isRequired,
    style: PropTypes.object,
  }

  static defaultProps = {
    height: 25,
    percent: 0,
    showPercent: true,
  }

  render() {
    const {color, height, percent, showPercent, style} = this.props
    const containerStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 25,
      height: height,
      marginBottom: 10,
      maxWidth: 425,
      overflow: 'hidden',
      width: '100%',
      ...style,
    }
    // TODO(cyrille): Use Styles.CENTER_FONT_VERTICALLY here.
    const percentStyle = {
      backgroundColor: color,
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
      height: '100%',
      lineHeight: height - 10 + 'px',
      paddingBottom: 3,
      paddingLeft: showPercent ? 18 : 0,
      paddingTop: 7,
      width: `${percent}%`,
    }
    return <div style={containerStyle}>
      {percent ? <div style={percentStyle}>
        {showPercent ? `${Math.round(percent)}%` : ''}
      </div> : null}
    </div>
  }
}


export {
  Markdown, HorizontalRule, FieldSet, LabeledToggle, Tag, Select, PercentBar,
  CheckboxList, Button, IconInput, RadioGroup, WithNote, Input,
  JobGroupCoverImage, PieChart, OutsideClickHandler, GrowingNumber, PaddedOnMobile, AppearingList,
  CircularProgress, StringJoiner, Checkbox, UpDownIcon, chooseImageVersion, MultiSizeImage,
}
