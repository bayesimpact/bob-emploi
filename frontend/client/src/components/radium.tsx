// Module mimicking the simplest options of Radium.
// https://github.com/FormidableLabs/radium
// but without the extra complexity which makes it hard to use with HOC.
//
// Features:
//  - follow state of child (focused, hovered) and apply meta styles ':focus', ':hover', ':active'.
// Missing feature:
//  - unset ':active' state in some cases (e.g. when the callback of onClick changes the focus).
import _memoize from 'lodash/memoize'
import React, {useCallback, useDebugValue, useMemo, useRef, useState} from 'react'
import type {LinkProps} from 'react-router-dom'
import {Link} from 'react-router-dom'


interface HoverProps<HTMLElement> {
  isHovered?: boolean
  onMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void
  onMouseLeave?: (event: React.MouseEvent<HTMLElement>) => void
}


const useHover = <T extends Element>(props?: HoverProps<T>): Required<HoverProps<T>> => {
  const {isHovered: isParentHovered, onMouseEnter, onMouseLeave} = props || {}
  const [isHovered, setIsHovered] = useState(false)
  useDebugValue(isHovered ? ':hover' : 'not :hover')
  const wrappedOnMouseEnter = useCallback((event: React.MouseEvent<T>): void => {
    setIsHovered(true)
    onMouseEnter?.(event)
  }, [onMouseEnter])
  const wrappedOnMouseLeave = useCallback((event: React.MouseEvent<T>): void => {
    setIsHovered(false)
    onMouseLeave?.(event)
  }, [onMouseLeave])
  return {
    isHovered: isHovered || !!isParentHovered,
    onMouseEnter: wrappedOnMouseEnter,
    onMouseLeave: wrappedOnMouseLeave,
  }
}


interface FocusProps<HTMLElement> {
  isFocused?: boolean
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
}


const useFocus = <T extends Element>(props?: FocusProps<T>): Required<FocusProps<T>> => {
  const {isFocused: isParentFocused, onBlur, onFocus} = props || {}
  const [isFocused, setIsFocused] = useState(false)
  useDebugValue(isFocused ? ':focus' : 'not :focus')
  const wrappedOnBlur = useCallback((event: React.FocusEvent<T>): void => {
    setIsFocused(false)
    onBlur?.(event)
  }, [onBlur])
  const wrappedOnFocus = useCallback((event: React.FocusEvent<T>): void => {
    setIsFocused(true)
    onFocus?.(event)
  }, [onFocus])
  return {
    isFocused: isFocused || !!isParentFocused,
    onBlur: wrappedOnBlur,
    onFocus: wrappedOnFocus,
  }
}


export type HoverAndFocusProps<T> = HoverProps<T> & FocusProps<T>


const useHoverAndFocus = <T extends Element>(props?: HoverAndFocusProps<T>):
Required<HoverAndFocusProps<T>> => {
  const {isFocused, isHovered, onBlur, onFocus, onMouseEnter, onMouseLeave} = props || {}
  return {
    ...useFocus({isFocused, onBlur, onFocus}),
    ...useHover({isHovered, onMouseEnter, onMouseLeave}),
  }
}


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


