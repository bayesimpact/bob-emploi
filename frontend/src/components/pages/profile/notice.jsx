import React from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import config from 'config'

import {setUserProfile} from 'store/actions'

import {FastForward} from 'components/fast_forward'
import {Step} from 'components/pages/profile/step'
import {Button, Colors, RadioGroup} from 'components/theme'
import bobCircleImage from 'images/bob-circle-picto.svg'
import bobHeadImage from 'images/bob-head.svg'


const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, je ne préfère pas', value: false},
]


class CountDown extends React.Component {
  static propTypes = {
    seconds: PropTypes.number.isRequired,
  }

  componentWillMount() {
    this.update(this.props.seconds)
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  update = seconds => {
    this.setState({seconds})
    if (seconds > 0) {
      this.timeout = setTimeout(() => this.update(seconds - 1), 1000)
    }
  }

  render() {
    return <span>{this.state.seconds}</span>
  }
}


const notSameSpeaker = (child1, child2) =>
  !child1.props.isUserSpeaking !== !child2.props.isUserSpeaking


class GrowingPhylactery extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.element.isRequired).isRequired,
    onGrown: PropTypes.func,
    style: PropTypes.shape({
      height: PropTypes.number.isRequired,
    }),
  }

  state = {
    lastShownStep: 0,
  }

  onDone(index) {
    const {children, onGrown} = this.props
    if (index === children.length - 1) {
      return onGrown
    }
    return () => {
      if (this.state.lastShownStep <= index) {
        this.setState({lastShownStep: index + 1})
      }
    }
  }

  onScroll() {
    return event => {
      const {scrollHeight, scrollTop} = event.target
      return this.setState({scrollHeight, scrollTop})
    }
  }

  fastForward = () => {
    const {children} = this.props
    const {lastShownStep} = this.state
    const {isUserSpeaking, fastForward} = children[lastShownStep].props
    if (isUserSpeaking) {
      fastForward && fastForward()
      return
    }
    for (let i = lastShownStep; i < children.length; ++i) {
      if (children[i].props.isUserSpeaking) {
        break
      }
      this.onDone(i)()
    }
  }

  render() {
    const {children, style} = this.props
    const {lastShownStep, scrollHeight, scrollTop} = this.state
    const scrollableStyle = {
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const globalBubbleStyle = {
      display: 'flex',
      flexDirection: 'column-reverse',
      height: '100%',
      // TODO(cyrille): Override default scrollbar.
      overflowY: 'scroll',
    }
    const disappearingStyle = (delta, isAtTop) => ({
      background: `linear-gradient(to ${isAtTop ? 'bottom' : 'top'}, #fff, transparent)`,
      height: isNaN(delta) && !isAtTop ? 0 : delta < 100 ? delta : 100,
      position: 'absolute',
      width: '100%',
      zIndex: 1,
    })

    // WARNING: Children of global bubble div are in reverse order, to allow the presence of a
    // scrollbar.
    return <div style={scrollableStyle}>
      <div style={disappearingStyle(scrollTop, true)} />
      <div style={globalBubbleStyle} onScroll={this.onScroll()}>
        {children.length - 1 === lastShownStep ? null :
          <FastForward onForward={this.fastForward} />}
        {/* TODO(cyrille): Add a '...' when phylactery is still growing.*/}
        {children.map((child, index) => ({child, index})).reverse().map(({child, index}) =>
          React.cloneElement(child, {
            isClosingConversation: index >= lastShownStep ||
              notSameSpeaker(child, children[index + 1]),
            isLatest: index === lastShownStep,
            isOpeningConversation: !index || notSameSpeaker(children[index - 1], child),
            isShown: index <= lastShownStep,
            key: `child-${index}`,
            onDone: this.onDone(index),
            style: {flex: '0 0 auto'},
          })
        )}
      </div>
      <div style={{bottom: 0, ...disappearingStyle(scrollHeight - style.height - scrollTop)}} />
    </div>
  }
}


