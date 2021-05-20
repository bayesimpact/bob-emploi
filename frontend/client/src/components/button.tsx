import React, {useCallback, useEffect, useState} from 'react'

import CircularProgress from 'components/circular_progress'
import {colorToAlpha} from 'components/colors'
import {useRadium} from 'components/radium'
import {SmoothTransitions} from 'components/theme'


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
}


export const BUTTON_TYPE_STYLES = {
  back: {
    ':active': {
      boxShadow: 'none',
    },
    ':disabled': {
      backgroundColor: colorToAlpha(colors.SILVER, .5),
    },
    ':hover': {
      boxShadow: 'none',
    },
    'backgroundColor': colors.SILVER,
    'boxShadow': 'none',
  },
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
    ':disabled': {
      backgroundColor: colorToAlpha(colors.BOB_BLUE, .5),
    },
    'backgroundColor': colors.BOB_BLUE,
  },
  navigationOnImage: {
    backgroundColor: 'rgba(255, 255, 255, .3)',
  },
  outline: {
    backgroundColor: 'transparent',
    border: `solid 1px ${colors.SILVER}`,
    boxShadow: 'none',
    color: colors.DARK_TWO,
  },
  validation: {
    ':disabled': {
      backgroundColor: colorToAlpha(colors.GREENISH_TEAL, .5),
    },
    'backgroundColor': colors.GREENISH_TEAL,
  },
} as const
type ButtonType = keyof typeof BUTTON_TYPE_STYLES


interface Props extends Omit<React.ComponentPropsWithoutRef<'button'>, 'type'> {
  bounceDurationMs?: number
  isHighlighted?: boolean
  isNarrow?: boolean
  isProgressShown?: boolean
  isRound?: boolean
  style?: RadiumCSSProperties
  type?: ButtonType
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


const Button = (props: Props, ref: React.Ref<HTMLButtonElement>): React.ReactElement => {
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
    return (): void => window.clearTimeout(timeout)
  }, [bounceDurationMs, clickingEvent, onClick])

  const {':disabled': disabledStyle, ...typeStyle}: TypeStyle =
    BUTTON_TYPE_STYLES[type || 'navigation']

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
    transition: `ease ${bounceDurationMs}ms`,
    ...typeStyle,
    ...style,
    transform: combineTransforms(style?.transform, typeStyle.transform || 'translateY(0)'),
  }
  if (!disabled) {
    buttonStyle[':hover'] = {
      backgroundColor: buttonStyle.backgroundColor,
      boxShadow: '0 4px 6px rgba(0, 0, 0, .11), 0 1px 3px rgba(0, 0, 0, .08)',
      ...typeStyle[':hover'],
      ...(style ? style[':hover'] : {}),
      transform: combineTransforms(
        style?.[':hover']?.transform || style?.transform,
        typeStyle[':hover']?.transform || 'translateY(-1px)'),
    }
    buttonStyle[':focus'] = buttonStyle[':hover']
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
  if (clickingEvent) {
    Object.assign(buttonStyle, buttonStyle[':active'])
  }
  const [radiumProps] =
    useRadium<HTMLButtonElement, Omit<Props, 'type'>>({...otherProps, style: buttonStyle})
  return <button
    disabled={disabled} tabIndex={!disabled && onClick ? 0 : -1} {...radiumProps}
    onClick={onClick && handleClick} ref={ref}>
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


export default React.memo(React.forwardRef(Button))
