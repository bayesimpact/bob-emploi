import React, {useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {getTranslatedMainChallenges} from 'store/main_challenges'
import isMobileVersion from 'store/mobile'
import {CHALLENGE_RELEVANCE_COLORS, NO_CHALLENGE_CATEGORY_ID} from 'store/project'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import Emoji from 'components/emoji'
import {Modal, useModal} from 'components/modal'

import type {ConfigColor} from 'config'

const ICON_SIZE = 24
const CHALLENGE_WIDTH = isMobileVersion ? 100 : 95
const BUBBLE_MAX_WIDTH = 100
const MIN_BUBBLES_MARGIN = 10

const TAIL_HALF_WIDTH = 10

interface MainChallengeDetailModalProps {
  emoji?: string
  hideModal: () => void
  isShown: boolean
  metricDetails?: string
  metricTitle?: string
}

const modalStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 15 : 19,
  margin: isMobileVersion ? 20 : 10,
  padding: isMobileVersion ? 30 : 50,
}
const modalContentStyle: React.CSSProperties = {
  maxWidth: 250,
}
const modalTitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 22 : 35,
  margin: '0 0 10px',
  textAlign: 'center',
}
const modalIconSize = 62
const modalIconStyle: React.CSSProperties = {
  border: `1px solid ${colors.PINKISH_GREY_THREE}`,
  borderRadius: modalIconSize / 2,
  fontSize: 14,
  height: modalIconSize,
  lineHeight: `${modalIconSize - 2}px`,
  margin: '20px auto',
  padding: 10,
  position: 'relative',
  textAlign: 'center',
  width: modalIconSize,
}
const modalDetailStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 15,
  textAlign: 'center',
}
const modalButtonStyle: React.CSSProperties = {
  display: 'block',
  margin: '50px auto 20px',
}
const MainChallengeDetailModalBase = (props: MainChallengeDetailModalProps): React.ReactElement => {
  const {emoji = '', hideModal, isShown, metricDetails = '', metricTitle = ''} = props
  const {t} = useTranslation('components')
  return <Modal {...{isShown}} style={modalStyle}>
    <div style={modalContentStyle}>
      <h2 style={modalTitleStyle}>{metricTitle}</h2>
      <div style={modalIconStyle}>{emoji ? <Emoji size={40}>{emoji}</Emoji> : null}</div>
      <div style={modalDetailStyle}>{metricDetails}</div>
      <Button onClick={hideModal} style={modalButtonStyle}>{t("OK, j'ai compris")}</Button>
    </div>
  </Modal>
}
const MainChallengeDetailModal = React.memo(MainChallengeDetailModalBase)


interface BubbleProps {
  children: string
  color: ConfigColor
  style?: React.CSSProperties
  tailAlign?: number
}
const BubbleBase = (props: BubbleProps, ref: React.Ref<HTMLDivElement>) => {
  const {children, color, style, tailAlign} = props
  const containerStyle: React.CSSProperties = {
    display: 'inline-block',
    maxWidth: BUBBLE_MAX_WIDTH,
    position: 'relative',
  }
  const bubbleBodyStyle: React.CSSProperties = {
    backgroundColor: color,
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    lineHeight: 1.4,
    padding: 8,
    textAlign: 'center',
  }
  const bubbleTailStyle: React.CSSProperties = {
    borderLeft: `${TAIL_HALF_WIDTH}px solid transparent`,
    borderRight: `${TAIL_HALF_WIDTH}px solid transparent`,
    borderTop: `${TAIL_HALF_WIDTH}px solid ${color}`,
    height: 0,
    margin: '0 auto 0',
    transform: `translateX(${tailAlign}px)`,
    width: 0,
  }
  return <div style={{...containerStyle, ...style}} ref={ref}>
    <div style={bubbleBodyStyle}>{children}</div>
    <div style={bubbleTailStyle} />
  </div>
}
const Bubble = React.memo(React.forwardRef(BubbleBase))

const computeMargin = (leftDiv: HTMLDivElement, rightDiv: HTMLDivElement) =>
  rightDiv.offsetLeft - (leftDiv.offsetLeft + leftDiv.offsetWidth)

