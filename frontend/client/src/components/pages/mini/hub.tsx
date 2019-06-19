import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Link, Redirect} from 'react-router-dom'

import {FastForward} from 'components/fast_forward'

import 'styles/fonts/Fredoka/font.css'
import 'styles/fonts/OpenSans/font.css'

import {GenericPage} from './page'
import {Question, QUESTIONS_TREE} from './questions_tree'
import {RootState} from './store'


const isTopicComplete = (answers, topic, questions): boolean =>
  !!answers[topic] && questions.every(({url}): boolean => answers[topic].hasOwnProperty(url))


interface HubCardConnectedProps {
  isComplete: boolean
}


interface HubCardOwnProps {
  color: string
  image: string
  linkTo: string
  questions: Question[]
  style?: React.CSSProperties
  title: React.ReactNode
  topic: string
}


class HubCardBase
  extends React.PureComponent<HubCardOwnProps & HubCardConnectedProps, {isHover: boolean}> {
  public static propTypes = {
    color: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    isComplete: PropTypes.bool.isRequired,
    linkTo: PropTypes.string.isRequired,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
  }

  public state = {isHover: false}

  private handleMouseEnter = (): void => this.setState({isHover: true})

  private handleMouseLeave = (): void => this.setState({isHover: false})

  public render(): React.ReactNode {
    const {color, image, isComplete, linkTo, style, title} = this.props
    const {isHover} = this.state
    const filter = isComplete ? 'saturate(0%) brightness(120%)' : 'initial'
    const cardHeight = 220
    const cardStyle: React.CSSProperties = {
      borderRadius: 15,
      boxShadow: isHover ?
        '0px 10px 15px 0 rgba(0, 0, 0, 0.2)' :
        '0px 2px 5px 0 rgba(0, 0, 0, 0.2)',
      cursor: 'pointer',
      height: cardHeight,
      overflow: 'hidden',
      position: 'relative',
      textAlign: 'center',
      transition: '450ms',
      width: 168,
      ...style,
    }
    const textHeight = 105
    const textStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      bottom: 0,
      color: color || '#000',
      display: 'flex',
      filter,
      fontSize: 15,
      height: textHeight,
      justifyContent: 'center',
      left: 0,
      padding: '0 20px',
      position: 'absolute',
      width: '100%',
      zIndex: 1,
    }
    const backgroundStyle: React.CSSProperties = {
      backgroundColor: color,
      bottom: 0,
      filter,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 0,
    }
    const haloStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: '50%',
      filter: 'blur(20px)',
      height: '70%',
      left: '50%',
      opacity: isHover ? .3 : 0,
      position: 'absolute',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      transition: '450ms',
      width: '70%',
    }
    const curveStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: '100% 100% 0 0',
      height: 30,
      position: 'absolute',
      top: -10,
      width: '120%',
    }
    const pictoStyle: React.CSSProperties = {
      bottom: textStyle.height,
      filter,
      left: '50%',
      maxHeight: cardHeight - textHeight - 20,
      position: 'absolute',
      transform: 'translateX(-50%)',
      width: 155,
      zIndex: 3,
    }
    const shadowStyle: React.CSSProperties = {
      backgroundColor: '#000',
      borderRadius: '100%',
      filter: 'blur(2px)',
      height: 6,
      left: '50%',
      opacity: .1,
      position: 'absolute',
      top: cardHeight - textHeight,
      transform: 'translateX(-50%)',
      width: 59,
      zIndex: 2,
    }
    const borderStyle: React.CSSProperties = {
      border: `solid 4px ${colors.MINI_PEA}`,
      borderRadius: cardStyle.borderRadius,
      bottom: 0,
      left: 0,
      opacity: isHover ? 1 : 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: '450ms',
      zIndex: 4,
    }
    const checkMarkHolderStyle: React.CSSProperties = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      opacity: isComplete ? 1 : 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 5,
    }
    const checkMarkStyle: React.CSSProperties = {
      backgroundColor: colors.MINI_PEA,
      borderRadius: 25,
      color: '#fff',
      height: 50,
      padding: 12,
      width: 50,
    }
    return <Link
      style={cardStyle} onMouseEnter={this.handleMouseEnter}
      onMouseLeave={this.handleMouseLeave} to={linkTo}>
      <div style={backgroundStyle} />
      <div style={haloStyle} />
      <div style={borderStyle} />
      <img style={pictoStyle} src={image} alt="" />
      <div style={shadowStyle} />
      <div style={textStyle}>
        <div style={curveStyle} />
        {title}
      </div>
      <div style={checkMarkHolderStyle}>
        <CheckIcon style={checkMarkStyle} />
      </div>
    </Link>
  }
}
const HubCard = connect(
  (
    {user: {answers}}: RootState,
    {questions = [], topic}: HubCardOwnProps,
  ): {isComplete: boolean} => ({
    isComplete: isTopicComplete(answers, topic, questions),
  }))(HubCardBase)


