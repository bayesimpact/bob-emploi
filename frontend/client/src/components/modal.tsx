import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import ReactDOM from 'react-dom'

import ModalCloseButton from 'components/modal_close_button'


let numModalsShown = 0

function show(): void {
  if (!numModalsShown++) {
    // Disable scroll on body.
    document.body.style.overflow = 'hidden'
  }
}

function hide(): void {
  if (!--numModalsShown) {
    // Re-enable scroll on body.
    document.body.style.overflow = 'visible'
  }
}


interface ReactHeightProps extends React.HTMLProps<HTMLDivElement> {
  onHeightReady: (height: number) => void
}


const ReactHeight = (props: ReactHeightProps): React.ReactElement => {
  const {children, onHeightReady, ...otherProps} = props
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useEffect((): (() => void) => {
    if (!ref.current) {
      return () => void 0
    }
    setHeight(ref.current.clientHeight)
    if (!window.ResizeObserver) {
      return () => void 0
    }
    const observer = new window.ResizeObserver(([entry]) => {
      setHeight(entry.target.clientHeight)
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [children])
  useLayoutEffect((): void => {
    onHeightReady(height)
  }, [height, onHeightReady])
  return <div {...otherProps} ref={ref}>
    {children}
  </div>
}


function resolveCssPx(value?: string|number) {
  if (!value) {
    return 0
  }
  if (typeof value === 'number') {
    return value
  }
  const matchPx = value.match(/^([^ ]+)px$/)
  if (matchPx) {
    return Number.parseFloat(matchPx[0])
  }
  return 0
}


// Compute the total margin height in pixels given the combined margin style, top and bottom styles.
// TODO(pascal): Dig in React source code to see if we can reuse theirs.
function extractTotalHeightPx(
  combined?: string|number, top?: string|number, bottom?: string|number,
): number {
  const isTopDefined = top !== undefined
  const isBottomDefined = bottom !== undefined

  // Handle margins horiz and vert: e.g. "40px auto".
  const twoGroups = (typeof combined === 'string') ? combined.match(/^([^ ]+px) [^ ]+$/) : false
  // Handle margins top, horiz and bottom: e.g. "40px auto 30px" or "20px 30px 10px 25px".
  const threeGroups = (typeof combined === 'string') ?
    combined.match(/^([^ ]+px) [^ ]+ ([^ ]+px)( [^ ]+)?$/) : false

  const topValue =
    isTopDefined ? top : twoGroups ? twoGroups[1] : threeGroups ? threeGroups[1] : combined
  const bottomValue =
    isBottomDefined ? bottom : twoGroups ? twoGroups[1] : threeGroups ? threeGroups[2] : combined
  return resolveCssPx(topValue) + resolveCssPx(bottomValue)
}


function getFocusableElements(parent: HTMLDivElement): readonly HTMLElement[] {
  return [
    ...parent.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'),
  ]
}

function getFirstFocusableNode(parent: HTMLDivElement, skipFirst: number): HTMLElement|undefined {
  const focusableElements = getFocusableElements(parent)
  const activableElements = focusableElements.filter(element => element.tabIndex >= 0)
  if (activableElements.length > skipFirst) {
    return activableElements[skipFirst]
  }
  // Not enough activable elements, let's pick the first one that is focusable.
  return focusableElements[0]
}

function useFocusTrap(
  page: React.RefObject<HTMLDivElement>,
  onClose: undefined | (() => void),
  isFullyShown: boolean,
  isShown: boolean,
  skipFocusOnFirstElements: number,
): ((e: React.KeyboardEvent<HTMLDivElement>) => void) {
  const lastFocusedNode = useRef(document.activeElement)
  // Auto-focus on the first focusable element when shown.
  useEffect((): void => {
    if (!isShown || !page.current) {
      if (lastFocusedNode.current) {
        (lastFocusedNode.current as HTMLElement).focus?.()
      }
      return
    }
    const firstNode = getFirstFocusableNode(page.current, skipFocusOnFirstElements)
    if (firstNode !== document.activeElement) {
      lastFocusedNode.current = document.activeElement
    }
    firstNode?.focus()
  }, [isFullyShown, isShown, page, skipFocusOnFirstElements])

  // Handle keyboard focus trap.
  const handleKeyboard = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isShown) {
      return
    }
    if (event.key === 'Escape') {
      onClose?.()
      return
    }
    if (event.key !== 'Tab' || !page.current) {
      return
    }
    const activableElements = getFocusableElements(page.current).
      filter(element => element.tabIndex >= 0)
    if (!activableElements.length) {
      event.preventDefault()
      return
    }
    const focusedNode = document.activeElement
    if (event.shiftKey) {
      if (focusedNode === activableElements[0]) {
        activableElements[activableElements.length - 1].focus()
        event.preventDefault()
      }
      return
    }
    if (focusedNode === activableElements[activableElements.length - 1]) {
      activableElements[0].focus()
      event.preventDefault()
    }
  }, [isShown, onClose, page])

  return handleKeyboard
}

