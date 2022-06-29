import React, {useCallback, useEffect, useState} from 'react'

import {useIsTabNavigationUsed} from 'hooks/tab_navigation'

import CircularProgress from 'components/circular_progress'
import {colorToAlpha} from 'components/colors'
import {useRadium} from 'components/radium'
import {SmoothTransitions} from 'components/theme'

import type {ConfigColor} from 'config'

type CSSTransform = React.CSSProperties['transform']
const combineTransforms = (a: CSSTransform, b: CSSTransform): CSSTransform => {
  if (!b) {
    return a
  }
  if (!a) {
    return b
  }
  return `${a} ${b}`
}


interface TypeStyle extends Omit<RadiumCSSProperties, 'background'> {
  // Note that it's OK to add other alpha values of existing colors here.
  backgroundColor: ConfigColor|'transparent'|'rgba(255, 255, 255, .3)'
  ':disabled'?: React.CSSProperties
  ':focus-visible'?: React.CSSProperties
}


export const BUTTON_TYPE_STYLES = {
  deletion: {
    ':disabled': {
      backgroundColor: colorToAlpha(colors.RED_PINK, .5),
    },
    'backgroundColor': colors.RED_PINK,
  },
  discreet: {
    ':active': {
      backgroundColor: colors.SILVER,
      boxShadow: 'none',
      transform: 'translateY(0)',
    },
    ':focus-visible': {
      outline: 'solid 2px',
    },
    ':hover': {
      backgroundColor: colors.BACKGROUND_GREY,
      boxShadow: 'none',
      transform: 'translateY(0)',
    },
    'backgroundColor': 'transparent',
    'boxShadow': 'none',
    'color': colors.SLATE,
    'transition': SmoothTransitions.transition + ', outline 0s',
  },
  navigation: {
    ':disabled': {
      backgroundColor: colorToAlpha(colors.NAVIGATION_BUTTON_BACKGROUND, .5),
    },
    'backgroundColor': colors.NAVIGATION_BUTTON_BACKGROUND,
    'textShadow': '0 0 6px rgba(0, 0, 0, .6)',
  },
  navigationOnImage: {
    backgroundColor: 'rgba(255, 255, 255, .3)',
  },
  outline: {
    ':active': {
      boxShadow: 'none',
    },
    ':focus-visible': {
      outline: 'solid 2px',
    },
    ':hover': {
      boxShadow: 'none',
    },
    'backgroundColor': 'transparent',
    'border': `solid 1px ${colors.SILVER}`,
    'boxShadow': 'none',
    'color': colors.DARK_TWO,
    'transition': SmoothTransitions.transition + ', outline 0s',
  },
  validation: {
    ':disabled': {
      backgroundColor: colorToAlpha(colors.GREENISH_TEAL, .5),
    },
    'backgroundColor': colors.GREENISH_TEAL,
  },
} as const
export type ButtonType = keyof typeof BUTTON_TYPE_STYLES


interface InertProps {
  bounceDurationMs?: number
  children?: React.ReactNode
  disabled?: boolean
  isActive?: boolean
  isHighlighted?: boolean
  isNarrow?: boolean
  isProgressShown?: boolean
  isRound?: boolean
  isTabNavigationUsed?: boolean
  style?: RadiumCSSProperties
  type?: ButtonType
}

