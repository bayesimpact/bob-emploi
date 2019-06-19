import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'

import {FastTransitions} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


const computeSentenceDuration =
  (sentence: string, characterDuration: number): number => characterDuration * sentence.length


interface ElementProps {
  isFastForwarded?: boolean
  isClosingConversation?: boolean
  isOpeningConversation?: boolean
  isShown?: boolean
  onDone?: () => void
  onUpdate?: () => void
  setDiscussing?: (isDiscussing: boolean) => void
  style?: React.CSSProperties
}


interface PhylacteryProps extends Omit<ElementProps, 'style'> {
  children: React.ReactElement<ElementProps>[]
}


interface PhylacteryState {
  lastShownStep: number
}


// A Component with the mechanism for making elements appear one after the other. It's children are
// each given props 'isShown' and 'onDone'. 'isShown' tells the child component if it should appear.
// 'onDone' should be called once the next child should be shown. A GrowingPhylactery can be child
// of another one, so it also has 'isShown' and 'onDone' as props.
class GrowingPhylactery extends React.PureComponent<PhylacteryProps, PhylacteryState> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    onUpdate: PropTypes.func,
    setDiscussing: PropTypes.func,
  }

  public static defaultProps = {
    isShown: true,
  }

  public state: PhylacteryState = {
    lastShownStep: -1,
  }

  public static getDerivedStateFromProps(
    {children, isFastForwarded, isShown}: PhylacteryProps,
    {lastShownStep}: PhylacteryState): PhylacteryState {
    if (isFastForwarded) {
      return {lastShownStep: children.length}
    }
    if (isShown && lastShownStep < 0) {
      return {lastShownStep: 0}
    }
    return null
  }

  public componentDidUpdate({isFastForwarded: alreadyDone}: PhylacteryProps): void {
    const {isFastForwarded, onDone, onUpdate} = this.props
    if (!alreadyDone && isFastForwarded) {
      onUpdate && onUpdate()
      onDone && onDone()
    }
  }

  private getOnChildDoneHandler = _memoize((index: number): (() => void) => {
    // TODO(pascal): Fix not to memoize those props.
    const {children, onDone, onUpdate} = this.props
    if (index === children.length - 1) {
      return (): void => {
        onUpdate && onUpdate()
        onDone && onDone()
      }
    }
    return (): void => {
      if (this.state.lastShownStep <= index) {
        this.setState({lastShownStep: index + 1}, onUpdate)
      }
    }
  })

  public render(): React.ReactNode {
    const {children, isFastForwarded, onUpdate, setDiscussing} = this.props
    const {lastShownStep} = this.state
    // WARNING: Children of global bubble div are in reverse order, to allow the presence of a
    // scrollbar.
    return <React.Fragment>
      {children.map(
        (child: React.ReactElement<ElementProps>, index: number):
        {child: React.ReactElement<ElementProps>; index: number} => ({child, index})
      ).reverse().map(({child, index}): React.ReactElement<ElementProps> =>
        React.cloneElement(child, {
          isFastForwarded,
          isShown: index <= lastShownStep,
          key: index,
          onDone: this.getOnChildDoneHandler(index),
          onUpdate,
          setDiscussing,
          style: {flex: '0 0 auto', ...child.props.style},
        })
      )}
    </React.Fragment>
  }
}


// A group of elements in a growing phylactery which should be seen as a whole bubble once expanded.
class DiscussionBubble extends React.PureComponent<PhylacteryProps> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
  }

  public render(): React.ReactNode {
    const {children, ...otherProps} = this.props
    return <GrowingPhylactery {...otherProps}>
      {children.map((child, index): React.ReactElement<ElementProps> => React.cloneElement(child, {
        isClosingConversation: index === children.length - 1,
        isOpeningConversation: !index,
        key: index,
      }))}
    </GrowingPhylactery>
  }
}


interface DiscussionProps extends PhylacteryProps {
  headWidth?: number
  isOneBubble?: boolean
  style?: React.CSSProperties
}