// TODO(cyrille): Add possibility to have things outside of the bubble.
class PhylacteryElement extends React.Component {
  static propTypes = {
    bubbleStyle: PropTypes.object,
    children: PropTypes.node,
    isClosingConversation: PropTypes.bool,
    isDone: PropTypes.bool,
    isLatest: PropTypes.bool,
    isOpeningConversation: PropTypes.bool,
    isShown: PropTypes.bool,
    isUserSpeaking: PropTypes.bool,
    onDone: PropTypes.func,
    readingTimeMillisec: PropTypes.number,
    style: PropTypes.object,
  }

  componentWillMount() {
    const {isDone, isShown, onDone, readingTimeMillisec} = this.props
    this.prepareToBeDone({}, {isDone, isShown, onDone, readingTimeMillisec})
  }

  componentWillReceiveProps(nextProps) {
    this.prepareToBeDone(this.props, nextProps)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  prepareToBeDone(oldProps, {isDone, isShown, onDone, readingTimeMillisec}) {
    const {isDone: wasDone, isShown: wasShown} = oldProps
    if (!isShown || !onDone) {
      return
    }
    if (!wasDone && isDone) {
      clearTimeout(this.timeout)
      onDone()
      return
    }
    if (!wasShown && readingTimeMillisec) {
      this.timeout = setTimeout(onDone, readingTimeMillisec)
    }
  }

  render() {
    const {
      bubbleStyle,
      children,
      isOpeningConversation,
      isClosingConversation,
      isLatest,
      isShown,
      isUserSpeaking,
      style,
    } = this.props
    const bottomRadius = isClosingConversation ? 25 : 0
    const topRadius = isOpeningConversation ? 25 : 0
    const bobBubbleStyle = {
      background: Colors.NEW_GREY,
      borderRadius: `${topRadius}px ${topRadius}px ${bottomRadius}px ${bottomRadius}px`,
      marginTop: isOpeningConversation && isShown ? 10 : 0,
      overflow: 'hidden',
      transition: 'height,padding 100ms linear',
    }
    const smallBubbleStyle = {
      height: isShown ? 'initial' : 0,
      marginBottom: isShown ? 2 : 0,
      padding: isShown ? '19px 25px 21px' : '0 25px',
      width: 350,
      ...isUserSpeaking ? {} : bobBubbleStyle,
      ...bubbleStyle,
    }
    const bubbleTailStyle = {
      background: Colors.NEW_GREY,
      borderBottomLeftRadius: 20,
      marginLeft: 36,
      marginTop: -smallBubbleStyle.marginBottom,
      minHeight: 20,
      width: 20,
    }

    return <div style={style}>
      <div style={smallBubbleStyle}>{children}</div>
      {!isUserSpeaking && isLatest ? <div style={bubbleTailStyle} /> : null}
    </div>
  }
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
class NoticeStepBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    shouldBobTalk: PropTypes.bool,
    userName: PropTypes.string.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    isNextButtonDisabled: true,
    isNextButtonShown: !this.props.shouldBobTalk,
  }