interface Props extends
  Omit<React.ComponentPropsWithoutRef<'button'>, 'role'|'style'|'type'>, InertProps {
  // Add roles if they make sense here, but never accept the role "none". If you need the
  // role "none", you probably should be using an InertButton.
  role?: 'button'|'radio'|'checkbox'
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

function getButtonStyle(props: InertProps): RadiumCSSProperties {
  const {bounceDurationMs = 50, disabled, isActive, isNarrow, type, style, isHighlighted,
    isRound, isTabNavigationUsed} = props
  const {':disabled': disabledStyle, ':focus-visible': focusVisibleStyle, ...typeStyle}: TypeStyle =
    BUTTON_TYPE_STYLES[type || 'navigation']

  const buttonStyle: RadiumCSSProperties = {
    border: 'none',
    borderRadius: isRound ? 30 : 5,
    ...!disabled && {boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)'},
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-block',
    flexShrink: 0,
    fontSize: isRound ? 15 : 16,
    fontStyle: 'normal',
    fontWeight: 'normal',
    padding: isNarrow ? '10px 14px' : isRound ? '12px 35px' : '12px 20px',
    position: 'relative',
    textAlign: 'center',
    transition: `ease ${bounceDurationMs}ms`,
    ...typeStyle,
    ...style,
    transform: combineTransforms(style?.transform, typeStyle.transform || 'translateY(0)'),
  }
  if (!disabled) {
    buttonStyle[':hover'] = {
      backgroundColor: buttonStyle.backgroundColor,
      boxShadow: (isTabNavigationUsed ?
        `0px 0px 0px 2px #fff, 0px 0px 0px 5px ${buttonStyle.backgroundColor}, ` : '') +
        '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
      outline: 'none',
      ...typeStyle[':hover'],
      ...(style ? style[':hover'] : {}),
      transform: combineTransforms(
        style?.[':hover']?.transform || style?.transform,
        typeStyle[':hover']?.transform || 'translateY(-1px)'),
    }
    buttonStyle[':focus'] = buttonStyle[':hover']
    if (isTabNavigationUsed && focusVisibleStyle) {
      buttonStyle[':focus'] = {
        ...buttonStyle[':focus'],
        ...focusVisibleStyle,
      }
    }
    buttonStyle[':active'] = {
      boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
      ...typeStyle[':active'],
      ...(style ? style[':active'] : {}),
      transform: combineTransforms(
        style?.[':active']?.transform || style?.transform,
        typeStyle[':active']?.transform || 'translateY(1px)'),
    }
  } else {
    buttonStyle[':hover'] = {}
    buttonStyle.cursor = 'inherit'
    Object.assign(buttonStyle, disabledStyle)
  }
  if (isHighlighted) {
    Object.assign(buttonStyle, buttonStyle[':hover'])
  }
  if (isActive) {
    Object.assign(buttonStyle, buttonStyle[':active'])
  }
  return buttonStyle
}

interface ClickingProps<T> {
  delayMillisecs?: number
  isClickAnyway?: boolean
  isDefaultPrevented?: boolean
  onClick?: (event: React.MouseEvent<T>) => void
}

interface ClickingState<T> {
  isActive: boolean
  onClick: (event: React.MouseEvent<T>) => void
}

// Wrap a click event to only trigger after a delay and have an active state during that delay.
export function useClicking<T>(props: ClickingProps<T>): ClickingState<T> {
  const {delayMillisecs = 50, isClickAnyway, isDefaultPrevented = true, onClick} = props
  const [clickingEvent, setClickingEvent] = useState<React.MouseEvent<T>|undefined>()

  const handleClick = useCallback((event: React.MouseEvent<T>): void => {
    if (!onClick) {
      return
    }
    if (isDefaultPrevented) {
      event?.preventDefault?.()
    }
    setClickingEvent(event)
  }, [isDefaultPrevented, onClick])

  useEffect((): (() => void)|void => {
    if (!clickingEvent) {
      return
    }
    let hasClicked = false
    const actuallyClick = (): void => {
      if (hasClicked) {
        return
      }
      hasClicked = true
      setClickingEvent(undefined)
      onClick?.(clickingEvent)
    }
    const timeout = window.setTimeout(actuallyClick, delayMillisecs)
    return (): void => {
      if (isClickAnyway) {
        actuallyClick()
      }
      window.clearTimeout(timeout)
    }
  }, [delayMillisecs, clickingEvent, isClickAnyway, onClick])

  return {isActive: !!clickingEvent, onClick: handleClick}
}

const Button = (props: Props, ref: React.Ref<HTMLButtonElement>): React.ReactElement => {
  const {bounceDurationMs = 50, children, disabled, isNarrow, isProgressShown, type, style,
    isActive: isForceActive, isHighlighted, isRound, onClick, ...otherProps} = props

  const {isActive, onClick: handleClick} =
    useClicking<HTMLButtonElement>({delayMillisecs: bounceDurationMs, onClick})

  const isTabNavigationUsed = useIsTabNavigationUsed()

  const buttonStyle = getButtonStyle({
    bounceDurationMs, disabled, isActive: isActive || isForceActive, isHighlighted, isNarrow,
    isProgressShown, isRound, isTabNavigationUsed, style, type,
  })

  const [radiumProps] =
    useRadium<HTMLButtonElement, Omit<Props, 'type'>>({...otherProps, style: buttonStyle})
  return <button
    disabled={disabled} tabIndex={!disabled && onClick ? undefined : -1} {...radiumProps}
    onClick={onClick && handleClick} ref={ref} type="button">
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

const InertButtonBase = (props: InertProps): React.ReactElement => {
  const {children, ...otherProps} = props
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const buttonStyle = getButtonStyle({...otherProps, isTabNavigationUsed})
  return <span style={buttonStyle}>
    {otherProps.isProgressShown ? <React.Fragment>
      <div style={progressContainerStyle}>
        <CircularProgress size={23} style={{color: '#fff'}} thickness={2} />
      </div>
      <span style={{opacity: 0}}>
        {children}
      </span>
    </React.Fragment> : children}
  </span>
}
export const InertButton = React.memo(InertButtonBase)



export default React.memo(React.forwardRef(Button))