// A Component containing a growing phylactery. This allows to have scrolling with stuck-at-bottom
// and disappearing top and bottom in a fixed height setting.
class Discussion extends React.PureComponent<DiscussionProps, {isDiscussing: boolean}> {
  public static propTypes = {
    children: PropTypes.node,
    headWidth: PropTypes.number,
    isFastForwarded: PropTypes.bool,
    isOneBubble: PropTypes.bool,
    style: PropTypes.object,
  }

  public state = {
    isDiscussing: false,
  }

  private scrollSticker: React.RefObject<BottomScrollSticker> = React.createRef()

  private handleDiscussing = (isDiscussing: boolean): void => this.setState({isDiscussing})

  private handleScrollStick = (): void => this.scrollSticker.current.stick()

  public render(): React.ReactNode {
    const {children, headWidth = 75, isFastForwarded, isOneBubble, style,
      ...otherProps} = this.props
    const {isDiscussing} = this.state
    const scrollableStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column-reverse',
      paddingBottom: 20,
      ...style,
    }
    const ellipsisStyle: React.CSSProperties = {
      alignSelf: 'center',
      margin: '10px 0',
      opacity: isDiscussing ? 1 : 0,
      ...FastTransitions,
    }
    const Container = isOneBubble ? DiscussionBubble : GrowingPhylactery

    return <div style={scrollableStyle}>
      <BottomScrollSticker ref={this.scrollSticker} />
      <img
        src={bobHeadImage} style={{
          alignSelf: 'center',
          width: headWidth,
        }} alt={config.productName} />
      <Ellipsis style={ellipsisStyle} />
      <Container
        {...{isFastForwarded, ...otherProps}}
        setDiscussing={this.handleDiscussing}
        onUpdate={this.handleScrollStick}>
        {children}
      </Container>
    </div>
  }
}


// A pseudo-component that keeps the document's main scroll to the bottom except if
// the user manually changes the scroll.
class BottomScrollSticker extends React.PureComponent<{}, {isStuckToBottom: boolean}> {
  public state = {
    isStuckToBottom: true,
  }

  public componentDidMount(): void {
    this.interval = setInterval(this.maybeScrollDown, 100)
    document.addEventListener('scroll', this.onScroll)
  }

  public componentWillUnmount(): void {
    document.removeEventListener('scroll', this.onScroll)
    clearInterval(this.interval)
  }

  private interval: ReturnType<typeof setInterval>

  public stick(): void {
    if (!this.state.isStuckToBottom) {
      this.setState({isStuckToBottom: true})
      this.scrollDown()
    }
  }

  private maybeScrollDown = (): void => {
    if (!this.state.isStuckToBottom) {
      return
    }
    this.scrollDown()
  }

  private scrollDown(): void {
    window.scrollTo(0, document.body.scrollHeight)
  }

  private onScroll = (): void => {
    const pageHeight = document.documentElement.offsetHeight
    const windowHeight = window.innerHeight
    const scrollPosition = window.scrollY ||
      window.pageYOffset ||
      document.body.scrollTop + (document.documentElement.scrollTop || 0)
    const isAtBottom = pageHeight <= windowHeight + scrollPosition
    if (isAtBottom !== this.state.isStuckToBottom) {
      this.setState({isStuckToBottom: isAtBottom})
    }
  }

  public render(): React.ReactNode {
    return null
  }
}


interface WaitingElementProps extends ElementProps {
  waitingMillisec: number
}


// A growing phylactery element whose children are only shown for a given duration, to make the
// user wait before the next element is shown.
class WaitingElement extends React.PureComponent<WaitingElementProps> {
  public static propTypes = {
    children: PropTypes.node,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    waitingMillisec: PropTypes.number.isRequired,
  }

  public state = {
    isShown: true,
  }

