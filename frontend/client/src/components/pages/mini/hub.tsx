import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'

import {FastForward} from 'components/fast_forward'

import 'styles/fonts/Fredoka/font.css'
import 'styles/fonts/OpenSans/font.css'

import {GenericPage} from './page'
import {Question, QUESTIONS_TREE, TopicId} from './questions_tree'
import {Routes, MiniRootState} from './store'
import {Button} from './theme'


const isTopicComplete = (
  answers: MiniRootState['user']['answers'], topic: TopicId, questions: readonly Question[],
): boolean =>
  !!answers[topic] &&
  questions.every(({url}): boolean => Object.prototype.hasOwnProperty.call(answers[topic], url))


const cardHeight = 220
const cardTextHeight = 105
const curveStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '100% 100% 0 0',
  height: 30,
  position: 'absolute',
  top: -10,
  width: '120%',
}
const shadowStyle: React.CSSProperties = {
  backgroundColor: '#000',
  borderRadius: '100%',
  filter: 'blur(2px)',
  height: 6,
  left: '50%',
  opacity: .1,
  position: 'absolute',
  top: cardHeight - cardTextHeight,
  transform: 'translateX(-50%)',
  width: 59,
  zIndex: 2,
}
const checkMarkStyle: React.CSSProperties = {
  backgroundColor: colors.MINI_PEA,
  borderRadius: 25,
  color: '#fff',
  height: 50,
  padding: 12,
  width: 50,
}


interface HubCardConnectedProps {
  isComplete: boolean
}


interface HubCardOwnProps {
  color: string
  image: string
  linkTo: string
  questions: readonly Question[]
  style?: React.CSSProperties
  title: React.ReactNode
  topic: TopicId
}


type HubCardProps = HubCardOwnProps & HubCardConnectedProps


const HubCardBase: React.FC<HubCardProps> = (props: HubCardProps): React.ReactElement => {
  const {color, image, isComplete, linkTo, style, title} = props
  const [isHover, setIsHover] = useState(false)

  const handleMouseEnter = useCallback((): void => setIsHover(true), [])
  const handleMouseLeave = useCallback((): void => setIsHover(false), [])

  const filter = isComplete ? 'saturate(0%) brightness(120%)' : 'initial'
  const cardStyle = useMemo((): React.CSSProperties => ({
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
  }), [isHover, style])
  const textStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: '#fff',
    bottom: 0,
    color: color || '#000',
    display: 'flex',
    filter,
    fontSize: 15,
    height: cardTextHeight,
    justifyContent: 'center',
    left: 0,
    padding: '0 20px',
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  }), [color, filter])
  const pictoStyle = useMemo((): React.CSSProperties => ({
    bottom: textStyle.height,
    filter,
    left: '50%',
    maxHeight: cardHeight - cardTextHeight - 20,
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 155,
    zIndex: 3,
  }), [filter, textStyle.height])
  const backgroundStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: color,
    bottom: 0,
    filter,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  }), [color, filter])
  const haloStyle = useMemo((): React.CSSProperties => ({
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
  }), [isHover])
  const borderStyle = useMemo((): React.CSSProperties => ({
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
  }), [cardStyle.borderRadius, isHover])
  const checkMarkHolderStyle = useMemo((): React.CSSProperties => ({
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
  }), [isComplete])
  return <Link
    style={cardStyle} onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave} to={linkTo}>
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
HubCardBase.propTypes = {
  color: PropTypes.string.isRequired,
  image: PropTypes.string.isRequired,
  isComplete: PropTypes.bool.isRequired,
  linkTo: PropTypes.string.isRequired,
  style: PropTypes.object,
  title: PropTypes.node.isRequired,
}
const HubCard = connect(
  (
    {user: {answers}}: MiniRootState,
    {questions = [], topic}: HubCardOwnProps,
  ): {isComplete: boolean} => ({
    isComplete: isTopicComplete(answers, topic, questions),
  }))(React.memo(HubCardBase))


interface HubPageConnectedProps {
  isNextButtonShown: boolean
  nextUrl: string
  orgInfo?: string
}


const orgStyle: React.CSSProperties = {
  left: 20,
  position: 'absolute',
  top: 120,
}
const titleStyle: React.CSSProperties = {
  color: colors.MINI_WARM_GREY,
  fontSize: 19,
  textAlign: 'center',
}
const pageHeadStyle: React.CSSProperties = {
  color: colors.MINI_PEA,
  fontFamily: 'Fredoka One',
  fontSize: 40,
  fontWeight: 'normal',
  marginBottom: 10,
  marginTop: 40,
}
const cardsContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: 1,
  flexWrap: 'wrap',
  justifyContent: 'center',
  margin: '30px 0',
  maxWidth: 1024,
  position: 'relative',
  zIndex: 0,
}
const betweenCardStyle: React.CSSProperties = {margin: 15}

const HubPageBase: React.FC<HubPageConnectedProps> =
(props: HubPageConnectedProps): React.ReactElement => {
  const {isNextButtonShown, nextUrl, orgInfo} = props

  const redirectTo = useMemo((): string => {
    if (!isNextButtonShown || Math.random() > .2) {
      const {firstQuestionUrl} = QUESTIONS_TREE[Math.floor(Math.random() * QUESTIONS_TREE.length)]
      return firstQuestionUrl || ''
    }
    return nextUrl
  }, [isNextButtonShown, nextUrl])

  const bottomButton = useMemo((): React.ReactNode => {
    if (!isNextButtonShown) {
      return null
    }
    return <Button to={nextUrl}>J'ai fini d'explorer les thèmes</Button>
  }, [isNextButtonShown, nextUrl])

  return <GenericPage hasLogo={true} bottomButton={bottomButton}>
    <FastForward to={redirectTo} />
    <div style={titleStyle}>
      <h1 style={pageHeadStyle}>Ma situation</h1>
      <div>Les sujets principaux pour moi sont…</div>
    </div>
    <Button style={orgStyle} isSmall={true} to={Routes.LANDING_PAGE} type="discreet">
      {orgInfo}
    </Button>
    <div style={cardsContainerStyle}>
      {QUESTIONS_TREE.map(({firstQuestionUrl, url, ...cardProps}): React.ReactNode => <HubCard
        key={url} {...cardProps} linkTo={firstQuestionUrl || Routes.HUB_PAGE}
        style={betweenCardStyle} topic={url} />,
      )}
    </div>
  </GenericPage>
}
HubPageBase.propTypes = {
  isNextButtonShown: PropTypes.bool.isRequired,
  nextUrl: PropTypes.string.isRequired,
  orgInfo: PropTypes.string,
}
const HubPage = connect(
  ({app: {orgInfo: {advisor, departement, email, milo}}, user: {answers}}: MiniRootState):
  HubPageConnectedProps => ({
    isNextButtonShown: QUESTIONS_TREE.some(({questions = [], url: topic}): boolean =>
      isTopicComplete(answers, topic, questions)),
    nextUrl: `/aborder/${QUESTIONS_TREE[0].url}`,
    orgInfo: advisor || email || milo || departement || 'Informations conseiller',
  }))(React.memo(HubPageBase))


export {HubPage}
