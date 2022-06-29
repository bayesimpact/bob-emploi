import React, {useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef,
  useState} from 'react'

import {FastTransitions} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


const computeSentenceDuration =
  (sentence: string, characterDuration: number): number => characterDuration * sentence.length


interface ElementProps {
  children?: React.ReactNode
  // TODO(cyrille): Rename to a more action-agnostic name.
  isFastForwarded?: boolean
  isClosingConversation?: boolean
  isOpeningConversation?: boolean
  isShown?: boolean
  onDone?: () => void
  onShown?: () => void
  onUpdate?: () => void
  setDiscussing?: (isDiscussing: boolean) => void
  style?: React.CSSProperties
}


type CallbackArray = readonly (() => void)[]


interface PhylacteryProps extends Omit<ElementProps, 'style'> {
  children: readonly (React.ReactElement<ElementProps> | null)[]
}


// A Component with the mechanism for making elements appear one after the other. It's children are
// each given props 'isShown' and 'onDone'. 'isShown' tells the child component if it should appear.
// 'onDone' should be called once the next child should be shown. A GrowingPhylactery can be child
// of another one, so it also has 'isShown' and 'onDone' as props.
const GrowingPhylacteryBase = (props: PhylacteryProps): React.ReactElement => {
  const {children, isFastForwarded, isShown = true, onDone, onShown, onUpdate,
    setDiscussing} = props
  const [lastShownStep, setLastShownStep] = useState(-1)

  const realChildren = useMemo(
    () => children.filter((child): child is React.ReactElement<ElementProps> => !!child),
    [children],
  )
  const realChildrenLength = realChildren.length

  const previousKeys = useRef<(React.Key|null)[]>([])
  useLayoutEffect(() => {
    const childrenKeys = realChildren.map(({key}) => key)
    const firstChangedKey = childrenKeys.
      findIndex((value, index) => value !== previousKeys.current[index])
    if (firstChangedKey < 0 || firstChangedKey >= lastShownStep) {
      return
    }
    setLastShownStep(firstChangedKey)
    previousKeys.current = childrenKeys
  }, [lastShownStep, previousKeys, realChildren])

  useLayoutEffect((): void => {
    if (isFastForwarded) {
      setLastShownStep(realChildrenLength)
    }
  }, [isFastForwarded, realChildrenLength])

  useLayoutEffect((): void => {
    if (isShown && lastShownStep < 0) {
      setLastShownStep(0)
    }
  }, [isShown, lastShownStep])

  useEffect((): void => {
    if (isShown) {
      onShown?.()
    }
  }, [isShown, onShown])

  useEffect((): void => {
    if (isFastForwarded) {
      onUpdate?.()
      onDone?.()
    }
  }, [isFastForwarded, onUpdate, onDone])

  const onChildDoneHandlers = useMemo((): CallbackArray => {
    return realChildren.map((unusedChild, index: number): (() => void) => {
      if (index === realChildren.length - 1) {
        return (): void => {
          onUpdate?.()
          onDone?.()
        }
      }
      return (): void => {
        if (lastShownStep <= index) {
          setLastShownStep(index + 1)
          onUpdate?.()
        }
      }
    })
  }, [lastShownStep, realChildren, onDone, onUpdate])

  return <React.Fragment>
    {realChildren.map(
      (child: React.ReactElement<ElementProps>, index: number):
      {child: React.ReactElement<ElementProps>; index: number} => ({child, index}),
    ).map(({child, index}): React.ReactElement<ElementProps> =>
      React.cloneElement(child, {
        isFastForwarded,
        isShown: index <= lastShownStep,
        key: child.key || index,
        onDone: onChildDoneHandlers[index],
        onUpdate,
        setDiscussing,
        style: {flex: '0 0 auto', ...child.props.style},
      }),
    )}
  </React.Fragment>
}
const GrowingPhylactery = React.memo(GrowingPhylacteryBase)


