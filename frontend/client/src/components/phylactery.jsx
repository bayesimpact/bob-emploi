import PropTypes from 'prop-types'
import React from 'react'

import {FastTransitions} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


const computeSentenceDuration = (sentence, characterDuration) => characterDuration * sentence.length

// A Component with the mechanism for making elements appear one after the other. It's children are
// each given props 'isShown' and 'onDone'. 'isShown' tells the child component if it should appear.
// 'onDone' should be called once the next child should be shown. A GrowingPhylactery can be child
// of another one, so it also has 'isShown' and 'onDone' as props.
class GrowingPhylactery extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    onUpdate: PropTypes.func,
    setDiscussing: PropTypes.func,
  }

  static defaultProps = {
    isShown: true,
  }

  state = {
    lastShownStep: -1,
  }

  static getDerivedStateFromProps({children, isFastForwarded, isShown}, {lastShownStep}) {
    if (isFastForwarded) {
      return {lastShownStep: children.length}
    }
    if (isShown && lastShownStep < 0) {
      return {lastShownStep: 0}
    }
    return null
  }

  componentDidUpdate({isFastForwarded: alreadyDone}) {
    const {isFastForwarded, onDone, onUpdate} = this.props
    if (!alreadyDone && isFastForwarded) {
      onUpdate && onUpdate()
      onDone && onDone()
    }
  }

  getOnChildDoneHandler(index) {
    const {children, onDone, onUpdate} = this.props
    if (index === children.length - 1) {
      return () => {
        onUpdate && onUpdate()
        onDone && onDone()
      }
    }
    return () => {
      if (this.state.lastShownStep <= index) {
        this.setState({lastShownStep: index + 1}, onUpdate)
      }
    }
  }

  render() {
    const {children, isFastForwarded, onUpdate, setDiscussing} = this.props
    const {lastShownStep} = this.state
    // WARNING: Children of global bubble div are in reverse order, to allow the presence of a
    // scrollbar.
    return <React.Fragment>
      {children.map((child, index) => ({child, index})).reverse().map(({child, index}) =>
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
class DiscussionBubble extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
  }

  render() {
    const {children, ...otherProps} = this.props
    return <GrowingPhylactery {...otherProps}>
      {children.map((child, index) => React.cloneElement(child, {
        isClosingConversation: index === children.length - 1,
        isOpeningConversation: !index,
        key: index,
      }))}
    </GrowingPhylactery>
  }
}


// A Component containing a growing phylactery. This allows to have scrolling with stuck-at-bottom
// and disappearing top and bottom in a fixed height setting.
class Discussion extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    headWidth: PropTypes.number,
    isFastForwarded: PropTypes.bool,
    isOneBubble: PropTypes.bool,
    style: PropTypes.object,
  }

  state = {
    isDiscussing: false,
  }

  scrollSticker = React.createRef()

  render() {
    const {children, headWidth = 75, isFastForwarded, isOneBubble, style,
      ...otherProps} = this.props
    const {isDiscussing} = this.state
    const scrollableStyle = {
      display: 'flex',
      flexDirection: 'column-reverse',
      paddingBottom: 20,
      ...style,
    }
    const ellipsisStyle = {
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
        setDiscussing={bool => this.setState({isDiscussing: bool})}
        onUpdate={() => this.scrollSticker.current.stick()}>
        {children}
      </Container>
    </div>
  }
}


// A pseudo-component that keeps the document's main scroll to the bottom except if
// the user manually changes the scroll.
class BottomScrollSticker extends React.Component {
  state = {
    isStuckToBottom: true,
  }

  componentDidMount() {
    this.interval = setInterval(this.maybeScrollDown, 100)
    document.addEventListener('scroll', this.onScroll)
  }

  componentWillUnmount() {
    document.removeEventListener('scroll', this.onScroll)
    clearInterval(this.interval)
  }

  stick() {
    if (!this.state.isStuckToBottom) {
      this.setState({isStuckToBottom: true})
      this.scrollDown()
    }
  }

  maybeScrollDown = () => {
    if (!this.state.isStuckToBottom) {
      return
    }
    this.scrollDown()
  }

  scrollDown() {
    window.scrollTo(0, document.body.scrollHeight)
  }

  onScroll = () => {
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

  render() {
    return null
  }
}


// A growing phylactery element whose children are only shown for a given duration, to make the
// user wait before the next element is shown.
class WaitingElement extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    waitingMillisec: PropTypes.number.isRequired,
  }

  state = {
    isShown: true,
  }

  componentDidUpdate({isShown: wasShown}) {
    if (wasShown || !this.props.isShown) {
      return
    }
    const {onDone, waitingMillisec} = this.props
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      onDone && onDone()
      this.setState({isShown: false})
    }, waitingMillisec)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  render() {
    const {children, isFastForwarded, isShown} = this.props
    if (isFastForwarded || !isShown || !this.state.isShown) {
      return null
    }
    return children || null
  }
}