  componentWillMount() {
    if (!this.props.shouldBobTalk) {
      this.timeout = setTimeout(() => this.setState({isNextButtonDisabled: false}), 3000)
    }
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  handleSubmit = () => {
    const {dispatch, onSubmit} = this.props
    const {canTutoie} = this.state
    dispatch(setUserProfile({canTutoie}, true))
    onSubmit({})
  }

  renderTalkingBob(style) {
    const {userName} = this.props
    const {canTutoie} = this.state
    const userYou = (tu, vous) => canTutoie ? tu : vous
    const boldStyle = {
      color: Colors.BOB_BLUE,
    }
    const mobileButtonStyle = {
      padding: '13px 10px',
      width: 130,
    }
    const buttonStyle = {
      ...this.context.isMobileVersion ? mobileButtonStyle : {},
      alignSelf: 'center',
      marginTop: 20,
      maxWidth: 250,
      padding: '12px 20px 13px',
      visibility: this.state.isNextButtonShown ? 'initial' : 'hidden',
    }
    return <Step style={style}
      fastForward={this.handleSubmit}
      {...this.props}
      nextButtonContent="Commencer le questionnaire">
      <GrowingPhylactery
        style={{height: 400}}
        onGrown={() => this.setState({isNextButtonShown: true})}
      >
        <PhylacteryElement readingTimeMillisec={3000}>
          Bienvenue <strong>{userName}</strong>&nbsp;!
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={6000}>
          Je suis <strong style={boldStyle}>{config.productName}</strong>, votre assistant
          personnel.
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={6000}>
          Ensemble, nous allons accélérer votre future embauche.
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={6000}>
          Avant de commencer et de découvrir votre diagnostic, apprenons à nous connaitre.
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={1000}>
          D'ailleurs, peut-on se tutoyer&nbsp;?
        </PhylacteryElement>
        <PhylacteryElement isUserSpeaking={true} isDone={typeof canTutoie === 'boolean'}
          fastForward={() => this.setState({canTutoie: Math.random() < .5})}>
          <RadioGroup
            onChange={canTutoie => this.setState({canTutoie})}
            options={tutoiementOptions} value={canTutoie} />
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={2000}>
          C'est entendu {userName},
          {userYou(
            ' à partir de maintenant, je vais te tutoyer.',
            ' je continuerai à vous vouvoyer.',
          )}
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={9000}>
          Pour {userYou("t'", 'vous ')}aider du mieux que je peux, j'ai quelques questions
          à {userYou('te', 'vous')} poser sur {userYou('ton', 'votre')} projet, cela prendra
          entre <strong style={boldStyle}>5</strong> et <strong style={boldStyle}>10
          minutes</strong>.
        </PhylacteryElement>
        <PhylacteryElement readingTimeMillisec={100}>
          Si c'est le bon moment pour {userYou('toi', 'vous')}, commençons&nbsp;!
          Clique{userYou('', 'z')} sur le bouton ci-dessous
        </PhylacteryElement>
      </GrowingPhylactery>
      <Button
        isRound={true}
        onClick={this.handleSubmit}
        style={buttonStyle}>
        Commencer le questionnaire
      </Button>
      <img
        src={bobHeadImage} style={{
          alignSelf: 'center',
          margin: '28px 0 60px',
          width: 110,
        }} alt={config.productName} />
    </Step>
  }

  render() {
    const {isNextButtonDisabled} = this.state
    const {shouldBobTalk, userName} = this.props
    if (!shouldBobTalk) {
      const textStyle = {
        color: Colors.CHARCOLAL_GREY_TWO,
        fontSize: 18,
        fontWeight: 'normal',
        lineHeight: '20px',
        marginTop: 33,
        maxWidth: 400,
        textAlign: 'justify',
      }
      return <Step
        title={`Bienvenue ${userName}\u00A0!`}
        fastForward={this.handleSubmit}
        onNextButtonClick={this.handleSubmit}
        {...this.props}
        isNextButtonDisabled={isNextButtonDisabled}
        nextButtonContent={isNextButtonDisabled ?
          <CountDown seconds={3} /> : 'Commencer le questionnaire'}>
        <div style={{margin: 20, textAlign: 'center'}}>
          <img src={bobCircleImage} alt="" />
        </div>
        <div style={textStyle}>
          <p>
            Nous allons vous poser quelques questions sur votre projet,
            cela prendra entre 5 et 10 minutes. Grâce à vos réponses, nous pourrons
            vous proposer des conseils personnalisés.
          </p>
          <p style={{marginTop: '2em'}}>
            Si c'est le bon moment pour vous, commençons&nbsp;!
          </p>
        </div>
      </Step>
    }
    // TODO(cyrille): Handle mobile version more gracefully.
    return this.renderTalkingBob(this.context.isMobileVersion ? {} : {minWidth: 500})
  }
}
const NoticeStep = connect(({user}) => ({
  shouldBobTalk: user.featuresEnabled && user.featuresEnabled.bobTalks === 'ACTIVE',
  userName: user.profile.name,
}))(NoticeStepBase)

export {NoticeStep}
