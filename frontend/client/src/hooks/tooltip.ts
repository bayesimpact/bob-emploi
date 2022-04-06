import _uniqueId from 'lodash/uniqueId'
import {useCallback, useEffect, useMemo, useState} from 'react'

import type {HoverAndFocusProps} from 'components/radium'
import {useHoverAndFocus} from 'components/radium'


interface TooltipProps<T> {
  containerProps: HoverAndFocusProps<T>
  isShown: boolean
  tooltipProps: {
    'aria-hidden': boolean
    'id': string
    'role': 'tooltip'
  }
  triggerProps: {
    'aria-describedby': string
    'tabIndex': 0
    'onClick': () => void
  }
}

interface Config {
  'aria-describedby'?: string
  isTriggeredByClick?: boolean
}

function useTooltip<T extends Element>(config: Config = {}): TooltipProps<T> {
  const {'aria-describedby': ariaDescribedby, isTriggeredByClick = false} = config
  const tooltipId = useMemo(_uniqueId, [])
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus()

  const [isForcedShown, setIsForcedShown] = useState(false)

  // Hide the tooltip when pressing the Escape key.
  useEffect(() => {
    if (!(isForcedShown && isTriggeredByClick) && !isFocused) {
      return () => void 0
    }
    const listener = (event: KeyboardEvent): void => {
      if (event.code !== 'Escape') {
        return
      }
      if (isForcedShown && isTriggeredByClick) {
        setIsForcedShown(false)
        return
      }
      if (isFocused) {
        (event.target as HTMLElement)?.blur()
      }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [isFocused, isForcedShown, isTriggeredByClick])

  const handleClick = useCallback(() => {
    if (!isTriggeredByClick) {
      return
    }
    setIsForcedShown((wasForcedShown) => !wasForcedShown)
  }, [isTriggeredByClick])

  const isShown = (isTriggeredByClick ? isForcedShown : isFocused) || isHovered
  return {
    containerProps: handlers,
    isShown,
    tooltipProps: {
      'aria-hidden': !isShown,
      'id': tooltipId,
      'role': 'tooltip',
    },
    triggerProps: {
      'aria-describedby': ariaDescribedby ? `${ariaDescribedby} ${tooltipId}` : tooltipId,
      'onClick': handleClick,
      'tabIndex': 0,
    },
  }
}


export default useTooltip
