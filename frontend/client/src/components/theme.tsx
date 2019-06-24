import _memoize from 'lodash/memoize'
import {MdiReactIconProps} from 'mdi-react/dist/typings'
import ArrowDownIcon from 'mdi-react/ArrowDownIcon'
import ArrowUpIcon from 'mdi-react/ArrowUpIcon'
import CheckIcon from 'mdi-react/CheckIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import ChevronUpIcon from 'mdi-react/ChevronUpIcon'
import MenuDownIcon from 'mdi-react/MenuDownIcon'
import MenuUpIcon from 'mdi-react/MenuUpIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import Raven from 'raven-js'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import VisibilitySensor from 'react-visibility-sensor'

import {isMobileVersion} from 'components/mobile'

import 'styles/fonts/Lato/font.css'

// Extract color components.
export const colorToComponents = (color: string): [number, number, number] => ([
  parseInt(color.substring(1, 3), 16),
  parseInt(color.substring(3, 5), 16),
  parseInt(color.substring(5, 7), 16),
])

// Change #rrbbgg color to rgba(r, b, g, alpha)
export const colorToAlpha = (color: string, alpha: number): string => {
  const [red, green, blue] = colorToComponents(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha || 1})`
}

export const SmoothTransitions: React.CSSProperties = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}

export const FastTransitions: React.CSSProperties = {
  transition: 'all 100ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}

// Maximum width of content on super wide screen.
export const MAX_CONTENT_WIDTH = 1000

// Minimum padding between screen borders and content on medium screens.
export const MIN_CONTENT_PADDING = 20

export const Styles = {
  // Style for the sticker on top of a box that tells the users why we show them this box.
  BOX_EXPLANATION: {
    backgroundColor: colors.BOB_BLUE,
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
  // Style for text input.
  // ! Border color is handled in App.css !
  INPUT: {
    background: 'inherit',
    borderRadius: 0,
    color: colors.CHARCOAL_GREY,
    fontSize: 15,
    fontWeight: 'normal',
    height: 41,
    paddingLeft: 15,
    width: '100%',
    ...SmoothTransitions,
  },
  VENDOR_PREFIXED: (property: string, value): React.CSSProperties => {
    const style = {}
    const propertySuffix = property.substr(0, 1).toUpperCase() + property.substr(1);
    ['Moz', 'Ms', 'O', 'Webkit'].forEach((prefix): void => {
      style[prefix + propertySuffix] = value
    })
    style[property] = value
    return style
  },
} as const


interface TypeStyle extends RadiumCSSProperties {
  backgroundColor: string
  disabledColor?: string
}


const BUTTON_TYPE_STYLES: {[type: string]: TypeStyle} = {
  back: {
    backgroundColor: colors.SILVER,
  },
  deletion: {
    backgroundColor: colors.RED_PINK,
    disabledColor: colorToAlpha(colors.RED_PINK, .5),
  },
  discreet: {
    ':active': {
      backgroundColor: colors.SILVER,
      boxShadow: 'none',
      transform: 'translateY(0)',
    },
    ':hover': {
      backgroundColor: colors.BACKGROUND_GREY,
      boxShadow: 'none',
      transform: 'translateY(0)',
    },
    backgroundColor: 'transparent',
    boxShadow: 'none',
    color: colors.SLATE,
    ...SmoothTransitions,
  },
  navigation: {
    backgroundColor: colors.BOB_BLUE,
    disabledColor: colorToAlpha(colors.BOB_BLUE, .5),
  },
  navigationOnImage: {
    backgroundColor: 'rgba(255, 255, 255, .3)',
  },
  validation: {
    backgroundColor: colors.GREENISH_TEAL,
    disabledColor: colorToAlpha(colors.GREENISH_TEAL, .5),
  },
}


type HTMLButtonProps = React.HTMLProps<HTMLButtonElement>
interface ButtonProps extends Pick<HTMLButtonProps, Exclude<keyof HTMLButtonProps, 'type'>> {
  bounceDurationMs?: number
  isHighlighted?: boolean
  isNarrow?: boolean
  isProgressShown?: boolean
  isRound?: boolean
  style?: React.CSSProperties
  type?: keyof typeof BUTTON_TYPE_STYLES
}


class ButtonBase extends React.PureComponent<ButtonProps, {isClicking: boolean}> {
  public static propTypes = {
    bounceDurationMs: PropTypes.number,
    children: PropTypes.node.isRequired,
    // We keep disabled by consistency with the DOM button element.
    // eslint-disable-next-line react/boolean-prop-naming
    disabled: PropTypes.bool,
    isHighlighted: PropTypes.bool,
    isNarrow: PropTypes.bool,
    isProgressShown: PropTypes.bool,
    isRound: PropTypes.bool,
    onClick: PropTypes.func,
    onMouseDown: PropTypes.func,
    style: PropTypes.object,
    type: PropTypes.oneOf(Object.keys(BUTTON_TYPE_STYLES)),
  }

  public static defaultProps = {
    bounceDurationMs: 50,
  }

  public state = {
    isClicking: false,
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private dom: React.RefObject<HTMLButtonElement> = React.createRef()

  private timeout: ReturnType<typeof setTimeout>

  public blur(): void {
    this.dom.current && this.dom.current.blur()
  }

  private handleClick = (event): void => {
    const {bounceDurationMs, onClick} = this.props
    if (!onClick) {
      return
    }
    if (event && event.stopPropagation) {
      event.stopPropagation()
    }
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    this.setState({isClicking: true})
    this.timeout = setTimeout((): void => {
      this.setState({isClicking: false})
      onClick && onClick(event)
    }, bounceDurationMs)
  }

  public render(): React.ReactNode {
    const {bounceDurationMs, children, disabled, isNarrow, isProgressShown, type, style,
      isHighlighted, isRound, ...otherProps} = this.props
    const {isClicking} = this.state
    const typeStyle = BUTTON_TYPE_STYLES[type] || BUTTON_TYPE_STYLES.navigation

    const buttonStyle: RadiumCSSProperties = {
      border: 'none',
      borderRadius: isRound ? 30 : 5,
      boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
      color: '#fff',
      cursor: 'pointer',
      flexShrink: 0,
      fontSize: isRound ? 15 : 16,
      fontStyle: 'normal',
      fontWeight: 'normal',
      padding: isNarrow ? '10px 14px' : isRound ? '12px 35px' : '12px 20px',
      textAlign: 'center',
      transform: 'translateY(0)',
      transition: `ease ${bounceDurationMs}ms`,
      ...typeStyle,
      ...style,
    }
    if (!disabled) {
      buttonStyle[':hover'] = {
        backgroundColor: buttonStyle.backgroundColor,
        boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
        transform: 'translateY(-1px)',
        ...typeStyle[':hover'],
        ...(style ? style[':hover'] : {}),
      }
      buttonStyle[':focus'] = buttonStyle[':hover']
      buttonStyle[':active'] = {
        boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
        transform: 'translateY(1px)',
        ...typeStyle[':active'],
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
      onClick={this.handleClick} ref={this.dom} type="button">
      {isProgressShown ?
        <CircularProgress size={23} style={{color: '#fff'}} thickness={2} /> :
        children}
    </button>

  }
}
const Button = Radium(ButtonBase)


class ExternalLink extends React.PureComponent<React.HTMLProps<HTMLAnchorElement>> {
  public render(): React.ReactNode {
    return <a rel="noopener noreferrer" target="_blank" {...this.props} />
  }
}


// TODO(cyrille): Find a cleaner way to define this.
interface MarkDownParagraphRendererProps extends React.HTMLProps<HTMLDivElement> {
  nodeKey?: string
}

class SingeLineParagraph extends React.PureComponent<MarkDownParagraphRendererProps> {
  public render(): React.ReactNode {
    const {nodeKey: omittedNodeKey, value: omittedValue, ...otherProps} = this.props
    return <div {...otherProps} />
  }
}


interface MarkdownProps extends Omit<ReactMarkdown['props'], 'source' | 'escapeHtml'> {
  content?: string
  isSingleLine?: boolean
  style?: React.CSSProperties
}


class Markdown extends React.PureComponent<MarkdownProps> {
  public static propTypes = {
    content: PropTypes.string,
    isSingleLine: PropTypes.bool,
    renderers: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {content, isSingleLine, renderers, ...extraProps} = this.props
    if (!content) {
      return null
    }
    return <ReactMarkdown
      source={content} escapeHtml={true}
      renderers={{
        link: ({nodeKey: unusedNodeKey, value: unusedValue, ...props}): React.ReactElement =>
          <ExternalLink {...props} />,
        ...isSingleLine ? {paragraph: SingeLineParagraph} : {},
        ...renderers}}
      {...extraProps} />
  }
}


interface CircularProgressProps {
  periodMilliseconds: number
  size: number
  style?: React.CSSProperties
  thickness: number
}


interface CircularProgressState {
  isWrapperRotated: boolean
  scalePathStep: number
}


class CircularProgress extends React.PureComponent<CircularProgressProps, CircularProgressState> {
  public static propTypes = {
    periodMilliseconds: PropTypes.number,
    size: PropTypes.number,
    style: PropTypes.object,
    thickness: PropTypes.number,
  }

  public static defaultProps = {
    periodMilliseconds: 1750,
    size: 80,
    thickness: 3.5,
  }

  public state = {
    isWrapperRotated: false,
    scalePathStep: 0,
  }

  public componentDidMount(): void {
    this.scalePath(0)
    this.rotateWrapper()
  }

  public componentWillUnmount(): void {
    clearTimeout(this.scalePathTimer)
    clearTimeout(this.rotateWrapperTimer1)
    clearTimeout(this.rotateWrapperTimer2)
  }

  private rotateWrapperTimer1: ReturnType<typeof setTimeout>

  private rotateWrapperTimer2: ReturnType<typeof setTimeout>

  private scalePathTimer: ReturnType<typeof setTimeout>

  private scalePath(step): void {
    const {periodMilliseconds} = this.props
    this.setState({scalePathStep: step})
    this.scalePathTimer = setTimeout(
      (): void => this.scalePath((step + 1) % 3),
      step ? .4 * periodMilliseconds : .2 * periodMilliseconds)
  }

  private rotateWrapper(): void {
    const {periodMilliseconds} = this.props
    this.setState({isWrapperRotated: false})

    this.rotateWrapperTimer1 = setTimeout((): void => {
      this.setState({isWrapperRotated: true})
    }, 50)

    this.rotateWrapperTimer2 = setTimeout(
      (): void => this.rotateWrapper(),
      50 + periodMilliseconds * 5.7143)
  }

  public render(): React.ReactNode {
    const {periodMilliseconds, size, thickness} = this.props
    const {isWrapperRotated, scalePathStep} = this.state
    const style: React.CSSProperties = {
      color: colors.BOB_BLUE,
      height: size,
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative',
      width: size,
      ...this.props.style,
    }
    const color = style.color
    const wrapperStyle: React.CSSProperties = {
      display: 'inline-block',
      height: size,
      transform: `rotate(${isWrapperRotated ? '1800' : '0'}deg)`,
      transition: `all ${isWrapperRotated ? '10' : '0'}s linear`,
      width: size,
    }
    const getArcLength = (fraction): number => fraction * Math.PI * (size - thickness)
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
    const pathStyle: React.CSSProperties = {
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
function chooseImageVersion(responsiveImage, isMobileVersion): string {
  return !isMobileVersion ? responsiveImage.src :
    responsiveImage.images[1] ?
      responsiveImage.images[1].path :
      responsiveImage.src
}


const IMAGE_SIZE_SHAPE = PropTypes.shape({
  mediaCondition: PropTypes.string,
  width: PropTypes.string.isRequired,
})


interface MultiSizeImageProps {
  alt: string
  sizes: {
    mediaCondition?: string
    width: string
  }[]
  srcs: {
    src: string
    srcSet?: string
    width?: number
  }
}


// A component using output from dynamic loader for multi-sized images.
// You must still implement the sizes, although a default is set to first image width.
// You can get most of the props directly from responsive-loader:
// `import myImageAllSizes from 'myImage.jpg/png?multi&sizes[]=<defaultSize>&sizes[]=<otherSize>'`
class MultiSizeImage extends React.PureComponent<MultiSizeImageProps> {
  public static propTypes = {
    alt: PropTypes.string.isRequired,
    sizes: PropTypes.arrayOf(IMAGE_SIZE_SHAPE.isRequired),
    srcs: PropTypes.shape({
      src: PropTypes.string.isRequired,
      srcSet: PropTypes.string,
      width: PropTypes.number,
    }).isRequired,
  }


  private sizeRow(size): string {
    const {mediaCondition, width} = size
    return mediaCondition ? `${mediaCondition} ${width}` : width
  }

  private makeSizesProp(sizes, width): string {
    if (!sizes || !sizes.length) {
      return width || ''
    }
    return sizes.map(this.sizeRow).join(', ')
  }

  public render(): React.ReactNode {
    const {alt, srcs, sizes, ...props} = this.props
    const sizesProp = this.makeSizesProp(sizes, srcs.width)
    return <img alt={alt} src={srcs.src} srcSet={srcs.srcSet} sizes={sizesProp} {...props} />
  }
}


interface JobGroupCoverImageProps {
  blur?: number
  coverOpacity?: number
  grayScale?: number
  opaqueCoverColor?: string
  opaqueCoverGradient?: {
    left: string
    middle?: string
    right: string
  }
  romeId: string
  style?: React.CSSProperties
}


class JobGroupCoverImage extends React.PureComponent<JobGroupCoverImageProps> {
  public static propTypes = {
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

  public static defaultProps = {
    coverOpacity: .4,
    opaqueCoverColor: '#000',
  }

  public render(): React.ReactNode {
    const {blur, coverOpacity, grayScale, opaqueCoverColor,
      opaqueCoverGradient, romeId, style} = this.props
    const url = (isMobileVersion ? config.jobGroupImageSmallUrl : config.jobGroupImageUrl).
      replace('ROME_ID', romeId)
    const coverAll: React.CSSProperties = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle: React.CSSProperties = {
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


interface RadioButtonProps {
  isHovered?: boolean
  isSelected?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}


class RadioButton extends React.PureComponent<RadioButtonProps, {isFocused: boolean}> {
  public static propTypes = {
    isHovered: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  public state = {
    isFocused: false,
  }

  private handleFocused = _memoize((isFocused): (() => void) =>
    (): void => this.setState({isFocused}))

  public render(): React.ReactNode {
    const {isHovered, isSelected, onClick, style} = this.props
    const {isFocused} = this.state
    const isHighlighted = isHovered || isFocused
    const outerCircleStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderColor: isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY,
      borderRadius: '50%',
      borderStyle: 'solid',
      borderWidth: 1,
      cursor: onClick ? 'pointer' : 'initial',
      height: 20,
      position: 'absolute',
      width: 20,
    }
    const innerCircleStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      borderRadius: '50%',
      height: 10,
      left: 4,
      position: 'absolute',
      top: 4,
      width: 10,
    }
    const containerStyle: React.CSSProperties = {
      display: 'inline-block',
      height: outerCircleStyle.height,
      position: 'relative',
      width: outerCircleStyle.width,
      ...style,
    }
    return <div
      style={containerStyle} tabIndex={0}
      onFocus={this.handleFocused(true)}
      onBlur={this.handleFocused(false)}
      onClick={onClick}
      onKeyPress={isFocused ? onClick : null}>
      <div style={outerCircleStyle}>
        {isSelected ? <div style={innerCircleStyle} /> : null}
      </div>
    </div>
  }
}


interface CheckboxProps {
  isHovered?: boolean
  isSelected?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}


class Checkbox extends React.PureComponent<CheckboxProps, {isFocused: boolean}> {
  public static propTypes = {
    isHovered: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  public state = {
    isFocused: false,
  }

  private handleFocused = _memoize((isFocused): (() => void) =>
    (): void => this.setState({isFocused}))

  public render(): React.ReactNode {
    const {isHovered, isSelected, onClick, style} = this.props
    const {isFocused} = this.state
    const isHighlighted = isHovered || isFocused
    const size = 20
    const outerBoxStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: isSelected ? colors.BOB_BLUE : '#fff',
      borderColor: isSelected ? colors.BOB_BLUE : (
        isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY
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
    const containerStyle: React.CSSProperties = {
      display: 'inline-block',
      height: outerBoxStyle.height,
      position: 'relative',
      width: outerBoxStyle.width,
      ...style,
    }
    return <div
      style={containerStyle} tabIndex={0}
      onFocus={this.handleFocused(true)}
      onBlur={this.handleFocused(false)}
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
} as const


interface LabeledToggleProps {
  isSelected?: boolean
  label: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
  type: keyof typeof TOGGLE_INPUTS
}


class LabeledToggle extends React.PureComponent<LabeledToggleProps, {isHovered: boolean}> {
  public static propTypes = {
    isSelected: PropTypes.bool,
    label: PropTypes.node.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
    type: PropTypes.oneOf(Object.keys(TOGGLE_INPUTS)).isRequired,
  }

  public state = {
    isHovered: false,
  }

  private handleHover = _memoize((isHovered): (() => void) =>
    (): void => this.setState({isHovered}))

  public render(): React.ReactNode {
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
      onMouseOver={this.handleHover(true)} onMouseOut={this.handleHover(false)} >
      <ToggleInput
        style={{flex: 'none'}} onClick={onClick}
        isSelected={isSelected} isHovered={isHovered} />
      <span onClick={onClick} style={{marginLeft: 10}}>
        {label}
      </span>
    </div>
  }
}


interface UpDownIconProps extends MdiReactIconProps {
  icon: 'arrow' | 'chevron' | 'menu'
  isUp?: boolean
}


class UpDownIcon extends React.PureComponent<UpDownIconProps> {
  public static propTypes = {
    icon: PropTypes.oneOf(['arrow', 'chevron', 'menu']).isRequired,
    isUp: PropTypes.bool,
  }

  private chooseIcon(icon, isUp): React.ComponentType<MdiReactIconProps> {
    if (icon === 'arrow') {
      return isUp ? ArrowUpIcon : ArrowDownIcon
    }
    if (icon === 'chevron') {
      return isUp ? ChevronUpIcon : ChevronDownIcon
    }
    return isUp ? MenuUpIcon : MenuDownIcon
  }

  public render(): React.ReactNode {
    const {icon, isUp, ...otherProps} = this.props
    const Icon = this.chooseIcon(icon, isUp)
    return <Icon {...otherProps} />
  }
}


interface IconInputProps extends InputProps {
  iconComponent: React.ComponentType<MdiReactIconProps>
  iconStyle?: React.CSSProperties
  inputStyle?: React.CSSProperties
  shouldFocusOnMount?: boolean
}


class IconInput extends React.PureComponent<IconInputProps> {
  public static propTypes = {
    iconComponent: PropTypes.object.isRequired,
    iconStyle: PropTypes.object,
    inputStyle: PropTypes.object,
    shouldFocusOnMount: PropTypes.bool,
    style: PropTypes.object,
  }

  public componentDidMount(): void {
    const {shouldFocusOnMount} = this.props
    if (shouldFocusOnMount && !isMobileVersion) {
      this.handleFocus()
    }
  }

  private input: React.RefObject<Input> = React.createRef()

  private handleFocus = (): void => this.input.current && this.input.current.focus()

  public render(): React.ReactNode {
    const {iconComponent, iconStyle, inputStyle, style,
      shouldFocusOnMount: omittedShouldFocusOnMount,
      ...otherProps} = this.props
    const iconContainer: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: 'white',
      bottom: 0,
      color: colors.PINKISH_GREY,
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
        {...otherProps}
        ref={this.input}
        style={inputStyle} />
      <div style={iconContainer} onClick={this.handleFocus}>
        <Icon style={iconStyle} />
      </div>
    </div>
  }
}


interface WithNoteProps {
  children: React.ReactNode
  hasComment?: boolean
  note: React.ReactNode
}


class WithNote extends React.PureComponent<WithNoteProps> {
  public static propTypes = {
    children: PropTypes.node,
    hasComment: PropTypes.bool,
    note: PropTypes.node.isRequired,
  }

  public render(): React.ReactNode {
    const {children, hasComment, note} = this.props
    const noteStyle = {
      color: colors.COOL_GREY,
      fontSize: 15,
      lineHeight: 1.1,
      marginBottom: hasComment ? 0 : 20,
      marginTop: 8,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {children}
      <div style={noteStyle}>
        {note}
      </div>
    </div>
  }
}


type HTMLInputElementProps = React.HTMLProps<HTMLInputElement>
interface InputProps
  extends Pick<HTMLInputElementProps, Exclude<keyof HTMLInputElementProps, 'onChange' | 'ref'>> {
  applyFunc?: (inputValue: string) => string
  onChange?: (inputValue: string) => void
  onChangeDelayMillisecs?: number
  onEdit?: (inputValue: string) => void
  value?: string
}


interface InputState {
  lastChangedValue?: string
  propValue?: string
  value?: string
}


class Input extends React.PureComponent<InputProps, InputState> {
  public static propTypes = {
    applyFunc: PropTypes.func,
    onBlur: PropTypes.func,
    onChange: PropTypes.func,
    // If this is set to a non-zero value, the components will wait the given amount of time before
    // calling onChange, to avoid calling it for each key pressed. It also calls it on blur events
    // and at unmount.
    onChangeDelayMillisecs: PropTypes.number,
    // If onChangeDelayMillisecs is set, this is called everytime the editable value changes,
    // without waiting for any delay.
    onEdit: PropTypes.func,
    style: PropTypes.object,
    value: PropTypes.string,
  }

  public state: InputState = {
    lastChangedValue: this.props.value,
  }

  public static getDerivedStateFromProps({value}, {propValue}): InputState {
    if (propValue !== value) {
      return {propValue: value, value}
    }
    return null
  }

  // TODO(cyrille): Check behaviour when onChangeDelayMillisecs changes.
  public componentDidUpdate(prevProps, {value: prevValue}): void {
    const {onChange, onChangeDelayMillisecs} = this.props
    const {lastChangedValue, value} = this.state
    // Nothing to do if the update is not related to a change in state value.
    if (value === prevValue) {
      return
    }
    // Nothing to do if onChange doesn't exist or has already been called by handleChange.
    if (!onChangeDelayMillisecs || !onChange) {
      return
    }
    clearTimeout(this.timeout)
    if (value !== lastChangedValue) {
      this.timeout = setTimeout((): void => this.onChange(value), onChangeDelayMillisecs)
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
    this.onChange(this.state.value, true)
  }

  private dom: React.RefObject<HTMLInputElement> = React.createRef()

  private timeout: ReturnType<typeof setTimeout>

  private onChange = (value: string, isLastSave?: boolean): void => {
    const {onChange} = this.props
    if (this.state.lastChangedValue === value) {
      return
    }
    onChange && onChange(value)
    !isLastSave && this.setState({lastChangedValue: value})
  }

  private handleChange = (event): void => {
    event.stopPropagation()
    const {applyFunc, onChange, onEdit, onChangeDelayMillisecs} = this.props
    const value = applyFunc ? applyFunc(event.target.value) : event.target.value
    this.setState({value})
    onChangeDelayMillisecs ? onEdit && onEdit(value) : onChange && onChange(value)
  }

  private handleBlur = (event): void => {
    const {onBlur, onChange, onChangeDelayMillisecs} = this.props
    if (onChangeDelayMillisecs && onChange) {
      clearTimeout(this.timeout)
      this.onChange(this.state.value)
    }
    onBlur && onBlur(event)
  }

  public focus(): void {
    this.dom.current && this.dom.current.focus()
  }

  public select(): void {
    this.dom.current && this.dom.current.select()
  }

  public render(): React.ReactNode {
    const {onChangeDelayMillisecs, style, value,
      applyFunc: omittedApplyFunc, onBlur: omittedOnBlur,
      onChange: omittedOnChange, onEdit: omittedOnEdit,
      ...otherProps} = this.props
    const inputValue = onChangeDelayMillisecs ? this.state.value : value
    const inputStyle = {
      ...Styles.INPUT,
      ...style,
    }
    return <input
      {...otherProps} style={inputStyle} onChange={this.handleChange}
      value={inputValue} onBlur={this.handleBlur} ref={this.dom} />
  }
}


interface PieChartProps {
  backgroundColor?: string
  children?: React.ReactNode
  durationMillisec: number
  percentage: number
  size: number
  strokeWidth: number
  style?: React.CSSProperties
}


// TODO(cyrille): Use this in transparency page.
class PieChart extends React.PureComponent<PieChartProps, {hasStartedGrowing: boolean}> {
  public static propTypes = {
    backgroundColor: PropTypes.string,
    children: PropTypes.node,
    durationMillisec: PropTypes.number.isRequired,
    percentage: PropTypes.number.isRequired,
    size: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    durationMillisec: 1000,
    size: 60,
    strokeWidth: 15,
  }

  public state = {
    hasStartedGrowing: false,
  }

  private startGrowing = (isVisible): void => {
    if (!isVisible) {
      return
    }
    this.setState({
      hasStartedGrowing: true,
    })
  }

  // TODO(cyrille): Add default value for style.color, or require it in props.
  public render(): React.ReactNode {
    const {backgroundColor, children, durationMillisec, percentage, size,
      strokeWidth, style} = this.props
    const {hasStartedGrowing} = this.state
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 28,
      fontWeight: 'bold',
      height: 2 * size,
      justifyContent: 'center',
      position: 'relative',
      width: 2 * size,
      ...style,
    }
    const currentPercentage = hasStartedGrowing ? percentage : 0
    const radius = size - strokeWidth / 2
    const perimeter = radius * 2 * Math.PI
    const strokeLength = perimeter * currentPercentage / 100
    return <span style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250}
        onChange={this.startGrowing}>
        <svg
          style={{left: 0, position: 'absolute', top: 0}} viewBox={`0 0 ${2 * size} ${2 * size}`}>
          <circle
            cx={size} cy={size} r={radius} fill="none"
            stroke={backgroundColor} strokeWidth={strokeWidth} />
          <circle
            cx={size} cy={size} r={radius} fill="none"
            stroke={style.color} strokeDashoffset={perimeter / 4}
            strokeDasharray={`${strokeLength},${perimeter - strokeLength}`}
            strokeWidth={strokeWidth} style={{transition: `${durationMillisec}ms`}} />
        </svg>
      </VisibilitySensor>
      {children}
    </span>
  }
}


interface GrowingNumberProps {
  durationMillisec: number
  isSteady?: boolean
  number: number
  style?: React.CSSProperties
}


interface GrowingNumberState {
  growingForMillisec?: number
  hasGrown?: boolean
  hasStartedGrowing?: boolean
}


class GrowingNumber extends React.PureComponent<GrowingNumberProps, GrowingNumberState> {
  public static propTypes = {
    durationMillisec: PropTypes.number.isRequired,
    isSteady: PropTypes.bool,
    number: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    durationMillisec: 1000,
  }

  public state = {
    growingForMillisec: 0,
    hasGrown: false,
    hasStartedGrowing: false,
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout: ReturnType<typeof setTimeout>

  private startGrowing = (isVisible): void => {
    if (!isVisible) {
      return
    }
    this.grow(0)
  }

  private grow(growingForMillisec: number): void {
    clearTimeout(this.timeout)
    if (growingForMillisec >= this.props.durationMillisec) {
      this.setState({hasGrown: true})
      return
    }
    this.setState(({hasStartedGrowing}): GrowingNumberState => ({
      growingForMillisec,
      ...hasStartedGrowing ? {} : {hasStartedGrowing: true},
    }))
    this.timeout = setTimeout((): void => this.grow(growingForMillisec + 50), 50)
  }

  public render(): React.ReactNode {
    const {durationMillisec, isSteady, number, style} = this.props
    const {growingForMillisec, hasGrown, hasStartedGrowing} = this.state
    const maxNumDigits = number ? Math.floor(Math.log10(number)) + 1 : 1
    const containerStyle: React.CSSProperties = isSteady ? {
      display: 'inline-block',
      textAlign: 'right',
      // 0.625 was found empirically.
      width: `${maxNumDigits * 0.625}em`,
      ...style,
    } : style
    return <span style={containerStyle}>
      <VisibilitySensor
        active={!hasStartedGrowing} intervalDelay={250}
        onChange={this.startGrowing}>
        <span>
          {hasGrown ? number : Math.round(growingForMillisec / durationMillisec * number)}
        </span>
      </VisibilitySensor>
    </span>
  }
}


// This component avoids that the element touches the border when on mobile.
// For now, we only use is for text, hence a solution that does not require a component would be,
// better, but we didn't find one yet.
class PaddedOnMobile extends React.PureComponent<{style?: React.CSSProperties}> {
  public static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, style} = this.props
    const containerStyle = {
      ...style,
      padding: isMobileVersion ? '0 20px' : 0,
    }
    return <div style={containerStyle}>{children}</div>
  }
}


interface AppearingListProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactStylableElement[]
  maxNumChildren?: number
}


class AppearingList extends React.PureComponent<AppearingListProps, {isShown: boolean}> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    maxNumChildren: PropTypes.number,
  }

  public state = {
    isShown: false,
  }

  private handleShow = (isShown): void => this.setState({isShown})

  public render(): React.ReactNode {
    const {children, maxNumChildren, ...extraProps} = this.props
    const {isShown} = this.state
    const itemStyle = (index, style): React.CSSProperties => ({
      opacity: isShown ? 1 : 0,
      transition: `opacity 300ms ease-in ${index * 700 / children.length}ms`,
      ...style,
    })
    const shownChildren = maxNumChildren ? children.slice(0, maxNumChildren) : children
    return <VisibilitySensor
      active={!isShown} intervalDelay={250} partialVisibility={true}
      onChange={this.handleShow}>
      <div {...extraProps}>
        {shownChildren.map((item, index): React.ReactNode =>
          React.cloneElement(item, {
            key: item.key || index,
            style: itemStyle(index, item.props.style),
          }))}
      </div>
    </VisibilitySensor>
  }
}


class Tag extends React.PureComponent<{style?: React.CSSProperties}> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, style} = this.props
    const containerStyle: React.CSSProperties = {
      backgroundColor: colors.GREENISH_TEAL,
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
      {children}
    </span>
  }
}


interface StringJoinerProps {
  children: React.ReactNode[]
  lastSeparator: React.ReactNode
  separator: React.ReactNode
}


class StringJoiner extends React.PureComponent<StringJoinerProps> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    lastSeparator: PropTypes.node.isRequired,
    separator: PropTypes.node.isRequired,
  }

  public static defaultProps = {
    lastSeparator: ' ou ',
    separator: ', ',
  }

  public render(): React.ReactNode {
    const {children, lastSeparator, separator} = this.props
    if (Object.prototype.toString.call(children) !== '[object Array]') {
      return children
    }
    if (children.length === 1) {
      return children[0]
    }
    const parts = []
    children.forEach((child, index): void => {
      if (index) {
        const nextSeparator = (index === children.length - 1) ? lastSeparator : separator
        parts.push(<span key={`sep-${index}`}>{nextSeparator}</span>)
      }
      parts.push(child)
    })
    return <span>{parts}</span>
  }
}


interface OutsideClickHandlerProps extends React.HTMLProps<HTMLDivElement> {
  onOutsideClick: () => void
}


// A component to handle when mouse is clicked outside its children.
// All clicks on children won't be handled. All clicks outside will trigger onOutsideClick. You can
// also add other props such as style.
class OutsideClickHandler extends React.PureComponent<OutsideClickHandlerProps> {
  public static propTypes = {
    children: PropTypes.element.isRequired,
    onOutsideClick: PropTypes.func.isRequired,
  }

  public componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  public componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef()

  private handleClickOutside = (event): void => {
    if (this.wrapperRef.current && !this.wrapperRef.current.contains(event.target)) {
      this.props.onOutsideClick()
    }
  }

  public render(): React.ReactNode {
    const {children, onOutsideClick: omittedOnOutsideClick, ...extraProps} = this.props
    return <div ref={this.wrapperRef} {...extraProps}>
      {children}
    </div>
  }
}


interface PercentBarProps {
  color: string
  height: number
  isPercentShown: boolean
  percent?: number
  style?: React.CSSProperties
}


class PercentBar extends React.PureComponent<PercentBarProps> {
  public static propTypes = {
    color: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
    isPercentShown: PropTypes.bool.isRequired,
    percent: PropTypes.number,
    style: PropTypes.object,
  }

  public static defaultProps = {
    height: 25,
    isPercentShown: true,
    percent: 0,
  }

  public render(): React.ReactNode {
    const {color, height, percent, isPercentShown, style} = this.props
    const containerStyle: React.CSSProperties = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      borderRadius: 25,
      height: height,
      overflow: 'hidden',
      width: '100%',
      ...style,
    }
    const percentStyle: React.CSSProperties = {
      backgroundColor: color,
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
      height: '100%',
      lineHeight: height - 10 + 'px',
      paddingBottom: 3,
      paddingLeft: isPercentShown ? 18 : 0,
      paddingTop: 7,
      width: `${percent}%`,
    }
    return <div style={containerStyle}>
      {percent ? <div style={percentStyle}>
        {isPercentShown ? `${Math.round(percent)}%` : ''}
      </div> : null}
    </div>
  }
}


interface CarouselArrowProps {
  chevronSize?: number
  handleClick: () => void
  isLeft?: boolean
  isVisible?: boolean
  style?: React.CSSProperties
}


// TODO(marielaure): Find a way to refactor carousels. There are too many custom ones.
class CarouselArrow extends React.PureComponent<CarouselArrowProps> {
  public static propTypes = {
    chevronSize: PropTypes.number,
    handleClick: PropTypes.func.isRequired,
    isLeft: PropTypes.bool,
    isVisible: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {chevronSize, handleClick, isLeft, isVisible, style} = this.props
    const chevronContainerStyle = (isVisible): React.CSSProperties => ({
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      borderRadius: 25,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      cursor: isVisible ? 'pointer' : 'auto',
      display: 'flex',
      height: 45,
      justifyContent: 'center',
      opacity: isVisible ? 1 : 0,
      width: 45,
      ...SmoothTransitions,
      ...style,
    })
    return <div
      style={chevronContainerStyle(isVisible)}
      onClick={handleClick}>
      {isLeft ? <ChevronLeftIcon color="#fff" size={chevronSize} /> :
        <ChevronRightIcon color="#fff" size={chevronSize} />}
    </div>
  }
}


type HTMLTextAreaProps = React.HTMLProps<HTMLTextAreaElement>
interface TextareaProps
  extends Pick<HTMLTextAreaProps, Exclude<keyof HTMLTextAreaProps, 'onChange' | 'ref'>> {
  onChange?: (inputValue: string) => void
}


class Textarea extends React.PureComponent<TextareaProps> {
  public static propTypes = {
    onChange: PropTypes.func,
  }

  private dom: React.RefObject<HTMLTextAreaElement> = React.createRef()

  private handleChange = (event): void => {
    event.stopPropagation()
    this.props.onChange(event.target.value)
  }

  public focus(): void {
    this.dom.current && this.dom.current.focus()
  }

  public select(): void {
    this.dom.current && this.dom.current.select()
  }

  public render(): React.ReactNode {
    return <textarea
      {...this.props} onChange={this.props.onChange && this.handleChange} ref={this.dom} />
  }
}


class ColoredBullet extends React.PureComponent<{color: string}> {
  public static propTypes = {
    color: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const bulletStyle = {
      backgroundColor: this.props.color,
      borderRadius: '50%',
      height: 10,
      margin: '0 20px 0 5px',
      width: 10,
    }
    return <div style={bulletStyle} />
  }
}


interface VideoFrameProps {
  aspectRatio: number
  children: React.ReactElement<{
    height: string
    style: RadiumCSSProperties
    width: string
  }>
  style?: React.CSSProperties
}


// A nice way to have 16/9 video iframes.
class VideoFrame extends React.PureComponent<VideoFrameProps> {
  public static propTypes = {
    // Desired width/height ratio for the frame.
    aspectRatio: PropTypes.number.isRequired,
    children: PropTypes.element.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    aspectRatio: 16 / 9,
  }

  public render(): React.ReactNode {
    const {aspectRatio, children, style} = this.props
    const coverallStyle = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    return <div style={style}>
      <div style={{height: 0, paddingBottom: `${100 / aspectRatio}%`, position: 'relative'}}>
        {React.cloneElement(children, {
          height: '100%',
          style: {...children.props.style, ...coverallStyle},
          width: '100%',
        })}
      </div>
    </div>
  }
}


const missingImages: Set<string> = new Set([])


interface ImgProps
  extends React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  fallbackSrc?: string
}


class Img extends React.PureComponent<ImgProps, {hasErred?: boolean}> {
  public static propTypes = {
    alt: PropTypes.string.isRequired,
    fallbackSrc: PropTypes.string,
  }

  public state = {
    hasErred: false,
  }

  private imgRef: React.RefObject<HTMLImageElement> = React.createRef()

  private handleError = (): void => {
    if (!this.state.hasErred && this.imgRef.current) {
      const src = this.imgRef.current.src
      if (Raven.captureMessage && !missingImages.has(src)) {
        Raven.captureMessage(`Image source is no longer available: ${src}.`)
        missingImages.add(src)
      }
      this.imgRef.current.src = this.props.fallbackSrc
      this.setState({hasErred: true})
    }
  }

  public render(): React.ReactNode {
    const {alt, fallbackSrc: omittedFallbackSrc, ...otherProps} = this.props
    return <img {...otherProps} alt={alt} onError={this.handleError} />
  }
}


export {
  Markdown, LabeledToggle, Tag, PercentBar, Button, IconInput, WithNote, Input, ExternalLink,
  JobGroupCoverImage, PieChart, OutsideClickHandler, GrowingNumber, PaddedOnMobile, AppearingList,
  CircularProgress, StringJoiner, Checkbox, UpDownIcon, chooseImageVersion, MultiSizeImage,
  CarouselArrow, Textarea, ColoredBullet, VideoFrame, Img,
}