export interface ModalConfig extends
  Omit<React.ComponentProps<'div'>, 'aria-hidden'|'aria-modal'|'ref'|'role'|'style'|'title'> {
  // Opacity of the black cover on the backround.
  backgroundCoverOpacity?: number
  // Content of the modal box.
  children: React.ReactNode
  // Children to set on top of the semi-opaque background but outside of the
  // modal box.
  externalChildren?: React.ReactNode
  // Whether the modal is shown.
  isShown?: boolean
  // Callback when the modal is closed (X button is clicked).
  // X button will only be displayed if this function is provided.
  onClose?: () => void
  // Callback when the modals finishes the hide transition.
  onHidden?: () => void
  skipFocusOnFirstElements?: number
  // Additional styling for the modal box.
  style?: React.CSSProperties
  title?: React.ReactNode
  // Additionl styling for the title.
  titleStyle?: React.CSSProperties
}


// The different stages of a modal:
//  - fully shown (from the beginning or when no transition)
//  - fully hidden (we do not include the children in the DOM)
//  - showing up with a transition when isShown is changed from false to true:
//    - first rendering with the new props:
//        isShown = true, new children, isAlreadyInTransition = true, isFullyShown = false
//    - calling the effects (switch wasShown to true, isInTransition to true, lastVisibleChildren)
//    - rendering after the effects
//        isShown = true, new children, isAlreadyInTransition = true, isFullyShown = false
//    - end transition callback
//        switch isInTransition to false
//    - rendering after the callback
//        isShown = true, new children, isAlreadyInTransition = false, isFullyShown = true
//  - hiding with a transition:
//    - first rendering with the new props:
//        isShown = false, new children, isAlreadyInTransition = true, isContentShown = true
//    - calling the effects (switch wasShown to false, isInTransition to true)
//    - rendering after the effects
//        isShown = false, isAlreadyInTransition = true, isContentShown = true
//    - end transition callback
//        switch isInTransition to false and lastVisibleChildren to null
//    - rendering after the callback
//        isShown = false, new children, isAlreadyInTransition = false, isContentShown = false
// Note that we ignore cases where the hasTransition flag changes.