// A group of elements in a growing phylactery which should be seen as a whole bubble once expanded.
const DiscussionBubbleBase = (props: PhylacteryProps): React.ReactElement|null => {
  const {children, ...otherProps} = props
  const nonNullChildren = children.
    filter((child): child is React.ReactElement<ElementProps> => !!child)
  if (!nonNullChildren.length) {
    return null
  }
  return <GrowingPhylactery {...otherProps}>
    {nonNullChildren.
      map((child, index): React.ReactElement<ElementProps> => React.cloneElement(child, {
        isClosingConversation: index === nonNullChildren.length - 1,
        isOpeningConversation: !index,
        key: index,
      }))}
  </GrowingPhylactery>
}
const DiscussionBubble = React.memo(DiscussionBubbleBase)


interface DiscussionProps extends PhylacteryProps {
  headWidth?: number
  isOneBubble?: boolean
  style?: React.CSSProperties
}


const discussingEllipsisStyle: React.CSSProperties = {
  alignSelf: 'center',
  margin: '10px 0',
  ...FastTransitions,
}

const notDiscussingEllipsisStyle: React.CSSProperties = {
  ...discussingEllipsisStyle,
  opacity: 0,
}


const getScrollPosition = (): number => window.scrollY ||
    window.pageYOffset ||
    document.body.scrollTop + (document.documentElement.scrollTop || 0)


const getMaxScrollPosition = (): number =>
  document.documentElement.offsetHeight - window.innerHeight


function scrollDown(): void {
  window.scrollTo(0, document.body.scrollHeight)
}


interface Sticker {
  stick: () => void
  unstick: () => void
}

function useBottomScrollSticker(): Sticker {
  const [isStuckToBottom, setIsStuckToBottom] = useState(true)
  const isSoonStuck = useRef(true)

  const onScroll = useCallback((): void => {
    const scrollPosition = getScrollPosition()
    const maxScrollPosition = getMaxScrollPosition()
    const isAtBottom = scrollPosition >= maxScrollPosition
    isSoonStuck.current = isAtBottom
    setIsStuckToBottom(isAtBottom)
  }, [])

  useEffect((): (() => void) => {
    if (!isStuckToBottom) {
      return (): void => void 0
    }
    const interval = window.setInterval((): void => {
      if (isSoonStuck.current) {
        scrollDown()
      }
    }, 100)
    return (): void => clearInterval(interval)
  }, [isStuckToBottom])

  useEffect((): (() => void) => {
    document.addEventListener('scroll', onScroll)
    return (): void => document.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const stick = useCallback((): void => {
    if (!isSoonStuck.current) {
      setIsStuckToBottom(true)
      scrollDown()
    }
  }, [])
  const unstick = useCallback((): void => {
    setIsStuckToBottom(false)
  }, [])
  return {stick, unstick}
}

// A Component containing a growing phylactery. This allows to have scrolling with stuck-at-bottom
// and disappearing top and bottom in a fixed height setting.
const DiscussionBase: React.FC<DiscussionProps> = (props): React.ReactElement => {
  const {children, headWidth = 75, isFastForwarded, isOneBubble, onDone, style,
    ...otherProps} = props
  const [isDiscussing, setDiscussing] = useState(false)
  const {stick, unstick} = useBottomScrollSticker()
  const scrollableStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    padding: '0 25px 20px',
    ...style,
  }), [style])
  const handleUpdate = useCallback((): void => {
    if (!isFastForwarded) {
      stick()
    }
  }, [isFastForwarded, stick])
  const handleDone = useCallback((): void => {
    unstick()
    onDone?.()
  }, [unstick, onDone])
  const Container = isOneBubble ? DiscussionBubble : GrowingPhylactery

  return <div style={scrollableStyle} role="log" aria-busy={isDiscussing}>
    <Container
      {...{isFastForwarded, ...otherProps}}
      setDiscussing={setDiscussing}
      onUpdate={handleUpdate} onDone={handleDone}>
      {children}
    </Container>
    <Ellipsis style={isDiscussing ? discussingEllipsisStyle : notDiscussingEllipsisStyle} />
    <img
      src={bobHeadImage} style={{
        alignSelf: 'center',
        width: headWidth,
      }} alt={config.productName} />
  </div>
}
const Discussion = React.memo(DiscussionBase)


interface WaitingElementProps extends ElementProps {
  children?: React.ReactElement
  waitingMillisec: number
}


