import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'

import isMobileVersion from 'store/mobile'

import OutsideClickHandler from 'components/outside_click_handler'


// Hook to handle a queue of items. Items are queued at render time and the queue is popped by
// callback.
// @param item: The item to queue, it is queued only when it changes.
// @return [the current item, a callback function to pop the first (current) element]
function useQueue<T>(item: T): [T|undefined, () => boolean] {
  const [currentItem, setCurrentItem] = useState<T|undefined>(item)
  const [queue] = useState<T[]>([])
  const popQueue = useCallback((): boolean => {
    if (queue.length) {
      setCurrentItem(queue.shift())
      return true
    }
    setCurrentItem(undefined)
    return false
  }, [queue])

  useEffect((): void => {
    const lastInsertedItem = queue.length ? queue[queue.length - 1] : currentItem
    if (lastInsertedItem === item || !item) {
      return
    }
    if (currentItem) {
      queue.push(item)
    } else {
      setCurrentItem(item)
    }
  }, [currentItem, queue, item])

  return [currentItem, popQueue]
}


interface SnackbarProps {
  onHide: () => void
  snack?: React.ReactNode
  style?: React.CSSProperties
  timeoutMillisecs: number
}


const Snackbar = (props: SnackbarProps): React.ReactElement => {
  const {onHide, snack, style, timeoutMillisecs, ...otherProps} = props
  const [isVisible, setIsVisible] = useState(!!snack)
  const [visibleSnack, nextSnack] = useQueue(snack)

  const hide = useCallback((): void => {
    if (!isVisible) {
      return
    }
    setIsVisible(false)
    onHide()
  }, [isVisible, onHide])

  // When starting to show, set a timeout to hide ater a moment.
  useEffect((): (() => void)|void => {
    if (!isVisible) {
      return
    }
    const timeout = window.setTimeout(hide, timeoutMillisecs)
    return (): void => {
      window.clearTimeout(timeout)
    }
  }, [hide, isVisible, timeoutMillisecs])

  // If there's a new snack, show it.
  useEffect((): void => {
    if (visibleSnack) {
      setIsVisible(true)
    }
  }, [visibleSnack])

  // After hiding the snack bar, switch to the next snack.
  const handleTransitionEnd = useCallback((): void => {
    if (isVisible) {
      return
    }
    setIsVisible(nextSnack())
  }, [isVisible, nextSnack])

  const containerStyle: React.CSSProperties = {
    bottom: 0,
    display: 'flex',
    height: visibleSnack ? 'initial' : 0,
    justifyContent: 'center',
    left: 0,
    position: 'fixed',
    right: 0,
    zIndex: 999,
  }
  const labelStyle: React.CSSProperties = {
    color: '#fff',
    fontSize: 14,
    lineHeight: '24px',
  }
  const snackStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: isMobileVersion ? 'initial' : '2px',
    maxWidth: 'calc(100% - 48px)',
    minWidth: 288,
    padding: '13px 24px',
    transform: isVisible ? 'translate(0, 0)' : 'translate(0, 100%)',
    transition: 'transform 200ms ease-out',
    width: isMobileVersion ? 'calc(100% - 48px)' : 'auto',
    willChange: 'transform',
  }
  return <OutsideClickHandler onOutsideClick={hide} style={containerStyle} {...otherProps}>
    <div
      style={{...snackStyle, ...(style || {})}}
      onTransitionEnd={handleTransitionEnd}
    >
      <span style={labelStyle}>{visibleSnack}</span>
    </div>
  </OutsideClickHandler>
}
Snackbar.propTypes = {
  onHide: PropTypes.func.isRequired,
  snack: PropTypes.node,
  style: PropTypes.object,
  timeoutMillisecs: PropTypes.number.isRequired,
}


export default React.memo(Snackbar)