interface BubblesProps {
  challengeWidth: number
  mainChallenges: readonly bayes.bob.DiagnosticMainChallenge[]
  selfDiagnostic?: string
  showSelfBubble?: boolean
}
const BubblesBase = (props: BubblesProps) => {
  const {t} = useTranslation('components')
  const {challengeWidth, mainChallenges, selfDiagnostic, showSelfBubble = true} = props
  const mainChallenge = mainChallenges.
    findIndex(({relevance}) => relevance === 'NEEDS_ATTENTION')
  const userChallenge = mainChallenges.
    findIndex(({categoryId}) => categoryId === selfDiagnostic)
  const bobRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const isBobAfter = mainChallenge > userChallenge
  // The margin needed on Bob's bubble to avoid overlap with the user's bubble.
  const [bubblesDelta, setBubblesDelta] = useState<number>(0)
  useEffect(() => {
    if (!bobRef.current || !userRef.current) {
      return
    }
    const margin = isBobAfter ? computeMargin(userRef.current, bobRef.current) :
      computeMargin(bobRef.current, userRef.current)
    if (margin >= MIN_BUBBLES_MARGIN) {
      return
    }
    setBubblesDelta((MIN_BUBBLES_MARGIN - margin) / 2)
  }, [isBobAfter])
  const hasSameBubble = userChallenge === mainChallenge
  const isBobBravo = mainChallenges[mainChallenge]?.categoryId === NO_CHALLENGE_CATEGORY_ID
  const hasUserBubble = showSelfBubble && userChallenge >= 0 && !hasSameBubble &&
    selfDiagnostic !== NO_CHALLENGE_CATEGORY_ID
  const bobBubbleStyle: React.CSSProperties = {
    left: (mainChallenge + (isBobBravo ? .1 : .5)) * challengeWidth +
      bubblesDelta * (isBobAfter ? 1 : -1),
    ...isBobBravo ? {maxWidth: 1.1 * BUBBLE_MAX_WIDTH} : {},
    transform: 'translateX(-50%)',
  }
  const userBubbleStyle: React.CSSProperties = {
    bottom: 0,
    left: (.5 + userChallenge) * challengeWidth + bubblesDelta * (isBobAfter ? -1 : 1),
    position: 'absolute',
    transform: 'translateX(-50%)',
  }
  const bobText = isBobBravo ?
    t('Selon {{productName}}, vous êtes proche\u00A0!', {productName: config.productName}) :
    hasSameBubble ? t('Votre priorité 💪') :
      t('Votre priorité selon {{productName}}', {productName: config.productName})
  return <div style={{position: 'relative'}}>
    <Bubble
      tailAlign={bubblesDelta * (isBobAfter ? -1 : 1)} ref={bobRef}
      style={bobBubbleStyle} color={colors.BOB_BLUE}>
      {bobText}
    </Bubble>
    {hasUserBubble ? <Bubble
      tailAlign={bubblesDelta * (isBobAfter ? 1 : -1)} ref={userRef}
      style={userBubbleStyle} color={colors.DARK_TWO}>
      {t('Selon vous')}
    </Bubble> : null}
  </div>
}
const Bubbles = React.memo(BubblesBase)

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  textAlign: 'center',
  textTransform: 'uppercase',
}
interface WagonProps extends ValidMainChallenge {
  challengeWidth: number
  children?: never
  style?: React.CSSProperties
}

