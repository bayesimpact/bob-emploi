// Module mimicking the simplest options of Radium.
// https://github.com/FormidableLabs/radium
// but without the extra complexity which makes it hard to use with HOC.
//
// Features:
//  - follow state of child (focused, hovered) and apply meta styles ':focus', ':hover', ':active'.
// Missing feature:
//  - unset ':active' state in some cases (e.g. when the callback of onClick changes the focus).
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useRef, useState} from 'react'
import {Link, LinkProps} from 'react-router-dom'


interface RadiumConfig<HTMLElement> {
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
  onKeyUp?: (event: React.KeyboardEvent<HTMLElement>) => void
  onMouseDown?: (event: React.MouseEvent<HTMLElement>) => void
  onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void
  onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void
  style?: RadiumCSSProperties
}


interface RadiumProps<HTMLElement> extends Omit<React.HTMLProps<HTMLElement>, 'ref'> {
  style?: RadiumCSSProperties
}


type SimpleCSSProperties = React.CSSProperties & {
  ':active'?: never
  ':hover'?: never
  ':focus'?: never
}


type RadiumState = {
  isActive: boolean
  isFocused: boolean
  isHovered: boolean
}


function useRadium<T, P extends RadiumConfig<T> = RadiumProps<T>>(props: P): [
  Omit<P, keyof RadiumConfig<T>> & Omit<RadiumConfig<T>, 'style'> & {style?: SimpleCSSProperties},
  RadiumState
] {
  const {
    onBlur, onFocus,
    onKeyDown, onKeyUp,
    onMouseDown, onMouseEnter, onMouseLeave,
    style,
    ...otherProps
  } = props
  const styleProvider = useMemo((): ((
    isFocused: boolean, isHovered: boolean, isActive: boolean,
  ) => SimpleCSSProperties|undefined) => _memoize(
    (isFocused: boolean, isHovered: boolean, isActive: boolean): SimpleCSSProperties|undefined => {
      if (!style) {
        return style
      }
      if (!style[':hover'] && !style[':focus'] && !style[':active']) {
        return style as SimpleCSSProperties
      }
      const {
        ':active': activeStyle,
        ':hover': hoverStyle,
        ':focus': focusStyle,
        ...otherStyle
      } = style
      if (!isActive && !isFocused && !isHovered) {
        return otherStyle
      }
      return {
        ...otherStyle,
        ...isFocused ? focusStyle : {},
        ...isHovered ? hoverStyle : {},
        ...isActive ? activeStyle : {},
      }
    },
    (isFocused: boolean, isHovered: boolean, isActive: boolean): string =>
      `${isFocused}-${isHovered}-${isActive}`,
  ), [style])
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const listener = useRef<(ev: MouseEvent) => void|undefined>()
  const setInactive = useCallback((): void => {
    setIsActive(false)
    if (listener.current) {
      window.removeEventListener('mouseup', listener.current)
    }
  }, [])
  listener.current = setInactive
  const finalStyle = styleProvider(isFocused, isHovered, isActive)
  const wrappedOnBlur = useCallback((event: React.FocusEvent<T>): void => {
    setIsFocused(false)
    onBlur?.(event)
  }, [onBlur])
  const wrappedOnFocus = useCallback((event: React.FocusEvent<T>): void => {
    setIsFocused(true)
    onFocus?.(event)
  }, [onFocus])
  const wrappedOnKeyDown = useCallback((event: React.KeyboardEvent<T>): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      setIsActive(true)
    }
    onKeyDown?.(event)
  }, [onKeyDown])
  const wrappedOnKeyUp = useCallback((event: React.KeyboardEvent<T>): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      setIsActive(false)
    }
    onKeyUp?.(event)
  }, [onKeyUp])
  const wrappedOnMouseDown = useCallback((event: React.MouseEvent<T>): void => {
    setIsActive(true)
    onMouseDown?.(event)
    window.addEventListener('mouseup', setInactive)
  }, [onMouseDown, setInactive])
  const wrappedOnMouseEnter = useCallback((event: React.MouseEvent<T>): void => {
    setIsHovered(true)
    onMouseEnter?.(event)
  }, [onMouseEnter])
  const wrappedOnMouseLeave = useCallback((event: React.MouseEvent<T>): void => {
    setIsHovered(false)
    onMouseLeave?.(event)
  }, [onMouseLeave])
  return [{
    onBlur: wrappedOnBlur,
    onFocus: wrappedOnFocus,
    onKeyDown: wrappedOnKeyDown,
    onKeyUp: wrappedOnKeyUp,
    onMouseDown: wrappedOnMouseDown,
    onMouseEnter: wrappedOnMouseEnter,
    onMouseLeave: wrappedOnMouseLeave,
    style: finalStyle,
    ...otherProps,
  }, {isActive, isFocused, isHovered}]
}


interface RadiumLinkProps extends LinkProps {
  style?: RadiumCSSProperties
}


const RadiumLinkBase = (props: RadiumLinkProps): React.ReactElement => {
  const [radiumProps] = useRadium<HTMLAnchorElement, RadiumLinkProps>(props)
  return <Link {...radiumProps} />
}
const RadiumLink = React.memo(RadiumLinkBase)


const RadiumExternalLinkBase = (props: RadiumProps<HTMLAnchorElement>):
React.ReactElement => {
  const [radiumProps] = useRadium<HTMLAnchorElement>(props)
  return <a {...radiumProps} rel="noopener noreferrer" target="_blank" />
}
const RadiumExternalLink = React.memo(RadiumExternalLinkBase)


const RadiumDivBase = (props: React.HTMLProps<HTMLDivElement>): React.ReactElement =>
  <div {...useRadium<HTMLDivElement>(props)[0]} />
const RadiumDiv = React.memo(RadiumDivBase)


const RadiumSpanBase = (props: React.HTMLProps<HTMLSpanElement>): React.ReactElement =>
  <span {...useRadium<HTMLSpanElement>(props)[0]} />
const RadiumSpan = React.memo(RadiumSpanBase)


type SmartLinkProps =
  | RadiumProps<HTMLSpanElement>
  | RadiumProps<HTMLAnchorElement>
  | RadiumLinkProps

// TODO(cyrille): Use wherever applicable.
const SmartLinkBase: React.FC<SmartLinkProps> =
({style, ...props}: SmartLinkProps): React.ReactElement => {
  const linkStyle: RadiumCSSProperties = {
    color: 'inherit',
    cursor: 'pointer',
    textDecoration: 'none',
    ...style,
  }
  const {to, ...otherLinkProps} = props as LinkProps
  if (to) {
    return <RadiumLink to={to} {...otherLinkProps} style={linkStyle} />
  }
  const {href, ...otherAnchorProps} = props as RadiumProps<HTMLAnchorElement>
  if (href) {
    return <RadiumExternalLink href={href} {...otherAnchorProps} style={linkStyle} />
  }
  return <RadiumSpan {...props} style={linkStyle} />
}
SmartLinkBase.propTypes = {
  href: PropTypes.string,
  style: PropTypes.object,
  to: PropTypes.string,
}
const SmartLink = React.memo(SmartLinkBase)


export {SmartLink, RadiumDiv, RadiumExternalLink, RadiumLink, RadiumSpan, useRadium}