interface HubPageProps {
  isNextButtonShown: boolean
  nextUrl: string
}


interface HubPageState {
  redirectTo?: string
}


class HubPageBase extends React.PureComponent<HubPageProps, HubPageState> {
  public static propTypes = {
    isNextButtonShown: PropTypes.bool.isRequired,
    nextUrl: PropTypes.string.isRequired,
  }

  public state: HubPageState = {}

  private fastForward = (): void => {
    const {isNextButtonShown, nextUrl} = this.props
    if (!isNextButtonShown || Math.random() > .2) {
      const {firstQuestionUrl} = QUESTIONS_TREE[Math.floor(Math.random() * QUESTIONS_TREE.length)]
      this.setState({redirectTo: `/mini/${firstQuestionUrl || ''}`})
      return
    }
    this.setState({redirectTo: nextUrl})
  }

  private renderTitle(): React.ReactNode {
    const headStyle: React.CSSProperties = {
      color: colors.MINI_PEA,
      fontFamily: 'Fredoka One',
      fontSize: 40,
      fontWeight: 'normal',
      marginBottom: 10,
      marginTop: 40,
    }
    return <div style={{color: colors.MINI_WARM_GREY, fontSize: 19, textAlign: 'center'}}>
      <h1 style={headStyle}>Ma situation</h1>
      <div>Les sujets principaux pour moi sont…</div>
    </div>
  }

  private renderCards(style: React.CSSProperties): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      margin: '30px 0',
      maxWidth: 1024,
      ...style,
    }
    return <div style={containerStyle}>
      {QUESTIONS_TREE.map(({firstQuestionUrl, url, ...cardProps}): React.ReactNode => <HubCard
        key={url} {...cardProps} linkTo={`/mini/${firstQuestionUrl || ''}`}
        style={{margin: 15}} topic={url} />
      )}
    </div>
  }

  private renderBottomButton(): React.ReactNode {
    const {isNextButtonShown, nextUrl} = this.props
    if (!isNextButtonShown) {
      return null
    }
    // TODO(pascal): Combine with the button in question.jsx.
    const buttonStyle = {
      backgroundColor: colors.MINI_PEA,
      borderRadius: 15,
      boxShadow: '0px 10px 15px 0 rgba(0, 0, 0, 0.2)',
      color: colors.MINI_WHITE,
      cursor: 'pointer',
      fontFamily: 'Fredoka One',
      fontSize: 21,
      padding: '15px 70px',
      textDecoration: 'none',
    }
    return <Link style={buttonStyle} to={nextUrl}>
      J'ai fini d'explorer les thèmes
    </Link>
  }

  public render(): React.ReactNode {
    const {redirectTo} = this.state
    if (redirectTo) {
      return <Redirect to={redirectTo} push={true} />
    }
    return <GenericPage bottomButton={this.renderBottomButton()}>
      <FastForward onForward={this.fastForward} />
      {this.renderTitle()}
      {this.renderCards({flex: 1})}
    </GenericPage>
  }
}
const HubPage = connect(({user: {answers}}: RootState): HubPageProps => ({
  isNextButtonShown: QUESTIONS_TREE.some(({questions = [], url: topic}): boolean =>
    isTopicComplete(answers, topic, questions)),
  nextUrl: `/mini/aborder/${QUESTIONS_TREE[0].url}`,
}))(HubPageBase)


export {HubPage}
