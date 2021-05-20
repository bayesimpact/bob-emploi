import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useState} from 'react'

import {HoverAndFocusProps, useHoverAndFocus} from 'components/radium'


interface TooltipProps<T> {
  containerProps: HoverAndFocusProps<T> & {
    onKeyDown: (event: React.KeyboardEvent<T>) => void
  }
  isShown: boolean
  tooltipProps: {
    'aria-hidden': boolean
    'id': string
    'role': 'tooltip'
  }
  triggerProps: {
    'aria-describedby': string
    'tabIndex': 0
  }
}


function useTooltip<T extends Element>(): TooltipProps<T> {
  const [tooltipId] = useState(_uniqueId)
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus()

  // Hide the tooltip when pressing the Escape key.
  const blurOnEscape = useCallback((event: React.KeyboardEvent<T>): void => {
    if (isFocused && event.code === 'Escape') {
      (event.target as HTMLElement)?.blur()
    }
  }, [isFocused])

  const isShown = isFocused || isHovered
  return {
    containerProps: {
      ...handlers,
      onKeyDown: blurOnEscape,
    },
    isShown,
    tooltipProps: {
      'aria-hidden': !isShown,
      'id': tooltipId,
      'role': 'tooltip',
    },
    triggerProps: {
      'aria-describedby': tooltipId,
      'tabIndex': 0,
    },
  }
}


export default useTooltip