  public componentDidUpdate({isShown: wasShown}: ElementProps): void {
    if (wasShown || !this.props.isShown) {
      return
    }
    const {onDone, waitingMillisec} = this.props
    clearTimeout(this.timeout)
    this.timeout = setTimeout((): void => {
      onDone && onDone()
      this.setState({isShown: false})
    }, waitingMillisec)
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout: ReturnType<typeof setTimeout>

  public render(): React.ReactNode {
    const {children, isFastForwarded, isShown} = this.props
    if (isFastForwarded || !isShown || !this.state.isShown) {
      return null
    }
    return children || null
  }
}


interface EllipsisProps {
  bulletMargin: number
  bulletSize: number
  style?: React.CSSProperties
}


// A '...' to let time for the user to read the previous bubble in a growing phylactery.
class Ellipsis extends React.PureComponent<EllipsisProps> {
  public static propTypes = {
    bulletMargin: PropTypes.number.isRequired,
    bulletSize: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    bulletMargin: 5,
    bulletSize: 12,
  }

  public render(): React.ReactNode {
    const {bulletMargin, bulletSize, style: externalStyle} = this.props
    const bulletColors = [0.1, 0.2, 0.4].map((alpha): string => `rgba(0, 0, 0, ${alpha})`)
    // TODO(marielaure): Make everything more fluid (e.g. making the whole bubble disappear).
    const style = {
      borderRadius: 16,
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 5,
      padding: 10,
      width: 20 + bulletColors.length * (bulletSize + bulletMargin) - bulletMargin,
      ...externalStyle,
    }
    const animationDuration = 700
    const bulletStyle = (backgroundColor, delay): React.CSSProperties => ({
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
}


interface WaitingOnDoneProps extends ElementProps {
  children?: never
  isDone?: boolean
}


// A growing phylactery element which does not render anything but waits for some condition to let
// the phylactery continue growing.
class WaitingOnDone extends React.PureComponent<WaitingOnDoneProps> {
  public static propTypes = {
    isDone: PropTypes.bool,
    isFastForwarded: PropTypes.bool,
    onDone: PropTypes.func,
  }

  public componentDidMount(): void {
    this.componentDidUpdate({})
  }

  public componentDidUpdate({isDone: wasDone}: WaitingOnDoneProps): void {
    const {isDone, isFastForwarded, onDone} = this.props
    if (isFastForwarded || (isDone && !wasDone)) {
      onDone && onDone()
    }
  }

  public render(): React.ReactNode {
    return null
  }
}


class NoOpElement extends React.PureComponent<ElementProps> {
  public static propTypes = {
    children: PropTypes.node,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    style: PropTypes.object,
  }

  public componentDidMount(): void {
    this.componentDidUpdate({})
  }

  public componentDidUpdate({isShown: wasShown}: ElementProps): void {
    const {isShown, onDone} = this.props
    if (isShown && !wasShown) {
      onDone && onDone()
    }
  }

  public render(): React.ReactNode {
    const {children, isShown, style} = this.props
    const containerStyle: React.CSSProperties = {
      ...FastTransitions,
      ...style,
      ...isShown ? {} : {
        height: 0,
        overflow: 'hidden',
        padding: 0,
      },
    }
    return <div style={containerStyle}>
      {children}
    </div>
  }
}


interface BubbleProps {
  bubbleStyle?: React.CSSProperties
  isClosingConversation?: boolean
  isDone?: boolean
  isOpeningConversation?: boolean
  isShown?: boolean
  isUserSpeaking?: boolean
  onDone?: () => void
  style?: React.CSSProperties
}


// A growing phylactery element which is shown as a bubble, or part of a bubble, depending on
// whether it's grouped in a DiscussionBubble. It is considered done as soon as shown.
class Bubble extends React.PureComponent<BubbleProps> {
  public static propTypes = {
    bubbleStyle: PropTypes.object,
    children: PropTypes.node,
    isClosingConversation: PropTypes.bool,
    isDone: PropTypes.bool,
    isOpeningConversation: PropTypes.bool,
    isShown: PropTypes.bool,
    isUserSpeaking: PropTypes.bool,
    onDone: PropTypes.func,
    style: PropTypes.object,
  }

  public static defaultProps = {
    isClosingConversation: true,
    isOpeningConversation: true,
  }

  public componentDidMount(): void {
    this.componentDidUpdate({})
  }

  public componentDidUpdate({isShown: wasShown}: BubbleProps): void {
    const {isShown, onDone} = this.props
    if (isShown && !wasShown) {
      onDone && onDone()
    }
  }

  private contentRef: React.RefObject<HTMLDivElement> = React.createRef()

  public getTextContent(): string {
    return this.contentRef.current && this.contentRef.current.textContent || ''
  }

  public render(): React.ReactNode {
    const {
      bubbleStyle,
      children,
      isOpeningConversation,
      isClosingConversation,
      isDone,
      isShown,
      isUserSpeaking,
      style,
    } = this.props
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

    return <div style={style}>
      <div ref={this.contentRef} style={smallBubbleStyle}>{children}</div>
    </div>
  }
}


interface BubbleToReadProps extends ElementProps {
  readingTimeMillisec?: number
  setDiscussing?: (isDiscussing?: boolean) => void
}


// A bubble spoken by Bob, so it gives the user some time to read.
class BubbleToRead extends React.PureComponent<BubbleToReadProps> {
  public static propTypes = {
    children: PropTypes.node,
    isClosingConversation: PropTypes.bool,
    isFastForwarded: PropTypes.bool,
    isOpeningConversation: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    onUpdate: PropTypes.func,
    readingTimeMillisec: PropTypes.number,
    setDiscussing: PropTypes.func.isRequired,
  }

  public static defaultProps = {
    setDiscussing: (): void => {},
  }

  public state = {
    isDone: false,
  }

  public componentDidMount(): void {
    this.componentDidUpdate({})
  }

  public componentDidUpdate({isShown: wasShown}: BubbleToReadProps): void {
    const {isFastForwarded, isShown, setDiscussing} = this.props
    if (!isShown || wasShown) {
      return
    }
    if (isFastForwarded || this.computeReadingDuration() < 450) {
      return
    }
    clearTimeout(this.timeout)
    this.timeout = setTimeout((): void => setDiscussing(true), 450)
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private bubbleRef: React.RefObject<Bubble> = React.createRef()

  private timeout: ReturnType<typeof setTimeout>

  private computeReadingDuration = (): number => {
    const {readingTimeMillisec} = this.props
    if (readingTimeMillisec) {
      return readingTimeMillisec
    }
    const textContent = this.bubbleRef.current && this.bubbleRef.current.getTextContent()
    return textContent && computeSentenceDuration(textContent, 25) || 1000
  }

  public onDone = (): void => {
    const {onDone, setDiscussing} = this.props
    setDiscussing(false)
    onDone && onDone()
    this.setState({isDone: true})
  }

  public render(): React.ReactNode {
    const {children, isClosingConversation, isFastForwarded, isOpeningConversation, isShown,
      onUpdate} = this.props
    return <GrowingPhylactery onDone={this.onDone} {...{isFastForwarded, isShown, onUpdate}}>
      <Bubble
        ref={this.bubbleRef} {...{isClosingConversation, isOpeningConversation}}
        isDone={isFastForwarded || this.state.isDone}>
        {children}
      </Bubble>
      <WaitingElement waitingMillisec={this.computeReadingDuration()} />
    </GrowingPhylactery>
  }
}


// A bubble containing a question asked to the user. Takes a 'isDone' prop to know if the question
// has been answered.
class QuestionBubble extends React.PureComponent<ElementProps & {isDone?: boolean}> {
  public static propTypes = {
    children: PropTypes.node,
    isDone: PropTypes.bool,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    onUpdate: PropTypes.func,
  }

  public render(): React.ReactNode {
    const {children, isDone, isFastForwarded, isShown, onDone, onUpdate} = this.props
    return <GrowingPhylactery {...{isFastForwarded, isShown, onDone, onUpdate}}>
      <NoOpElement>{children}</NoOpElement>
      <WaitingOnDone isDone={isDone} />
    </GrowingPhylactery>
  }
}

export {Discussion, DiscussionBubble, BubbleToRead, NoOpElement, QuestionBubble, WaitingElement}