const WagonBase = (props: WagonProps): React.ReactElement => {
  const {t} = useTranslation('components')
  const isBravo = props.categoryId === NO_CHALLENGE_CATEGORY_ID
  const {
    challengeWidth,
    emoji = isBravo ? '🚀' : '',
    metricDetails,
    metricTitle = isBravo ? t('Emploi') : '',
    relevance = 'UNKNOWN_RELEVANCE',
    style,
  } = props
  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flex: 'none',
    flexDirection: 'column',
    padding: '10px 6px',
    textAlign: 'center',
    width: challengeWidth,
    ...style,
  }
  const bravoIconStyle : React.CSSProperties = {
    alignItems: 'center',
    border: `1px solid ${isBravo ? 'transparent' : colors.PINKISH_GREY_THREE}`,
    borderRadius: ICON_SIZE / 2,
    display: 'flex',
    height: ICON_SIZE,
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
    width: ICON_SIZE,
  }
  const iconStyle: React.CSSProperties = {
    ...bravoIconStyle,
    backgroundColor: colors.PALE_GREY,
    cursor: 'pointer',
    margin: '0 auto 10px',
  }
  const challengeStatusStyle: React.CSSProperties = {
    backgroundColor: CHALLENGE_RELEVANCE_COLORS[relevance],
    border: '1px solid #fff',
    borderRadius: 5,
    bottom: -1,
    height: 10,
    position: 'absolute',
    right: -1,
    width: 10,
  }
  const buttonStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  }
  const [isModalShown, showModal, hideModal] = useModal()
  if (isBravo) {
    return <li style={containerStyle}>
      <div style={bravoIconStyle}>
        <Emoji size={14}>{emoji}</Emoji>
      </div>
      <header style={titleStyle}>{metricTitle}</header>
    </li>
  }
  return <li style={containerStyle}>
    <MainChallengeDetailModal
      isShown={isModalShown} hideModal={hideModal} emoji={emoji} metricDetails={metricDetails}
      metricTitle={metricTitle} />
    <button style={buttonStyle} onClick={showModal} type="button">
      <span style={iconStyle}>
        <Emoji size={14}>{emoji}</Emoji>
        <span style={challengeStatusStyle} />
      </span>
      <span style={titleStyle}>{metricTitle}</span>
    </button>
  </li>
}
const Wagon = React.memo(WagonBase)

const containerStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_BLUE,
  borderRadius: 10,
  padding: isMobileVersion ? '25px 35px' : '25px 0',
}
interface Props {
  mainChallenges: readonly bayes.bob.DiagnosticMainChallenge[]
  challengeWidth?: number
  gender?: bayes.bob.Gender
  selfDiagnostic?: string
  showSelfDiagnostic?: boolean
  style?: React.CSSProperties
}

const MainChallengesTrain = (props: Props): React.ReactElement => {
  const {mainChallenges, challengeWidth = CHALLENGE_WIDTH, gender, selfDiagnostic,
    showSelfDiagnostic, style} = props
  const {t} = useTranslation('components')
  const challengesData = getTranslatedMainChallenges(t, gender)
  let hasMainChallenge = false
  const challengesWithData = mainChallenges.
    filter((challenge): challenge is ValidMainChallenge => !!challenge.categoryId).
    map(({categoryId, relevance, ...challenge}): WagonProps => {
      const isMainChallenge = !hasMainChallenge && relevance === 'NEEDS_ATTENTION'
      const isRealChallenge = isMainChallenge && categoryId !== NO_CHALLENGE_CATEGORY_ID
      if (isMainChallenge) {
        hasMainChallenge = true
      }
      return {
        categoryId,
        challengeWidth,
        relevance,
        style: {color: isRealChallenge ? colors.RED_PINK :
          hasMainChallenge ? colors.COOL_GREY : 'initial'},
        ...challengesData[categoryId],
        ...challenge,
      }
    })
  const railStyle: React.CSSProperties = {
    backgroundColor: colorToAlpha(colors.BOB_BLUE, .2),
    borderRadius: 2,
    height: 4,
    left: challengeWidth / 2,
    position: 'absolute',
    top: 20,
    width: (challengesWithData.length - 1.3) * challengeWidth,
  }
  return <div style={{...containerStyle, ...style}}>
    <Bubbles
      mainChallenges={challengesWithData} selfDiagnostic={selfDiagnostic}
      challengeWidth={challengeWidth} showSelfBubble={showSelfDiagnostic} />
    <div style={{position: 'relative'}}><div style={railStyle} /></div>
    <ul style={{display: 'flex', listStyle: 'none', margin: 0, padding: 0}}>
      {challengesWithData.map(challenge =>
        <Wagon {...challenge} key={challenge.categoryId} challengeWidth={challengeWidth} />)}
    </ul>
  </div>
}

export default React.memo(MainChallengesTrain)