// A '...' to let time for the user to read the previous bubble in a growing phylactery.
class Ellipsis extends React.Component {
  static propTypes = {
    bulletMargin: PropTypes.number.isRequired,
    bulletSize: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  static defaultProps = {
    bulletMargin: 5,
    bulletSize: 12,
  }

  render() {
    const {bulletMargin, bulletSize, style: externalStyle} = this.props
    const bulletColors = [0.1, 0.2, 0.4].map(alpha => `rgba(0, 0, 0, ${alpha})`)
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
    const bulletStyle = (backgroundColor, delay) => ({
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
      {bulletColors.map((color, index) => <div key={color} style={bulletStyle(color, index)} />)}
    </div>
  }
}


// A growing phylactery element which does not render anything but waits for some condition to let
// the phylactery continue growing.
class WaitingOnDone extends React.Component {
  static propTypes = {
    isDone: PropTypes.bool,
    isFastForwarded: PropTypes.bool,
    onDone: PropTypes.func,
  }

  componentDidMount() {
    this.componentDidUpdate({})
  }

  componentDidUpdate({isDone: wasDone}) {
    const {isDone, isFastForwarded, onDone} = this.props
    if (isFastForwarded || (isDone && !wasDone)) {
      onDone && onDone()
    }
  }

  render() {
    return null
  }
}


class NoOpElement extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    style: PropTypes.object,
  }

  componentDidMount() {
    this.componentDidUpdate({})
  }

  componentDidUpdate({isShown: wasShown}) {
    const {isShown, onDone} = this.props
    if (isShown && !wasShown) {
      onDone && onDone()
    }
  }

  render() {
    const {children, isShown, style} = this.props
    const containerStyle = {
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


// A growing phylactery element which is shown as a bubble, or part of a bubble, depending on
// whether it's grouped in a DiscussionBubble. It is considered done as soon as shown.
class Bubble extends React.Component {
  static propTypes = {
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

  static defaultProps = {
    isClosingConversation: true,
    isOpeningConversation: true,
  }

  componentDidMount() {
    this.componentDidUpdate({})
  }

  componentDidUpdate({isShown: wasShown}) {
    const {isShown, onDone} = this.props
    if (isShown && !wasShown) {
      onDone && onDone()
    }
  }

  contentRef = React.createRef()

  getTextContent() {
    return this.contentRef.current && this.contentRef.current.textContent || ''
  }

  render() {
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

// A bubble spoken by Bob, so it gives the user some time to read.
class BubbleToRead extends React.Component {
  static propTypes = {
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

  static defaultProps = {
    setDiscussing: () => {},
  }

  state = {
    isDone: false,
  }

  componentDidMount() {
    this.componentDidUpdate({})
  }

  componentDidUpdate({isShown: wasShown}) {
    const {isFastForwarded, isShown, setDiscussing} = this.props
    if (!isShown || wasShown) {
      return
    }
    if (isFastForwarded || this.computeReadingDuration() < 450) {
      return
    }
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => setDiscussing(true), 450)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  bubbleRef = React.createRef()

  computeReadingDuration = () => {
    const {readingTimeMillisec} = this.props
    if (readingTimeMillisec) {
      return readingTimeMillisec
    }
    const textContent = this.bubbleRef.current && this.bubbleRef.current.getTextContent()
    return textContent && computeSentenceDuration(textContent, 25) || 1000
  }

  onDone = () => {
    const {onDone, setDiscussing} = this.props
    setDiscussing(false)
    onDone && onDone()
    this.setState({isDone: true})
  }

  render() {
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
class QuestionBubble extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isDone: PropTypes.bool,
    isFastForwarded: PropTypes.bool,
    isShown: PropTypes.bool,
    onDone: PropTypes.func,
    onUpdate: PropTypes.func,
  }

  render() {
    const {children, isDone, isFastForwarded, isShown, onDone, onUpdate} = this.props
    return <GrowingPhylactery {...{isFastForwarded, isShown, onDone, onUpdate}}>
      <NoOpElement>{children}</NoOpElement>
      <WaitingOnDone isDone={isDone} />
    </GrowingPhylactery>
  }
}

export {Discussion, DiscussionBubble, BubbleToRead, NoOpElement, QuestionBubble, WaitingElement}