const ModalBase = (props: ModalConfig): React.ReactElement => {
  const {backgroundCoverOpacity = .5, children, externalChildren, isShown, onClose, onHidden,
    skipFocusOnFirstElements = 0, style, title, titleStyle: propsTitleStyle, ...otherProps} = props
  const [closeButtonHeight, setCloseButtonHeight] = useState(0)
  const [isTooBigToBeCentered, setIsTooBigToBeCentered] = useState(false)
  const [modalHeight, setModalHeight] = useState(0)
  const titleId = useMemo(_uniqueId, [])

  // Effect to prevent page scrolling when there's at least one modal.
  useEffect((): (() => void)|void => {
    if (isShown) {
      show()
      return hide
    }
  }, [isShown])

  const hasTransition = !style || style.transition !== 'none'

  const [wasShown, setWasShown] = useState(isShown)
  const [isInTransition, setIsInTransition] = useState(false)
  const [lastVisibleChildren, setLastVisibleChildren] = useState(children)

  useEffect(() => {
    if (isShown === wasShown) {
      return
    }
    setWasShown(isShown)
    if (!hasTransition) {
      !isShown && onHidden && onHidden()
      return
    }
    setIsInTransition(true)
  }, [isShown, hasTransition, onHidden, wasShown])

  useEffect(() => {
    if (isShown) {
      setLastVisibleChildren(children)
    }
  }, [children, isShown])

  const page = useRef<HTMLDivElement>(null)

  const isAlreadyInTransition = isInTransition || (isShown !== wasShown)
  const isFullyShown = isShown && !isAlreadyInTransition
  const handleKeyboard = useFocusTrap(
    page, onClose, !!isFullyShown, !!isShown, skipFocusOnFirstElements + (onClose ? 1 : 0))

  const handleTransitionEnd = useCallback((): void => {
    if (!hasTransition) {
      // Weird cases.
      return
    }
    setIsInTransition(false)
    if (!isShown) {
      // Reset the scroll inside the modal.
      if (page.current) {
        page.current.scrollTop = 0
      }
      onHidden && onHidden()
      setLastVisibleChildren(null)
    }
  }, [hasTransition, isShown, onHidden])

  const hasOnClose = !!onClose

  const handleUpdatedHeight = useCallback((newHeight: number): void => {
    const newCloseButtonHeight = hasOnClose ? 30 : 0
    const maxHeight = window.innerHeight - newCloseButtonHeight
    setCloseButtonHeight(newCloseButtonHeight)
    setIsTooBigToBeCentered(!!newHeight && newHeight > maxHeight)
    setModalHeight(newHeight)
  }, [hasOnClose])

  const isContentShown = isShown || isAlreadyInTransition
  const finalChildren = ((): React.ReactNode => {
    if (!isContentShown) {
      // The modal is completely hidden, no children.
      return null
    }
    if (isShown) {
      // The modal is shown, pick up the latest children.
      return children
    }
    // The modal is going into hiding, it's possible the children are gone, make sure to show the
    // last visible ones.
    return lastVisibleChildren
  })()

  const pageStyle: React.CSSProperties = {
    alignItems: 'center',
    display: isTooBigToBeCentered ? 'block' : 'flex',
    fontFamily: style && style.fontFamily || 'inherit',
    height: isContentShown ? '100vh' : '0',
    justifyContent: 'center',
    left: 0,
    opacity: isContentShown ? 1 : 0,
    overflow: isTooBigToBeCentered ? 'auto' : 'hidden',
    position: 'fixed',
    textAlign: isTooBigToBeCentered ? 'center' : 'initial',
    top: 0,
    width: '100vw',
    zIndex: 2,
  }
  const modalStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
    color: colors.DARK_TWO,
    display: isTooBigToBeCentered ? 'inline-block' : 'block',
    fontSize: 15,
    // TODO(cyrille): Ensure margins on mobile.
    margin: isTooBigToBeCentered ? `${closeButtonHeight}px auto` : 'initial',
    opacity: isShown ? 1 : 0,
    position: 'relative',
    textAlign: 'left',
    // The transform property creates a new local coordinate system which
    // breaks nested modals or other properties using "fixed" so we get rid
    // of it as soon as the transition is over.
    // https://www.w3.org/TR/css-transforms-1/#transform-rendering
    transform: isFullyShown ? 'initial' : (
      'translate(0, ' + (isShown ? '0px' : '-40px') + ')'),
    transition: 'all 450ms',
    ...style,
  }
  const marginHeight = extractTotalHeightPx(
    modalStyle.margin, modalStyle.marginTop, modalStyle.marginBottom)
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: '#000',
    bottom: isTooBigToBeCentered ? 'initial' : 0,
    height: isTooBigToBeCentered ? (modalHeight + marginHeight) : '100vh',
    left: 0,
    opacity: isShown ? backgroundCoverOpacity : 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: modalStyle.transition,
    zIndex: 0,
  }
  const titleStyle: React.CSSProperties = {
    borderBottom: `solid 2px ${colors.MODAL_PROJECT_GREY}`,
    color: colors.DARK_TWO,
    fontSize: 18,
    fontWeight: 'bold',
    margin: '40px 50px 0',
    paddingBottom: 30,
    textAlign: 'center',
    ...propsTitleStyle,
  }
  const modalTitleId = title ? titleId : otherProps['aria-labelledby']
  // The onKeyDown handler is specifically designed for a11y.
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
  const modal = <div {...otherProps}
    ref={page} style={pageStyle} aria-hidden={!isShown} role="dialog" aria-modal={true}
    aria-labelledby={isShown ? modalTitleId : undefined}
    onKeyDown={handleKeyboard}>
    <div style={backgroundStyle} />
    {externalChildren}
    <ReactHeight
      onHeightReady={handleUpdatedHeight} style={modalStyle}
      onTransitionEnd={handleTransitionEnd} tabIndex={-1}>
      {title ? <h2 style={titleStyle} id={titleId}>{title}</h2> : null}
      {onClose ? <ModalCloseButton
        shouldCloseOnEscape={isShown} onClick={onClose} tabIndex={isShown ? 0 : -1}
        aria-describedby={isShown ? modalTitleId : undefined} /> :
        null}
      {finalChildren}
    </ReactHeight>
  </div>
  const modalContainer = document.getElementById('modals')
  if (modalContainer) {
    return ReactDOM.createPortal(modal, modalContainer)
  }
  return modal
}
const Modal = React.memo(ModalBase)


interface HeaderProps {
  children: React.ReactNode
  id?: string
  style: React.CSSProperties
}


const ModalHeaderBase = (props: HeaderProps): React.ReactElement => {
  const style = {
    alignItems: 'center',
    backgroundColor: colors.SLATE,
    color: '#fff',
    display: 'flex',
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.47,
    minHeight: 90,
    padding: '0 35px',
    width: '100%',
    ...props.style,
  }
  return <div style={style} id={props.id}>
    {props.children}
  </div>
}
const ModalHeader = React.memo(ModalHeaderBase)


// TODO(cyrille): Add an option to add it at the end of the DOM, instead of inside it.
// This is to avoid forbidden nesting such as <div> in <p>.
function useModal(isShownInitially?: boolean): [boolean, () => void, () => void] {
  const [isShown, setVisibility] = useState(!!isShownInitially)
  const show = useCallback((): void => setVisibility(true), [])
  const hide = useCallback((): void => setVisibility(false), [])
  return [isShown, show, hide]
}


// TODO(cyrille): Export Modal as default.
export {Modal, ModalHeader, useModal}