// A growing phylactery element whose children are only shown for a given duration, to make the
// user wait before the next element is shown.
const WaitingElementBase = (props: WaitingElementProps): React.ReactElement|null => {
  const {children, isFastForwarded, isShown = true, onDone, waitingMillisec} = props
  const [isOver, setIsOver] = useState(false)

  useEffect((): (() => void) => {
    if (!isShown) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => {
      onDone?.()
      setIsOver(true)
    }, waitingMillisec)
    return ((): void => window.clearTimeout(timeout))
  }, [isShown, onDone, waitingMillisec])

  if (isFastForwarded || !isShown || isOver) {
    return null
  }
  return children || null
}
const WaitingElement = React.memo(WaitingElementBase)


interface EllipsisProps {
  bulletMargin?: number
  bulletSize?: number
  style?: React.CSSProperties
}


const bulletColors = [0.1, 0.2, 0.4].map((alpha): string => `rgba(0, 0, 0, ${alpha})`)


// A '...' to let time for the user to read the previous bubble in a growing phylactery.
const EllipsisBase = (props: EllipsisProps): React.ReactElement => {
  const {bulletMargin = 5, bulletSize = 12, style: externalStyle} = props
  // TODO(sil): Make everything more fluid (e.g. making the whole bubble disappear).
  const style = useMemo((): React.CSSProperties => ({
    borderRadius: 16,
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 5,
    padding: 10,
    width: 20 + bulletColors.length * (bulletSize + bulletMargin) - bulletMargin,
    ...externalStyle,
  }), [bulletMargin, bulletSize, externalStyle])
  const animationDuration = 700
  const bulletStyle = (backgroundColor: string, delay: number): React.CSSProperties => ({
    animationDelay: `${0.5 + delay * 0.2}s`,
    animationDirection: 'normal',
    animationDuration: `${animationDuration}ms`,
    animationFillMode: 'forwards',
    animationIterationCount: 'infinite',
    animationName: 'jump',
    animationTimingFunction: 'ease-out',
    backgroundColor,
    borderRadius: bulletSize,
    height: bulletSize,
    width: bulletSize,
  })

  return <div style={style}>
    {bulletColors.map((color, index): React.ReactNode =>
      <div key={color} style={bulletStyle(color, index)} />)}
  </div>
}
const Ellipsis = React.memo(EllipsisBase)


interface WaitingOnDoneProps extends Omit<ElementProps, 'children'> {
  children?: never
  isDone?: boolean
}


// A growing phylactery element which does not render anything but waits for some condition to let
// the phylactery continue growing.
const WaitingOnDone = (props: WaitingOnDoneProps): null => {
  const {isDone, isFastForwarded, onDone} = props
  const [wasDone, setWasDone] = useState(false)
  useEffect((): void => {
    if ((isFastForwarded || isDone) && !wasDone) {
      onDone?.()
    }
    setWasDone(isFastForwarded || !!isDone)
  }, [isDone, isFastForwarded, onDone, wasDone])
  return null
}


const NoOpElement = (props: ElementProps): React.ReactElement => {
  const {children, isShown, onDone, onShown, style} = props
  const [wasShown, setWasShown] = useState(isShown)
  useEffect((): void => {
    if (isShown && !wasShown) {
      onShown?.()
      onDone?.()
    }
    setWasShown(isShown)
  }, [isShown, onShown, onDone, wasShown])
  const containerStyle: React.CSSProperties = {
    ...FastTransitions,
    ...style,
    ...isShown ? {} : {
      height: 0,
      overflow: 'hidden',
      padding: 0,
    },
  }
  return <div style={containerStyle} aria-hidden={!isShown}>
    {children}
  </div>
}


interface BubbleProps {
  children?: React.ReactNode
  bubbleStyle?: React.CSSProperties
  id?: string
  isClosingConversation?: boolean
  isDone?: boolean
  isOpeningConversation?: boolean
  isShown?: boolean
  isUserSpeaking?: boolean
  onDone?: () => void
  style?: React.CSSProperties
}


interface TextContainer {
  getTextContent(): string
}