function useRadium<T extends Element, P extends RadiumConfig<T> = RadiumProps<T>>(props: P): [
  Omit<P, 'style'|'onKeyDown'|'onKeyUp'|'onMouseDown'> &
  Required<Pick<RadiumConfig<T>, 'onKeyDown'|'onKeyUp'|'onMouseDown'>> &
  Required<Omit<HoverAndFocusProps<T>, 'isFocused'|'isHovered'>> &
  {style?: SimpleCSSProperties},
  RadiumState
] {
  const {
    onKeyDown, onKeyUp,
    onMouseDown,
    style,
    ...otherProps
  } = props
  const {
    isFocused, isHovered,
    ...handlers
  } = useHoverAndFocus<T>(otherProps)
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
  const [isActive, setIsActive] = useState(false)
  useDebugValue(isActive ? ':active' : 'not :active')
  const listener = useRef<(ev: MouseEvent) => void|undefined>()
  const setInactive = useCallback((): void => {
    setIsActive(false)
    if (listener.current) {
      window.removeEventListener('mouseup', listener.current)
    }
  }, [])
  listener.current = setInactive
  const finalStyle = styleProvider(isFocused, isHovered, isActive)
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
  return [{
    ...otherProps,
    onKeyDown: wrappedOnKeyDown,
    onKeyUp: wrappedOnKeyUp,
    onMouseDown: wrappedOnMouseDown,
    ...handlers,
    style: finalStyle,
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


const RadiumExternalLinkBase =
(props: RadiumProps<HTMLAnchorElement>, ref?: React.Ref<HTMLAnchorElement>):
React.ReactElement => {
  const [radiumProps] = useRadium<HTMLAnchorElement>(props)
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a ref={ref} {...radiumProps} rel="noopener noreferrer" target="_blank" />
}
const RadiumExternalLink = React.memo(React.forwardRef(RadiumExternalLinkBase))

// See https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-element-interactions.md
type InteractionsProps =
// TODO(pascal): Add onClick, once all errors have been fixed.
//  | 'onClick'
  | 'onMouseDown'
  | 'onMouseUp'
  | 'onKeyPress'
  | 'onKeyDown'
  | 'onKeyUp'
type NonInteractiveHTMLProps<E extends HTMLElement> = Omit<React.HTMLProps<E>, InteractionsProps>


const RadiumSpanBase = (props: NonInteractiveHTMLProps<HTMLSpanElement>): React.ReactElement =>
  <span {...useRadium<HTMLSpanElement>(props)[0]} />
const RadiumSpan = React.memo(RadiumSpanBase)

const RadiumLiBase = (props: NonInteractiveHTMLProps<HTMLLIElement>): React.ReactElement =>
  <li {...useRadium<HTMLLIElement>(props)[0]} />
const RadiumListEl = React.memo(RadiumLiBase)


const RadiumButtonBase = (props: React.HTMLProps<HTMLButtonElement>): React.ReactElement => {
  const [radiumProps] = useRadium<HTMLButtonElement, React.HTMLProps<HTMLButtonElement>>(props)
  return <button type="button" {...radiumProps as React.ComponentPropsWithoutRef<'button'>} />
}
const RadiumButton = React.memo(RadiumButtonBase)


type SmartLinkProps =
  | RadiumProps<HTMLSpanElement>
  | RadiumProps<HTMLAnchorElement>
  | RadiumProps<HTMLButtonElement>
  | RadiumLinkProps

// TODO(cyrille): Use wherever applicable.
const SmartLinkBase: React.FC<SmartLinkProps> =
({style, ...props}: SmartLinkProps): React.ReactElement => {
  const linkStyle: RadiumCSSProperties = {
    borderRadius: 3,
    color: 'inherit',
    cursor: 'pointer',
    outlineOffset: 2,
    textDecoration: 'none',
    ...style,
  }
  const {to, ...otherLinkProps} = props as LinkProps
  if (to) {
    return <RadiumLink to={to} {...otherLinkProps} style={linkStyle} />
  }
  const {href, ...otherAnchorProps} = props as RadiumProps<HTMLAnchorElement>
  if (href) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <RadiumExternalLink href={href} {...otherAnchorProps} style={linkStyle} />
  }
  if (props.onClick) {
    return <RadiumButton style={linkStyle} {...props as RadiumProps<HTMLButtonElement>} />
  }
  return <RadiumSpan style={linkStyle} {...props} />
}
const SmartLink = React.memo(SmartLinkBase)


export {SmartLink, RadiumExternalLink, RadiumLink, RadiumListEl,
  useHover, useHoverAndFocus, useRadium, useFocus}
