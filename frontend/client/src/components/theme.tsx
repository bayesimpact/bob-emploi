import * as Sentry from '@sentry/browser'
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
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import VisibilitySensor from 'react-visibility-sensor'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {useRadium} from 'components/radium'

import 'styles/fonts/Lato/font.css'

// Extract color components.
export const colorToComponents = (color: string): [number, number, number] => {
  if (color.length === 7) {
    return [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ]
  }
  return [
    Number.parseInt(color.slice(1, 2), 16) * 0x11,
    Number.parseInt(color.slice(2, 3), 16) * 0x11,
    Number.parseInt(color.slice(3, 4), 16) * 0x11,
  ]
}

// Inverse of colorToComponents.
const componentsToColor = (components: [number, number, number]): string =>
  '#' + components.map((n: number): string => n.toString(16)).join('')

// Change #rrggbb color to rgba(r, g, b, alpha)
export const colorToAlpha = (color: string|undefined, alpha: number): string => {
  if (!color) {
    return ''
  }
  const [red, green, blue] = colorToComponents(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha === 0 ? 0 : alpha || 1})`
}

// Give a color between the two base colors, with linear interpolation.
export const colorGradient = (color0: string, color1: string, rate: number): string => {
  const [components0, components1] = [color0, color1].map(colorToComponents)
  const [red, green, blue] = new Array(3).fill(undefined).map((unused, index): number =>
    Math.round(components0[index] * (1 - rate) + components1[index] * rate))
  return componentsToColor([red, green, blue])
}

export const SmoothTransitions: React.CSSProperties = {
  transition: 'all 450ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}

export const FastTransitions: React.CSSProperties = {
  transition: 'all 100ms cubic-bezier(0.18, 0.71, 0.4, 0.82) 0ms',
}

export const nthFastTransition = (n: number, stepMs = 100): React.CSSProperties => ({
  transition: `all ${stepMs}ms cubic-bezier(0.18, 0.71, 0.4, 0.82) ${n * stepMs}ms`,
})

// Maximum width of content on super wide screen.
export const MAX_CONTENT_WIDTH = 1000

// Minimum padding between screen borders and content on medium screens.
export const MIN_CONTENT_PADDING = 20


function vendorProperties<K extends keyof React.CSSProperties>(
  property: K, value: React.CSSProperties[K]): React.CSSProperties {
  const style: React.CSSProperties = {}
  const propertySuffix = property.slice(0, 1).toUpperCase() + property.slice(1);
  ['Moz', 'Ms', 'O', 'Webkit'].forEach((prefix): void => {
    // @ts-ignore
    style[prefix + propertySuffix] = value
  })
  style[property] = value
  return style
}


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
  VENDOR_PREFIXED: vendorProperties,
} as const


interface TypeStyle extends RadiumCSSProperties {
  backgroundColor: string
  disabledColor?: string
}


const BUTTON_TYPE_STYLES: {[type: string]: TypeStyle} = {
  back: {
    ':active': {
      boxShadow: 'none',
    },
    ':hover': {
      boxShadow: 'none',
    },
    'backgroundColor': colors.SILVER,
    'boxShadow': 'none',
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
    'backgroundColor': 'transparent',
    'boxShadow': 'none',
    'color': colors.SLATE,
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


export interface ButtonProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'type'> {
  bounceDurationMs?: number
  isHighlighted?: boolean
  isNarrow?: boolean
  isProgressShown?: boolean
  isRound?: boolean
  style?: RadiumCSSProperties
  type?: keyof typeof BUTTON_TYPE_STYLES
}


const progressContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  height: '100%',
  justifyContent: '100%',
  left: 0,
  position: 'absolute',
  top: 0,
  width: '100%',
}


const ButtonBase = (props: ButtonProps, ref: React.Ref<HTMLButtonElement>): React.ReactElement => {
  const [clickingEvent, setClickingEvent] =
    useState<React.MouseEvent<HTMLButtonElement>|undefined>()
  const {bounceDurationMs = 50, children, disabled, isNarrow, isProgressShown, type, style,
    isHighlighted, isRound, onClick, ...otherProps} = props

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!onClick) {
      return
    }
    event?.stopPropagation?.()
    event?.preventDefault?.()
    setClickingEvent(event)
  }, [onClick])

  useEffect((): (() => void)|void => {
    if (!clickingEvent) {
      return
    }
    const timeout = window.setTimeout((): void => {
      setClickingEvent(undefined)
      onClick?.(clickingEvent)
    }, bounceDurationMs)
    return (): void => clearTimeout(timeout)
  }, [bounceDurationMs, clickingEvent, onClick])

  const typeStyle = BUTTON_TYPE_STYLES[type || 'navigation']

  const buttonStyle: RadiumCSSProperties = {
    border: 'none',
    borderRadius: isRound ? 30 : 5,
    ...!disabled && {boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)'},
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: isRound ? 15 : 16,
    fontStyle: 'normal',
    fontWeight: 'normal',
    padding: isNarrow ? '10px 14px' : isRound ? '12px 35px' : '12px 20px',
    position: 'relative',
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
      (colorToAlpha(typeStyle?.backgroundColor, .5)) ||
      'rgba(67, 212, 132, 0.5)'
    buttonStyle.cursor = 'inherit'
  }
  if (isHighlighted) {
    Object.assign(buttonStyle, buttonStyle[':hover'])
  }
  if (clickingEvent) {
    Object.assign(buttonStyle, buttonStyle[':active'])
  }
  const [radiumProps] =
    useRadium<HTMLButtonElement, Omit<ButtonProps, 'type'>>({...otherProps, style: buttonStyle})
  return <button disabled={disabled} {...radiumProps} onClick={handleClick} ref={ref}>
    {isProgressShown ? <React.Fragment>
      <div style={progressContainerStyle}>
        <CircularProgress size={23} style={{color: '#fff'}} thickness={2} />
      </div>
      <span style={{opacity: 0}}>
        {children}
      </span>
    </React.Fragment> : children}
  </button>
}
const Button = React.memo(React.forwardRef(ButtonBase))


type LinkProps = React.HTMLProps<HTMLAnchorElement>


const ExternalLinkBase: React.FC<LinkProps> = (props: LinkProps): React.ReactElement =>
  <a rel="noopener noreferrer" target="_blank" {...props} />
const ExternalLink = React.memo(ExternalLinkBase)


// TODO(cyrille): Find a cleaner way to define this.
interface MarkDownParagraphRendererProps extends React.HTMLProps<HTMLDivElement> {
  nodeKey?: string
}

const SingleLineParagraphBase: React.FC<MarkDownParagraphRendererProps> =
({nodeKey: unusedNodeKey, value: unusedValue, ...otherProps}: MarkDownParagraphRendererProps):
React.ReactElement => <div {...otherProps} />
const SingleLineParagraph = React.memo(SingleLineParagraphBase)


interface MarkdownLinkProps extends LinkProps {
  nodeKey?: string
}


const MarkdownLinkBase =
({nodeKey: unusedNodeKey, value: unusedValue, ...linkProps}: MarkdownLinkProps):
React.ReactElement|null => <ExternalLink {...linkProps} />
const MarkdownLink = React.memo(MarkdownLinkBase)


interface MarkdownProps extends Omit<ReactMarkdown['props'], 'source' | 'escapeHtml'> {
  content?: string
  isSingleLine?: boolean
  style?: React.CSSProperties
}


const MarkdownBase: React.FC<MarkdownProps> = (props: MarkdownProps): React.ReactElement|null => {
  const {content, isSingleLine, renderers, ...extraProps} = props
  if (!content) {
    return null
  }
  return <ReactMarkdown
    source={content} escapeHtml={true}
    renderers={{
      link: MarkdownLink,
      ...isSingleLine ? {paragraph: SingleLineParagraph} : {},
      ...renderers}}
    {...extraProps} />
}
MarkdownBase.propTypes = {
  content: PropTypes.string,
  isSingleLine: PropTypes.bool,
  renderers: PropTypes.object,
}
const Markdown = React.memo(MarkdownBase)


interface CircularProgressProps {
  periodMilliseconds?: number
  size?: number
  style?: React.CSSProperties
  thickness?: number
}


const CircularProgressBase = (props: CircularProgressProps): React.ReactElement => {
  const {periodMilliseconds = 1750, size = 80, style, thickness = 3.5} = props
  const [isWrapperRotated, setIsWrappedRotated] = useState(false)
  const [scalePath, setScalePath] = useState(0)

  useEffect((): (() => void) => {
    const timeout = window.setTimeout(
      (): void => setScalePath((scalePath + 1) % 3),
      scalePath ? .4 * periodMilliseconds : .2 * periodMilliseconds,
    )
    return (): void => clearTimeout(timeout)
  }, [periodMilliseconds, scalePath])

  useEffect((): (() => void) => {
    const timeout = setTimeout(
      (): void => setIsWrappedRotated(!isWrapperRotated),
      isWrapperRotated ? periodMilliseconds * 5.7143 : 50,
    )
    return (): void => clearTimeout(timeout)
  }, [isWrapperRotated, periodMilliseconds])

  const containerStyle: React.CSSProperties = {
    color: colors.BOB_BLUE,
    height: size,
    marginLeft: 'auto',
    marginRight: 'auto',
    position: 'relative',
    width: size,
    ...style,
  }
  const color = containerStyle.color
  const wrapperStyle: React.CSSProperties = {
    display: 'inline-block',
    height: size,
    transform: `rotate(${isWrapperRotated ? '1800' : '0'}deg)`,
    transition: `all ${isWrapperRotated ? '10' : '0'}s linear`,
    width: size,
  }
  const getArcLength = (fraction: number): number => fraction * Math.PI * (size - thickness)
  let strokeDasharray, strokeDashoffset, transitionDuration
  if (scalePath === 0) {
    strokeDasharray = `${getArcLength(0)}, ${getArcLength(1)}`
    strokeDashoffset = 0
    transitionDuration = '0'
  } else if (scalePath === 1) {
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

  return <div style={containerStyle}>
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
CircularProgressBase.propTypes = {
  periodMilliseconds: PropTypes.number,
  size: PropTypes.number,
  style: PropTypes.object,
  thickness: PropTypes.number,
}
const CircularProgress = React.memo(CircularProgressBase)


interface MultiSizeImageDef {
  src: string
  images: readonly {
    path: string
  }[]
}


// Function to use smaller version of image on mobile in css.
// Uses responsive-loader format, so image must be imported as
// 'myImage.jpg?multi&sizes[]=<fullSize>&sizes[]=<mobileSize>'
function chooseImageVersion(responsiveImage: MultiSizeImageDef, isMobileVersion: boolean): string {
  return !isMobileVersion ? responsiveImage.src :
    responsiveImage.images[1] ?
      responsiveImage.images[1].path :
      responsiveImage.src
}


interface MultiSizeImageProps {
  alt: string
  sizes: readonly {
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
const MultiSizeImageBase = (props: MultiSizeImageProps): React.ReactElement => {
  const {alt, srcs, sizes, ...otherProps} = props
  const width = srcs.width

  const sizesProp = useMemo((): string => {
    if (!sizes || !sizes.length) {
      return (width + '') || ''
    }
    function sizeRow(size: {mediaCondition?: string; width: string}): string {
      const {mediaCondition, width} = size
      return mediaCondition ? `${mediaCondition} ${width}` : width
    }
    return sizes.map(sizeRow).join(', ')
  }, [sizes, width])
  return <img alt={alt} src={srcs.src} srcSet={srcs.srcSet} sizes={sizesProp} {...otherProps} />
}
MultiSizeImageBase.propTypes = {
  alt: PropTypes.string.isRequired,
  sizes: PropTypes.arrayOf(PropTypes.shape({
    mediaCondition: PropTypes.string,
    width: PropTypes.string.isRequired,
  }).isRequired),
  srcs: PropTypes.shape({
    src: PropTypes.string.isRequired,
    srcSet: PropTypes.string,
    width: PropTypes.number,
  }).isRequired,
}
const MultiSizeImage = React.memo(MultiSizeImageBase)


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


const coverAll: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}


const JobGroupCoverImageBase: React.FC<JobGroupCoverImageProps> = (props: JobGroupCoverImageProps):
React.ReactElement => {
  const {blur, coverOpacity = .4, grayScale, opaqueCoverColor = '#000',
    opaqueCoverGradient, romeId, style} = props
  const url = (isMobileVersion ? config.jobGroupImageSmallUrl : config.jobGroupImageUrl).
    replace('ROME_ID', romeId)
  const filters = useMemo((): readonly string[] => {
    const filters: string[] = []
    if (blur) {
      filters.push(`blur(${blur}px)`)
    }
    if (grayScale) {
      filters.push(`grayscale(${grayScale}%)`)
    }
    return filters
  }, [blur, grayScale])
  const coverImageStyle = useMemo((): React.CSSProperties => ({
    ...coverAll,
    backgroundImage: url ? `url("${url}")` : 'inherit',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    zIndex: -2,
    ...(filters.length ? Styles.VENDOR_PREFIXED('filter', filters.join(' ')) : undefined),
  }), [filters, url])
  const containerStyle = useMemo((): React.CSSProperties => ({
    ...coverAll,
    ...style,
    ...(blur ? {overflow: 'hidden'} : undefined),
  }), [blur, style])
  const opaqueCoverStyle = useMemo((): React.CSSProperties => {
    const additionalStyle: React.CSSProperties = {}
    if (opaqueCoverGradient) {
      const gradientParts = ['104deg', opaqueCoverGradient.left]
      if (opaqueCoverGradient.middle) {
        gradientParts.push(opaqueCoverGradient.middle)
      }
      gradientParts.push(opaqueCoverGradient.right)
      additionalStyle.background = `linear-gradient(${gradientParts.join(', ')})`
    }
    return {
      ...coverAll,
      backgroundColor: opaqueCoverColor,
      opacity: coverOpacity,
      zIndex: -1,
      ...additionalStyle,
    }
  }, [coverOpacity, opaqueCoverColor, opaqueCoverGradient])
  return <div style={containerStyle}>
    {url ? <div style={coverImageStyle} /> : null}
    <div style={opaqueCoverStyle} />
  </div>
}
JobGroupCoverImageBase.propTypes = {
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
const JobGroupCoverImage = React.memo(JobGroupCoverImageBase)


interface WrappedInputProps {
  isDisabled?: boolean
  isHovered?: boolean
  onBlur?: () => void
  onClick?: (event?: React.SyntheticEvent<HTMLDivElement>) => void
  onFocus?: () => void
  onKeyPress?: (event?: React.KeyboardEvent<HTMLDivElement>) => void
  tabIndex?: number
}


interface WrappedInputInnerProps extends Omit<WrappedInputProps, 'isDisabled'|'isHovered'> {
  isHighlighted: boolean
}


function useWrappedInput(props: WrappedInputProps): WrappedInputInnerProps {
  const {
    isDisabled,
    isHovered,
    onBlur,
    onClick,
    onFocus,
    onKeyPress,
    tabIndex = 0,
  } = props
  const [isFocused, setIsFocused] = useState(false)

  const handleBlur = useCallback((): void => {
    setIsFocused(false)
    onBlur?.()
  }, [onBlur])

  const handleFocus = useCallback((): void => {
    setIsFocused(true)
    onFocus?.()
  }, [onFocus])

  const handleClick = useCallback((event?: React.SyntheticEvent<HTMLDivElement>): void => {
    handleFocus()
    onClick?.(event)
  }, [handleFocus, onClick])

  const handleKeyPress = useCallback((event?: React.KeyboardEvent<HTMLDivElement>): void => {
    if (onClick) {
      onClick(event)
    } else {
      onKeyPress?.(event)
    }
  }, [onClick, onKeyPress])

  return {
    isHighlighted: !isDisabled && (isHovered || isFocused),
    onBlur: handleBlur,
    onClick: isDisabled ? undefined : handleClick,
    onFocus: handleFocus,
    onKeyPress: isDisabled ? undefined : handleKeyPress,
    tabIndex: isDisabled ? undefined : tabIndex,
  }
}


interface WrappedInputConfig extends WrappedInputProps {
  isSelected?: boolean
  size?: number
  style?: React.CSSProperties
}


const RadioButtonBase =
(props: WrappedInputConfig, ref: React.Ref<HTMLDivElement>): React.ReactElement => {
  const {isSelected, size = 20, style} = props
  const {isHighlighted, ...otherProps} = useWrappedInput(props)
  const {onClick} = otherProps

  const outerCircleStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderColor: isHighlighted ? colors.COOL_GREY : colors.PINKISH_GREY,
    borderRadius: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    ...onClick && {cursor: 'pointer'},
    height: size,
    position: 'absolute',
    width: size,
  }
  const innerCircleStyle: React.CSSProperties = {
    backgroundColor: colors.BOB_BLUE,
    borderRadius: '50%',
    height: size / 2,
    left: size / 4 - 1,
    position: 'absolute',
    top: size / 4 - 1,
    width: size / 2,
  }
  const containerStyle: React.CSSProperties = {
    display: 'inline-block',
    height: size,
    position: 'relative',
    width: size,
    ...style,
  }
  return <div style={containerStyle} ref={ref} {...otherProps}>
    <div style={outerCircleStyle}>
      {isSelected ? <div style={innerCircleStyle} /> : null}
    </div>
  </div>
}
const RadioButton = React.memo(React.forwardRef(RadioButtonBase))



const CheckboxBase =
(props: WrappedInputConfig, ref: React.Ref<HTMLDivElement>): React.ReactElement => {
  const {isSelected, size = 20, style} = props
  const {isHighlighted, ...otherProps} = useWrappedInput(props)
  const {onClick} = otherProps

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
    ...onClick && {cursor: 'pointer'},
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
  return <div style={containerStyle} ref={ref} {...otherProps}>
    <div style={outerBoxStyle}>
      {isSelected ? <CheckIcon style={{fill: '#fff', width: 16}} /> : null}
    </div>
  </div>
}
const Checkbox = React.memo(React.forwardRef(CheckboxBase))


// TODO(cyrille): Handle actual swipe.
const SwipeToggleBase =
(props: WrappedInputConfig, ref: React.Ref<HTMLDivElement>): React.ReactElement => {
  const {isSelected, size = 20, style} = props
  const {isHighlighted, ...otherProps} = useWrappedInput(props)
  const {onClick} = otherProps

  const containerStyle = {
    backgroundColor: isSelected ? colors.BOB_BLUE : '#fff',
    border: `1px solid ${isSelected ?
      isHighlighted ? colors.DARK_BLUE : colors.BOB_BLUE :
      isHighlighted ? colors.COOL_GREY : colors.MODAL_PROJECT_GREY}`,
    borderRadius: size,
    ...onClick ? {cursor: 'pointer'} : undefined,
    height: size,
    width: 1.7 * size,
    ...SmoothTransitions,
    ...style,
  }
  const toggleStyle = {
    backgroundColor: '#fff',
    border: containerStyle.border,
    borderRadius: '50%',
    height: size,
    marginLeft: (isSelected ? size * .7 : 0) - 1,
    marginTop: -1,
    width: size,
    ...FastTransitions,
  }
  return <div style={containerStyle} {...otherProps} ref={ref}>
    <div style={toggleStyle} />
  </div>
}
const SwipeToggle = React.memo(React.forwardRef(SwipeToggleBase))


const TOGGLE_INPUTS = {
  checkbox: Checkbox,
  radio: RadioButton,
  swipe: SwipeToggle,
} as const


export interface LabeledToggleProps {
  isDisabled?: boolean
  isSelected?: boolean
  label: React.ReactNode
  onBlur?: () => void
  onClick?: (event?: React.SyntheticEvent<HTMLDivElement>) => void
  onFocus?: () => void
  style?: React.CSSProperties
  type: keyof typeof TOGGLE_INPUTS
}


interface ToggleInputProps extends WrappedInputConfig {
  ref: React.Ref<HTMLDivElement>
}

export interface Focusable {
  focus: () => void
}

const LabeledToggleBase =
(props: LabeledToggleProps, ref: React.Ref<Focusable>): React.ReactElement => {
  const {isDisabled, isSelected, label, onBlur, onClick, onFocus, style, type,
    ...otherProps} = props
  const [isHovered, setIsHovered] = useState(false)

  const onMouseEnter = useCallback((): void => setIsHovered(true), [])
  const onMouseLeave = useCallback((): void => setIsHovered(false), [])

  const toggleRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => {
      toggleRef.current?.focus()
    },
  }))

  const handleClick = useCallback((event?: React.SyntheticEvent<HTMLDivElement>): void => {
    if (onClick) {
      // Prevent the click to be consumed twice.
      event?.stopPropagation()
    }
    toggleRef.current?.focus()
    onClick?.(event)
  }, [onClick])

  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    cursor: isDisabled ? 'initial' : 'pointer',
    display: 'flex',
    listStyle: 'none',
    marginBottom: 7,
    ...style,
  }
  const ToggleInput: React.ComponentType<ToggleInputProps> = TOGGLE_INPUTS[type]
  return <div
    {...otherProps} style={containerStyle}
    onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    onClick={isDisabled ? undefined : handleClick}>
    <ToggleInput
      style={{flex: 'none'}} ref={toggleRef}
      onClick={isDisabled ? undefined : handleClick}
      {...{isDisabled, isHovered, isSelected, onBlur, onFocus}} />
    <span style={{marginLeft: 10}}>
      {label}
    </span>
  </div>
}
const LabeledToggle = React.memo(React.forwardRef(LabeledToggleBase))


interface UpDownIconProps extends MdiReactIconProps {
  icon: 'arrow' | 'chevron' | 'menu'
  isUp?: boolean
}


const UpDownIconBase = (props: UpDownIconProps): React.ReactElement => {
  const {icon, isUp, ...otherProps} = props

  const Icon = useMemo((): React.ComponentType<MdiReactIconProps> => {
    if (icon === 'arrow') {
      return isUp ? ArrowUpIcon : ArrowDownIcon
    }
    if (icon === 'chevron') {
      return isUp ? ChevronUpIcon : ChevronDownIcon
    }
    return isUp ? MenuUpIcon : MenuDownIcon
  }, [icon, isUp])
  return <Icon {...otherProps} />
}
UpDownIconBase.propTypes = {
  icon: PropTypes.oneOf(['arrow', 'chevron', 'menu']).isRequired,
  isUp: PropTypes.bool,
}
const UpDownIcon = React.memo(UpDownIconBase)


interface IconInputProps extends InputProps {
  iconComponent: React.ComponentType<MdiReactIconProps>
  iconStyle?: React.CSSProperties
  inputStyle?: React.CSSProperties
}


const IconInputBase = (props: IconInputProps, ref: React.Ref<Inputable>): React.ReactElement => {
  const {iconComponent, iconStyle, inputStyle, style, ...otherProps} = props
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
      ref={ref}
      style={inputStyle} />
    <div style={iconContainer} onClick={focus}>
      <Icon style={iconStyle} />
    </div>
  </div>
}
const IconInput = React.memo(React.forwardRef(IconInputBase))


interface WithNoteProps {
  children: React.ReactNode
  hasComment?: boolean
  note: React.ReactNode
}


const noteContainerStyle: React.CSSProperties = {display: 'flex', flexDirection: 'column'}
const noteStyleWithoutComment: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 15,
  lineHeight: 1.1,
  marginTop: 8,
}
const noteStyleWithComment: React.CSSProperties = {
  ...noteStyleWithoutComment,
  marginBottom: 20,
}


const WithNoteBase = (props: WithNoteProps): React.ReactElement => {
  const {children, hasComment, note} = props
  const noteStyle = hasComment ? noteStyleWithComment : noteStyleWithoutComment
  return <div style={noteContainerStyle}>
    {children}
    <div style={noteStyle}>
      {note}
    </div>
  </div>
}
WithNoteBase.propTypes = {
  children: PropTypes.node,
  hasComment: PropTypes.bool,
  note: PropTypes.node.isRequired,
}
const WithNote = React.memo(WithNoteBase)


type HTMLInputElementProps = React.HTMLProps<HTMLInputElement>
export interface InputProps
  extends Pick<HTMLInputElementProps, Exclude<keyof HTMLInputElementProps, 'onChange' | 'ref'>> {
  applyFunc?: (inputValue: string) => string
  onChange?: (inputValue: string) => void
  // If this is set to a non-zero value, the components will wait the given amount of time before
  // calling onChange, to avoid calling it for each key pressed. It also calls it on blur events
  // and at unmount.
  onChangeDelayMillisecs?: number
  // If onChangeDelayMillisecs is set, this is called everytime the editable value changes,
  // without waiting for any delay.
  onEdit?: (inputValue: string) => void
  shouldFocusOnMount?: boolean
  value?: string
}


const InputBase = (props: InputProps, ref: React.Ref<Inputable>): React.ReactElement => {
  const {applyFunc, onBlur, onChange, onChangeDelayMillisecs, onEdit, shouldFocusOnMount, style,
    value: propValue, ...otherProps} = props
  const dom = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, (): Inputable => ({
    blur: (): void => dom.current?.blur(),
    focus: (): void => dom.current?.focus(),
    select: (): void => dom.current?.select(),
  }))

  // TODO(cyrille): Check behaviour when isDelayed changes.
  const isDelayed = !!onChangeDelayMillisecs

  const [lastChangedValue, setLastChangedValue] = useState(propValue || '')
  const [stateValue, setStateValue] = useState(propValue || '')

  useEffect((): void => {
    if (!isDelayed) {
      return
    }
    setStateValue(propValue || '')
    setLastChangedValue(propValue || '')
  }, [isDelayed, propValue])

  useEffect((): void => {
    if (shouldFocusOnMount && !isMobileVersion) {
      dom.current?.focus()
    }
  }, [shouldFocusOnMount])

  const submitDelayedChange = useCallback((isFinal: boolean): void => {
    if (!isDelayed || stateValue === lastChangedValue) {
      return
    }
    onChange?.(stateValue)
    if (!isFinal) {
      setLastChangedValue(stateValue)
    }
  }, [isDelayed, lastChangedValue, onChange, stateValue])

  // We use a ref to keep the latest value of submitDelayedChange as we want the last version of it
  // when we unmount while not running it each time it's modified.
  const submitDelayedChangeRef = useRef(submitDelayedChange)
  useEffect((): void => {
    submitDelayedChangeRef.current = submitDelayedChange
  }, [submitDelayedChange])

  // Submit delayed change on unmount.
  useEffect(() => (): void => submitDelayedChangeRef.current?.(true), [])

  // Submit delayed change after a delay except if the stateValue changes again.
  useEffect((): (() => void) => {
    if (!isDelayed) {
      return (): void => void 0
    }
    const timeout = window.setTimeout(
      (): void => submitDelayedChangeRef.current?.(false),
      onChangeDelayMillisecs,
    )
    return (): void => clearTimeout(timeout)
  }, [stateValue, isDelayed, onChangeDelayMillisecs])

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    event.stopPropagation()
    const value = applyFunc ? applyFunc(event.target.value) : event.target.value
    if (isDelayed) {
      setStateValue(value)
      onEdit?.(value)
    } else {
      onChange?.(value)
    }
  }, [applyFunc, onChange, onEdit, isDelayed])

  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>): void => {
    submitDelayedChange(false)
    onBlur?.(event)
  }, [onBlur, submitDelayedChange])

  const inputValue = isDelayed ? stateValue : propValue
  const inputStyle = {
    ...Styles.INPUT,
    ...style,
  }
  return <input
    {...otherProps} style={inputStyle} onChange={handleChange}
    value={inputValue} onBlur={handleBlur} ref={dom} />
}
const Input = React.memo(React.forwardRef(InputBase))


interface PieChartProps {
  backgroundColor?: string
  children?: React.ReactNode
  durationMillisec?: number
  percentage: number
  radius?: number
  strokeWidth?: number
  style?: React.CSSProperties
}


// TODO(cyrille): Use this in transparency page.
const PieChartBase = (props: PieChartProps): React.ReactElement => {
  const {backgroundColor, children, durationMillisec = 1000, percentage, radius = 60,
    strokeWidth = 15, style} = props
  const [hasStartedGrowing, setHasStartedGrowing] = useState(false)

  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])

  // TODO(cyrille): Add default value for style.color, or require it in props.
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    fontSize: 28,
    fontWeight: 'bold',
    height: 2 * radius,
    justifyContent: 'center',
    position: 'relative',
    width: 2 * radius,
    ...style,
  }), [radius, style])
  const currentPercentage = hasStartedGrowing ? percentage : 0
  const innerRadius = radius - strokeWidth / 2
  const perimeter = innerRadius * 2 * Math.PI
  const strokeLength = perimeter * currentPercentage / 100
  return <span style={containerStyle}>
    <VisibilitySensor
      active={!hasStartedGrowing} intervalDelay={250}
      onChange={startGrowing}>
      <svg
        style={{left: 0, position: 'absolute', top: 0}}
        viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}>
        <circle
          r={innerRadius} fill="none" stroke={backgroundColor} strokeWidth={strokeWidth} />
        <circle
          r={innerRadius} fill="none" stroke={style?.color}
          strokeDashoffset={perimeter / 4}
          strokeDasharray={`${strokeLength},${perimeter - strokeLength}`} strokeLinecap="round"
          strokeWidth={strokeWidth} style={{transition: `${durationMillisec}ms`}} />
      </svg>
    </VisibilitySensor>
    {children}
  </span>
}
PieChartBase.propTypes = {
  backgroundColor: PropTypes.string,
  children: PropTypes.node,
  durationMillisec: PropTypes.number,
  percentage: PropTypes.number.isRequired,
  radius: PropTypes.number,
  strokeWidth: PropTypes.number,
  style: PropTypes.object,
}
const PieChart = React.memo(PieChartBase)


interface GrowingNumberConfig {
  durationMillisec?: number
  isSteady?: boolean
  number: number
  style?: React.CSSProperties
}


const GrowingNumberBase: React.FC<GrowingNumberConfig> =
(props: GrowingNumberConfig): React.ReactElement => {
  const {durationMillisec = 1000, isSteady, number, style} = props
  const [growingForMillisec, setGrowingForMillisecs] = useState(0)
  const [hasGrown, setHasGrown] = useState(false)
  const [hasStartedGrowing, setHasStartedGrowing] = useState(false)
  const timeout = useRef<number|undefined>(undefined)
  useEffect((): void|(() => void) => {
    if (!hasStartedGrowing || hasGrown) {
      return
    }
    if (growingForMillisec >= durationMillisec) {
      setHasGrown(true)
      return
    }
    timeout.current = window.setTimeout(
      (): void => setGrowingForMillisecs(growingForMillisec + 50), 50)
    return (): void => clearTimeout(timeout.current)
  }, [durationMillisec, hasGrown, hasStartedGrowing, growingForMillisec])
  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])
  const maxNumDigits = number ? Math.floor(Math.log10(number)) + 1 : 1
  const containerStyle = useMemo((): React.CSSProperties|undefined => isSteady ? {
    display: 'inline-block',
    textAlign: 'right',
    // 0.625 was found empirically.
    width: `${maxNumDigits * 0.625}em`,
    ...style,
  } : style, [isSteady, maxNumDigits, style])
  return <span style={containerStyle}>
    <VisibilitySensor
      active={!hasStartedGrowing} intervalDelay={250} onChange={startGrowing}>
      <span>
        {hasGrown ? number : Math.round(growingForMillisec / durationMillisec * number)}
      </span>
    </VisibilitySensor>
  </span>
}
GrowingNumberBase.propTypes = {
  durationMillisec: PropTypes.number,
  isSteady: PropTypes.bool,
  number: PropTypes.number.isRequired,
  style: PropTypes.object,
}
const GrowingNumber = React.memo(GrowingNumberBase)


// This component avoids that the element touches the border when on mobile.
// For now, we only use is for text, hence a solution that does not require a component would be,
// better, but we didn't find one yet.
const PaddedOnMobileBase = (props: React.HTMLProps<HTMLDivElement>): React.ReactElement => {
  const {style, ...otherProps} = props

  const containerStyle = useMemo((): React.CSSProperties => ({
    ...style,
    padding: isMobileVersion ? '0 20px' : 0,
  }), [style])
  return <div style={containerStyle} {...otherProps} />
}
PaddedOnMobileBase.propTypes = {
  style: PropTypes.object,
}
const PaddedOnMobile = React.memo(PaddedOnMobileBase)


export interface AppearingListProps extends Omit<React.HTMLProps<HTMLDivElement>, 'ref'> {
  children: ReactStylableElement | null | (ReactStylableElement|null)[]
  isAnimationEnabled?: boolean
  maxNumChildren?: number
}


const AppearingListBase = (props: AppearingListProps): React.ReactElement => {
  const {children, isAnimationEnabled = true, maxNumChildren, ...extraProps} = props
  const [isShown, setIsShown] = useState(!isAnimationEnabled)
  const validChildren = React.Children.toArray(children).filter(
    (c): c is ReactStylableElement => !!c,
  )
  const itemStyle = (index: number, style?: RadiumCSSProperties): RadiumCSSProperties => ({
    opacity: isShown ? 1 : 0,
    ...(isAnimationEnabled ? {
      transition: `opacity 300ms ease-in ${index * 700 / validChildren.length}ms`,
    } : undefined),
    ...style,
  })
  const shownChildren = maxNumChildren ? validChildren.slice(0, maxNumChildren) : validChildren
  return <VisibilitySensor
    active={!isShown} intervalDelay={250} partialVisibility={true}
    onChange={setIsShown}>
    <div {...extraProps}>
      {shownChildren.map((item, index): React.ReactNode =>
        React.cloneElement(item, {
          key: item.key || index,
          style: itemStyle(index, item.props.style),
        }))}
    </div>
  </VisibilitySensor>
}
AppearingListBase.PropTypes = {
  children: PropTypes.arrayOf(PropTypes.node.isRequired),
  isAnimationEnabled: PropTypes.bool,
  maxNumChildren: PropTypes.number,
}
const AppearingList = React.memo(AppearingListBase)


interface TagProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

const getTagStyle = (style?: React.CSSProperties): React.CSSProperties => {
  const padding = style?.fontStyle === 'italic' ? '6px 7px 6px 5px' : 6
  return {
    backgroundColor: colors.GREENISH_TEAL,
    borderRadius: 2,
    color: '#fff',
    display: 'inline-block',
    flexShrink: 0,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: .3,
    padding,
    textTransform: 'uppercase',
    ...style,
  }
}

const TagBase: React.FC<TagProps> =
({children, style}): React.ReactElement => {
  const containerStyle = useMemo((): React.CSSProperties => getTagStyle(style), [style])
  return <span style={containerStyle}>
    {children}
  </span>
}
TagBase.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
}
const Tag = React.memo(TagBase)


interface StringJoinerProps {
  children: (React.ReactElement|string)[]|React.ReactElement|string
  lastSeparator?: React.ReactNode
  separator?: React.ReactNode
}


const extractSeparator = _memoize((listString: string): readonly [string, string] => {
  const parts = listString.split(/<\d><\/\d>/)
  if (parts.length !== 4) {
    Sentry.captureMessage?.(`Separators could not be identified in: ${listString}.`)
    return [', ', ' ou ']
  }
  return parts.slice(1, 2) as [string, string]
})


const StringJoinerBase = (props: StringJoinerProps): React.ReactElement => {
  const {t} = useTranslation()
  const [defaultSeparator, defaultLastSeparator] =
    extractSeparator(t('<0></0>, <1></1> ou <2></2>'))
  const {children, lastSeparator = defaultLastSeparator, separator = defaultSeparator} = props
  const parts: React.ReactNode[] = []
  const numChildren = React.Children.count(children)
  React.Children.forEach(children, (child: React.ReactElement|string, index: number): void => {
    if (index) {
      const nextSeparator = (index === numChildren - 1) ? lastSeparator : separator
      parts.push(<span key={`sep-${index}`}>{nextSeparator}</span>)
    }
    parts.push(child)
  })
  return <span>{parts}</span>
}
StringJoinerBase.propTypes = {
  children: PropTypes.arrayOf(PropTypes.node.isRequired),
  lastSeparator: PropTypes.node,
  separator: PropTypes.node,
}
const StringJoiner = React.memo(StringJoinerBase)


interface OutsideClickHandlerProps extends React.HTMLProps<HTMLDivElement> {
  onOutsideClick: () => void
}


// A component to handle when mouse is clicked outside its children.
// All clicks on children won't be handled. All clicks outside will trigger onOutsideClick. You can
// also add other props such as style.
const OutsideClickHandlerBase = (props: OutsideClickHandlerProps): React.ReactElement => {
  const {children, onOutsideClick, ...extraProps} = props

  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent): void => {
    if (event.target && wrapperRef.current?.contains(event.target as Node)) {
      return
    }
    onOutsideClick?.()
  }, [onOutsideClick])

  useEffect((): (() => void) => {
    document.addEventListener('mousedown', handleClickOutside)
    return (): void => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  return <div ref={wrapperRef} {...extraProps}>
    {children}
  </div>
}
OutsideClickHandlerBase.propTypes = {
  children: PropTypes.element.isRequired,
  onOutsideClick: PropTypes.func.isRequired,
}
const OutsideClickHandler = React.memo(OutsideClickHandlerBase)


interface PercentBarProps {
  color: string
  height?: number
  isPercentShown?: boolean
  percent?: number
  style?: React.CSSProperties
}


const PercentBarBase = (props: PercentBarProps): React.ReactElement => {
  const {color, height = 25, percent = 0, isPercentShown = true, style} = props

  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.MODAL_PROJECT_GREY,
    borderRadius: 25,
    height: height,
    overflow: 'hidden',
    width: '100%',
    ...style,
  }), [height, style])
  const percentStyle = useMemo((): React.CSSProperties => ({
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
    ...SmoothTransitions,
  }), [color, height, isPercentShown, percent])
  return <div style={containerStyle}>
    {percent ? <div style={percentStyle}>
      {isPercentShown ? `${Math.round(percent)}%` : ''}
    </div> : null}
  </div>
}
PercentBarBase.propTypes = {
  color: PropTypes.string.isRequired,
  height: PropTypes.number,
  isPercentShown: PropTypes.bool,
  percent: PropTypes.number,
  style: PropTypes.object,
}
const PercentBar = React.memo(PercentBarBase)


interface CarouselArrowProps {
  chevronSize?: number
  handleClick: () => void
  isLeft?: boolean
  isVisible?: boolean
  style?: React.CSSProperties
}


// TODO(sil): Find a way to refactor carousels. There are too many custom ones.
const CarouselArrowBase = (props: CarouselArrowProps): React.ReactElement => {
  const {chevronSize, handleClick, isLeft, isVisible, style} = props
  const chevronContainerStyle = useMemo((): React.CSSProperties => ({
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
  }), [isVisible, style])
  return <div
    style={chevronContainerStyle}
    onClick={handleClick}>
    {isLeft ? <ChevronLeftIcon color="#fff" size={chevronSize} /> :
      <ChevronRightIcon color="#fff" size={chevronSize} />}
  </div>
}
CarouselArrowBase.propTypes = {
  chevronSize: PropTypes.number,
  handleClick: PropTypes.func.isRequired,
  isLeft: PropTypes.bool,
  isVisible: PropTypes.bool,
  style: PropTypes.object,
}
const CarouselArrow = React.memo(CarouselArrowBase)


type HTMLTextAreaProps = React.HTMLProps<HTMLTextAreaElement>
interface TextareaProps
  extends Pick<HTMLTextAreaProps, Exclude<keyof HTMLTextAreaProps, 'onChange' | 'ref'>> {
  onChange?: (inputValue: string) => void
}


export interface Inputable {
  blur: () => void
  focus: () => void
  select: () => void
}


const TextareaBase = (props: TextareaProps, ref: React.Ref<Inputable>): React.ReactElement => {
  const {onChange, ...otherProps} = props

  const dom = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, (): Inputable => ({
    blur: (): void => dom.current?.blur(),
    focus: (): void => dom.current?.focus(),
    select: (): void => dom.current?.select(),
  }))

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation()
    onChange?.(event.target.value || '')
  }, [onChange])

  return <textarea {...otherProps} onChange={onChange && handleChange} ref={dom} />
}
const Textarea = React.memo(React.forwardRef(TextareaBase))


const ColoredBulletBase = (props: {color: string}): React.ReactElement => {
  const bulletStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: props.color,
    borderRadius: '50%',
    height: 10,
    margin: '0 20px 0 5px',
    width: 10,
  }), [props.color])
  return <div style={bulletStyle} />
}
ColoredBulletBase.propTypes = {
  color: PropTypes.string.isRequired,
}
const ColoredBullet = React.memo(ColoredBulletBase)


interface VideoFrameProps {
  aspectRatio?: number
  children: React.ReactElement<{
    height: string
    style: RadiumCSSProperties
    width: string
  }>
  style?: React.CSSProperties
}


const coverallStyle: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
} as const


// A nice way to have 16/9 video iframes.
const VideoFrameBase = (props: VideoFrameProps): React.ReactElement => {
  const {aspectRatio = 16 / 9, children, style} = props
  const childrenStyle = useMemo((): React.CSSProperties => ({
    ...children.props.style,
    ...coverallStyle,
  }), [children.props.style])
  const containerStyle = useMemo((): React.CSSProperties => ({
    height: 0, paddingBottom: `${100 / aspectRatio}%`, position: 'relative',
  }), [aspectRatio])
  return <div style={style}>
    <div style={containerStyle}>
      {React.cloneElement(children, {
        height: '100%',
        style: childrenStyle,
        width: '100%',
      })}
    </div>
  </div>
}
VideoFrameBase.propTypes = {
  // Desired width/height ratio for the frame.
  aspectRatio: PropTypes.number,
  children: PropTypes.element.isRequired,
  style: PropTypes.object,
}
const VideoFrame = React.memo(VideoFrameBase)


const missingImages: Set<string> = new Set([])


interface ImgProps
  extends React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> {
  fallbackSrc?: string
}


const ImgBase = (props: ImgProps): React.ReactElement => {
  const {alt, fallbackSrc, ...otherProps} = props
  const [hasErred, setHasErred] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)

  const handleError = useCallback((): void => {
    if (!hasErred && imgRef.current) {
      const src = imgRef.current.src
      if (!missingImages.has(src)) {
        Sentry.captureMessage?.(`Image source is no longer available: ${src}.`) &&
          missingImages.add(src)
      }
      if (fallbackSrc) {
        imgRef.current.src = fallbackSrc
      }
      setHasErred(true)
    }
  }, [fallbackSrc, hasErred])

  return <img ref={imgRef} {...otherProps} alt={alt} onError={handleError} />
}
ImgBase.propTypes = {
  alt: PropTypes.string.isRequired,
  fallbackSrc: PropTypes.string,
}
const Img = React.memo(ImgBase)


interface CircleProps {
  color: string
  durationMillisec?: number
  halfAngleDeg?: number
  isAnimated?: boolean
  isCaptionShown?: boolean
  isPercentShown?: boolean
  percent: number
  radius?: number
  scoreSize?: number
  startColor?: string
  strokeWidth?: number
  style?: React.CSSProperties & {
    margin?: never
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    marginTop?: number
  }
}


const innerTextStyle: React.CSSProperties = {
  fontWeight: 'bold',
  left: 0,
  position: 'absolute',
  right: 0,
}
const bobScoreCaptionStyle: React.CSSProperties = {
  ...innerTextStyle,
  bottom: 0,
  color: colors.COOL_GREY,
  fontSize: 10,
  fontStyle: 'italic',
  margin: 'auto',
  maxWidth: 100,
  textAlign: 'center',
  textTransform: 'uppercase',
}


const BobScoreCircleBase = (props: CircleProps): React.ReactElement => {
  const {
    color,
    durationMillisec = 1000,
    halfAngleDeg = 60,
    isAnimated = true,
    isCaptionShown = true,
    isPercentShown = true,
    percent,
    radius = 78.6,
    scoreSize = 31,
    startColor = colors.RED_PINK,
    strokeWidth = 4.3,
    style,
    ...extraProps
  } = props
  const [hasStartedGrowing, setHasStartedGrowing] = useState(!isAnimated)
  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])

  // Gives the point on the Bob score circle according to clockwise angle with origin at the bottom.
  const getPointFromAngle = useCallback((rad: number): {x: number; y: number} => {
    const x = -radius * Math.sin(rad)
    const y = radius * Math.cos(rad)
    return {x, y}
  }, [radius])

  const describeSvgArc = useCallback((startAngle: number, endAngle: number): string => {
    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1'
    const start = getPointFromAngle(startAngle)
    const end = getPointFromAngle(endAngle)
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
  }, [getPointFromAngle, radius])

  const startAngle = halfAngleDeg * Math.PI / 180
  const endAngle = 2 * Math.PI - startAngle
  const percentAngle = 2 * (Math.PI - startAngle) * percent / 100 + startAngle

  const largeRadius = radius + 3 * strokeWidth
  const totalWidth = 2 * largeRadius
  const totalHeight = largeRadius + strokeWidth + getPointFromAngle(startAngle).y

  const arcLength = radius * (percentAngle - startAngle)
  const percentPath = describeSvgArc(startAngle, percentAngle)
  const fullPath = describeSvgArc(startAngle, endAngle)
  const containerStyle = useMemo((): React.CSSProperties => ({
    height: totalHeight,
    position: 'relative',
    width: totalWidth,
    ...style,
    marginBottom: (style?.marginBottom || 0) - strokeWidth,
    marginLeft: (style?.marginLeft || 0) + 20 - strokeWidth,
    marginRight: (style?.marginRight || 0) + 20 - strokeWidth,
    marginTop: (style?.marginTop || 0) - 3 * strokeWidth,
  }), [style, strokeWidth, totalHeight, totalWidth])
  const percentStyle = useMemo((): React.CSSProperties => ({
    ...innerTextStyle,
    display: 'flex',
    fontSize: scoreSize,
    justifyContent: 'center',
    lineHeight: '37px',
    marginRight: 'auto',
    top: largeRadius, // center in circle, not in svg
    transform: 'translate(0, -80%)',
  }), [largeRadius, scoreSize])
  const percentColor = !hasStartedGrowing ? startColor : color
  const transitionStyle: React.CSSProperties = {
    transition: `stroke ${durationMillisec}ms linear,
      stroke-dashoffset ${durationMillisec}ms linear`,
  }
  return <VisibilitySensor
    active={!hasStartedGrowing} intervalDelay={250} partialVisibility={true}
    onChange={startGrowing}>
    <div {...extraProps} style={containerStyle}>
      {isPercentShown ? <div style={percentStyle}>
        {isAnimated ?
          <GrowingNumber
            durationMillisec={durationMillisec} number={percent} isSteady={true} /> :
          percent
        }%</div> : null}
      {isCaptionShown ?
        <Trans style={bobScoreCaptionStyle}>score d'employabilité</Trans> : null}
      <svg
        fill="none"
        viewBox={`${-largeRadius} ${-largeRadius} ${totalWidth} ${totalHeight}`}>
        <g strokeLinecap="round">
          <path
            d={fullPath} stroke={colorToAlpha(colors.SILVER, .3)} strokeWidth={2 * strokeWidth} />
          <path
            style={transitionStyle}
            d={percentPath}
            stroke={percentColor}
            strokeDasharray={`${arcLength}, ${2 * arcLength}`}
            strokeDashoffset={hasStartedGrowing ? 0 : arcLength}
            strokeWidth={2 * strokeWidth}
          />
          <path
            d={percentPath}
            style={transitionStyle}
            stroke={percentColor}
            strokeDasharray={`0, ${arcLength}`}
            strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
            strokeWidth={6 * strokeWidth} />
          <path
            d={percentPath}
            stroke="#fff"
            style={transitionStyle}
            strokeDasharray={`0, ${arcLength}`}
            strokeDashoffset={hasStartedGrowing ? -arcLength + 1 : 0}
            strokeWidth={2 * strokeWidth} />
        </g>
      </svg>
    </div>
  </VisibilitySensor>
}
BobScoreCircleBase.propTypes = {
  color: PropTypes.string,
  durationMillisec: PropTypes.number,
  halfAngleDeg: PropTypes.number,
  // TODO(cyrille): Fix the non-animated version.
  isAnimated: PropTypes.bool,
  isCaptionShown: PropTypes.bool,
  isPercentShown: PropTypes.bool,
  percent: PropTypes.number,
  radius: PropTypes.number,
  scoreSize: PropTypes.number,
  startColor: PropTypes.string,
  strokeWidth: PropTypes.number,
  style: PropTypes.object,
}
const BobScoreCircle = React.memo(BobScoreCircleBase)


interface ValuedLabeledToggleProps<T> extends Omit<LabeledToggleProps, 'onClick'|'onFocus'> {
  index: number
  onClick?: (value: T) => void
  onFocus?: (index: number) => void
  value: T
}


const ValuedLabeledToggleBase = <T extends {}>(
  props: ValuedLabeledToggleProps<T>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {index, onClick, onFocus, value, ...otherProps} = props
  const handleClick = useCallback((): void => {
    onClick?.(value)
  }, [onClick, value])
  const handleFocus = useCallback((): void => {
    onFocus?.(index)
  }, [onFocus, index])
  return <LabeledToggle
    {...otherProps} ref={ref} onClick={onClick && handleClick} onFocus={onFocus && handleFocus} />
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
const ValuedLabeledToggle = React.memo(React.forwardRef(ValuedLabeledToggleBase)) as <T>(
  props: ValuedLabeledToggleProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement


interface RadioGroupProps<T> {
  childStyle?: React.CSSProperties
  onChange: (value: T) => void
  options: readonly {
    name: React.ReactNode
    value: T
  }[]
  style?: React.CSSProperties
  value?: T
}


const RadioGroupBase =
<T extends {}>(props: RadioGroupProps<T>, ref: React.Ref<Focusable>): React.ReactElement => {
  const {childStyle, onChange, options, style, value} = props
  const [focusIndex, setFocusIndex] = useState(-1)

  const optionsRef = useRef<readonly React.RefObject<Focusable>[] | undefined>()
  if (!optionsRef.current || optionsRef.current.length !== options.length) {
    optionsRef.current = new Array(options.length).fill(undefined).
      map((): React.RefObject<Focusable> => React.createRef())
  }

  const focusOn = useCallback((focusIndex: number): void => {
    if (!optionsRef.current) {
      return
    }
    optionsRef.current?.[focusIndex]?.current?.focus()
  }, [])

  const focusOnOther = useCallback((delta: number): void => {
    if (focusIndex === -1) {
      return
    }
    focusOn(focusIndex + delta)
  }, [focusIndex, focusOn])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    const {keyCode} = event
    // Left or Up.
    if (keyCode === 37 || keyCode === 38) {
      focusOnOther(-1)
    }
    // Right or Down.
    if (keyCode === 39 || keyCode === 40) {
      focusOnOther(1)
    }
  }, [focusOnOther])

  const clearFocus = useCallback((): void => setFocusIndex(-1), [])

  const focus = useCallback((): void => focusOn(0), [focusOn])
  useImperativeHandle(ref, (): Focusable => ({focus}))

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    ...style,
  }
  return <div style={containerStyle} onKeyDown={handleKeyDown}>
    {options.map((option, index): React.ReactNode => {
      return <ValuedLabeledToggle<T>
        key={option.value + ''} label={option.name} type="radio" style={childStyle}
        ref={optionsRef.current?.[index]} value={option.value} index={index}
        isSelected={option.value === value}
        onClick={onChange}
        onFocus={setFocusIndex}
        onBlur={index === focusIndex ? clearFocus : undefined} />
    })}
  </div>
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
const RadioGroup = React.memo(React.forwardRef(RadioGroupBase)) as <T>(
  props: RadioGroupProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement


interface DataSourceConfig {
  children: React.ReactNode
  isStarShown?: boolean
  style?: React.CSSProperties
}

const DataSourceBase: React.FC<DataSourceConfig> =
(props: DataSourceConfig): React.ReactElement => {
  const {children, isStarShown, style} = props
  const sourceStyle = {
    color: colors.COOL_GREY,
    fontSize: 13,
    fontStyle: 'italic',
    margin: '15px 0',
    ...style,
  }
  const {t} = useTranslation()
  return <PaddedOnMobile style={sourceStyle}>
    {isStarShown ? '*' : ''}{t('Source\u00A0:')} {children}
  </PaddedOnMobile>
}
DataSourceBase.propTypes = {
  children: PropTypes.node,
  isStarShown: PropTypes.bool.isRequired,
  style: PropTypes.object,
}
DataSourceBase.defaultProps = {
  isStarShown: true,
}
const DataSource = React.memo(DataSourceBase)


export {
  Markdown, LabeledToggle, Tag, PercentBar, Button, IconInput, WithNote, Input, ExternalLink,
  JobGroupCoverImage, PieChart, OutsideClickHandler, GrowingNumber, PaddedOnMobile, AppearingList,
  CircularProgress, StringJoiner, Checkbox, UpDownIcon, chooseImageVersion, MultiSizeImage,
  CarouselArrow, Textarea, ColoredBullet, VideoFrame, Img, BobScoreCircle, RadioGroup, SwipeToggle,
  DataSource, RadioButton,
}