// A growing phylactery element which is shown as a bubble, or part of a bubble, depending on
// whether it's grouped in a DiscussionBubble. It is considered done as soon as shown.
const BubbleBase = (props: BubbleProps, ref: React.Ref<TextContainer>): React.ReactElement => {
  const {
    bubbleStyle,
    children,
    id,
    isOpeningConversation = true,
    isClosingConversation = true,
    isDone,
    isShown,
    isUserSpeaking,
    onDone,
    style,
  } = props

  useEffect((): void => {
    if (isShown) {
      onDone?.()
    }
  }, [isShown, onDone])

  const contentRef = useRef<HTMLParagraphElement>(null)

  useImperativeHandle(ref, (): TextContainer => ({
    getTextContent: (): string => contentRef.current?.textContent || '',
  }))

  // TODO(cyrille): Change padding to 10px 20px and borderRadii to 20.
  const bottomRadius = isClosingConversation || !isDone ? 25 : 0
  const topRadius = isOpeningConversation ? 25 : 0
  const bobBubbleStyle = {
    background: colors.NEW_GREY,
    borderRadius: `${topRadius}px ${topRadius}px ${bottomRadius}px ${bottomRadius}px`,
    marginTop: isOpeningConversation && isShown ? 10 : 0,
    overflow: 'hidden',
    transition: 'height,padding 100ms linear',
  }
  const smallBubbleStyle = {
    height: isShown ? 'initial' : 0,
    marginBottom: isShown ? 2 : 0,
    padding: isShown ? '19px 25px 21px' : '0 25px',
    ...isUserSpeaking ? {} : bobBubbleStyle,
    ...bubbleStyle,
  }

  return <div style={style} aria-hidden={!isShown} id={id}>
    <p ref={contentRef} style={smallBubbleStyle}>{children}</p>
  </div>
}
const Bubble = React.memo(React.forwardRef(BubbleBase))


export interface BubbleToReadProps extends ElementProps {
  id?: string
  readingTimeMillisec?: number
  setDiscussing?: (isDiscussing?: boolean) => void
}


// A bubble spoken by Bob, so it gives the user some time to read.
const BubbleToReadBase = (props: BubbleToReadProps): React.ReactElement => {
  const {children, id, isClosingConversation, isFastForwarded, isOpeningConversation, isShown,
    onDone, onUpdate, readingTimeMillisec, setDiscussing} = props
  const [isDone, setIsDone] = useState(false)

  const bubbleRef = useRef<TextContainer>(null)

  const readingDuration = ((): number => {
    if (readingTimeMillisec) {
      return readingTimeMillisec
    }
    const textContent = bubbleRef.current?.getTextContent()
    return textContent && computeSentenceDuration(textContent, 25) || 1000
  })()

  useEffect((): (() => void) => {
    if (!isShown || isFastForwarded || readingDuration < 450) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setDiscussing?.(true), 450)
    return (): void => window.clearTimeout(timeout)
  }, [isShown, isFastForwarded, readingDuration, setDiscussing])

  const handleDone = useCallback((): void => {
    setDiscussing?.(false)
    onDone?.()
    setIsDone(true)
  }, [onDone, setDiscussing])

  return <GrowingPhylactery onDone={handleDone} {...{isFastForwarded, isShown, onUpdate}}>
    <Bubble
      ref={bubbleRef} {...{id, isClosingConversation, isOpeningConversation}}
      isDone={isFastForwarded || isDone}>
      {children}
    </Bubble>
    <WaitingElement waitingMillisec={readingDuration} />
  </GrowingPhylactery>
}
const BubbleToRead = React.memo(BubbleToReadBase)


interface QuestionBubbleProps extends ElementProps {
  children: React.ReactNode
  isDone?: boolean
}


// A bubble containing a question asked to the user. Takes a 'isDone' prop to know if the question
// has been answered.
const QuestionBubbleBase = (props: QuestionBubbleProps): React.ReactElement => {
  const {children, isDone, isFastForwarded, isShown, onDone, onShown, onUpdate} = props
  return <GrowingPhylactery {...{isFastForwarded, isShown, onDone, onShown, onUpdate}}>
    <NoOpElement>{children}</NoOpElement>
    <WaitingOnDone isDone={isDone} />
  </GrowingPhylactery>
}
const QuestionBubble = React.memo(QuestionBubbleBase)


export {Discussion, DiscussionBubble, Ellipsis, BubbleToRead, NoOpElement, QuestionBubble,
  WaitingElement}
