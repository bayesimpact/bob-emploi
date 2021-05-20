import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {Link} from 'react-router-dom'
import VisibilitySensor from 'react-visibility-sensor'

import useFastForward from 'hooks/fast_forward'
import {DispatchAllActions, RomeJobGroup, RootState, fetchApplicationModes,
  followJobOffersLinkAction} from 'store/actions'
import {inDepartement, lowerFirstLetter} from 'store/french'
import {prepareT} from 'store/i18n'
import {getApplicationModeText, getApplicationModes,
  getGoogleJobSearchUrl, getPEJobBoardURL} from 'store/job'
import {Score, colorFromPercent, computeBobScore} from 'store/score'
import {useAlwaysConvincePage, useGender} from 'store/user'

import BobScoreCircle from 'components/bob_score_circle'
import Button from 'components/button'
import NewMainChallengesTrain from 'components/challenges_train'
import Trans from 'components/i18n_trans'
import GrowingNumber from 'components/growing_number'
import {CoverImageWithText} from 'components/job_group_cover_image'
import Markdown, {MarkdownRendererProps} from 'components/markdown'
import {useModal} from 'components/modal'
import isMobileVersion from 'store/mobile'
import {ModifyProjectModal} from 'components/navigation'
import {BubbleToRead, BubbleToReadProps, Discussion, DiscussionBubble, NoOpElement,
  WaitingElement} from 'components/phylactery'
import {RadiumExternalLink, SmartLink} from 'components/radium'
import {SignUpBanner} from 'components/pages/signup'
import MainChallengesTrain from 'components/statistics/vertical_main_challenges_train'
import {STATS_PAGE} from 'components/url'
import missingDiplomaImage from 'images/missing-diploma.png'
import strongCompetitionImage from 'images/strong-competition.svg'
import workTimeImage from 'images/50000_hours.png'

import {Strategies} from './strategy'
import BobModal from './speech'


const emptyArray = [] as const


const APPLICATION_MODES_VC_CATEGORIES = new Set([
  'bravo',
  'enhance-methods-to-interview',
  'start-your-search',
])

const defaultDiagnosticSentences = prepareT(
  `Nous ne sommes pas encore capable de vous proposer une
analyse globale de votre situation. Certaines informations sur votre marché ne sont pas encore
disponibles dans notre base de données.

Cependant, vous pouvez déjà consulter les indicateurs ci-contre.

Pour obtenir une analyse de votre profil, vous pouvez nous
envoyer [un message]({{helpRequestUrl}}).

Un membre de l'équipe de {{productName}} vous enverra un diagnostic personnalisé.`,
  {
    helpRequestUrl: config.helpRequestUrl,
    productName: config.productName,
  })


const sideLinkStyle: RadiumCSSProperties = {
  ':hover': {
    backgroundColor: colors.LIGHT_GREY,
  },
  'alignItems': 'center',
  'borderTop': `1px solid ${colors.MODAL_PROJECT_GREY}`,
  'color': colors.SLATE,
  'display': 'flex',
  'fontSize': 14,
  'padding': '15px 20px',
  'textDecoration': 'none',
}


interface SideLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'href' | 'ref'> {
  href?: string
}

const SideLinkBase = (props: SideLinkProps): React.ReactElement|null => {
  const {children, href, ...otherProps} = props
  if (!href) {
    return null
  }
  return <RadiumExternalLink href={href} style={sideLinkStyle} {...otherProps}>
    <div style={{flex: 1}}>{children}</div>
    <ChevronRightIcon size={20} style={{marginRight: -7}} />
  </RadiumExternalLink>
}
SideLinkBase.propTypes = {
  children: PropTypes.node,
  href: PropTypes.string,
}
const SideLink = React.memo(SideLinkBase)


function hasRomeId(jobGroup?: bayes.bob.JobGroup): jobGroup is RomeJobGroup {
  return !!(jobGroup && jobGroup.romeId)
}


type ImageProps = React.ImgHTMLAttributes<HTMLImageElement>
const AltImageBase =
(props: Omit<ImageProps, 'alt'> & {children: string}): React.ReactElement => {
  const {children, ...otherProps} = props
  return <img {...otherProps} alt={children} />
}
const AltImage = React.memo(AltImageBase)


interface VisualCardProps {
  category?: string
  project: bayes.bob.Project
  style?: React.CSSProperties
}


type ApplicationModes = {[fap: string]: bayes.bob.RecruitingModesDistribution}


const BobThinksVisualCardBase = (props: VisualCardProps): React.ReactElement|null => {
  const {category, project, project: {targetJob: {jobGroup = undefined} = {}}, style} = props
  const {romeId} = jobGroup || {}
  const {t} = useTranslation()
  const dispatch = useDispatch()
  const applicationModes = useSelector(
    ({app: {applicationModes = {}}}: RootState): ApplicationModes|undefined =>
      romeId ? applicationModes[romeId] : undefined,
  )

  const isMissingApplicationModes =
    !applicationModes && category && APPLICATION_MODES_VC_CATEGORIES.has(category)
  useEffect((): void => {
    if (isMissingApplicationModes && hasRomeId(jobGroup)) {
      dispatch(fetchApplicationModes(jobGroup))
    }
  }, [dispatch, isMissingApplicationModes, jobGroup])

  // TODO(pascal): Refactor when we have many of those.
  if (category === 'stuck-market') {
    const {yearlyAvgOffersPer10Candidates = undefined} =
      project && project.localStats && project.localStats.imt || {}
    if (!yearlyAvgOffersPer10Candidates) {
      return null
    }
    const offersPerCandidates =
      yearlyAvgOffersPer10Candidates === -1 ? 0 : yearlyAvgOffersPer10Candidates / 10
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      ...style,
    }
    const textStyle: React.CSSProperties = {
      paddingBottom: 20,
      textAlign: 'center',
    }
    const offers = Math.round(20 * offersPerCandidates)
    return <div style={containerStyle}>
      <img alt="" src={strongCompetitionImage} style={{width: '100%'}} />
      <Trans style={textStyle}>
        <div style={{fontSize: 13}}>
          pour {{offers}} offres d'emploi pourvues
        </div>
        <div style={{fontSize: 18, fontWeight: 900}}>
          {{candidates: 20 - offers}} candidats sur 20 restent au chômage
        </div>
      </Trans>
    </div>
  }
  if (category === 'find-what-you-like') {
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      ...style,
    }
    const textStyle: React.CSSProperties = {
      paddingBottom: 20,
      textAlign: 'center',
    }
    return <Trans style={containerStyle}>
      <AltImage src={workTimeImage} style={{padding: '25px 25px 20px', width: '100%'}}>
        50&nbsp;000
      </AltImage>
      <div style={textStyle}>
        <div style={{fontSize: 13}}>
          heures de votre vie
        </div>
        <div style={{fontSize: 18, fontWeight: 900}}>
          seront passées au travail
        </div>
      </div>
    </Trans>
  }
  if (category === 'missing-diploma') {
    return <div style={style}>
      <img
        src={missingDiplomaImage} alt={t('Un diplôme peut faire la différence')}
        style={{width: '100%'}} />
    </div>
  }
  if (category && APPLICATION_MODES_VC_CATEGORIES.has(category)) {
    const {project: {city, targetJob: {jobGroup: {name = ''} = {}} = {}}} = props
    if (!applicationModes) {
      return null
    }
    const [{mode: bestMode = undefined} = {}, ...otherModes] =
      getApplicationModes({applicationModes})
    if (!bestMode || bestMode === 'OTHER_CHANNELS') {
      // We don't know what we can say that would be meaningful here.
      return null
    }
    const {mode: worstMode = undefined} = otherModes[otherModes.length - 1] || {}
    const containerStyle: React.CSSProperties = {
      ...style,
      fontSize: 13,
      padding: '20px 25px',
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 16,
      margin: '0 auto 25px',
      maxWidth: 230,
      textAlign: 'center',
    }
    const itemStyle = (backgroundColor: string): React.CSSProperties => ({
      backgroundColor,
      borderRadius: 4,
      flex: 'none',
      height: 25,
      marginRight: 5,
      width: 34,
    })
    const footnote = !worstMode || worstMode === 'OTHER_CHANNELS' ? '*' : ''
    const footnoteStyle: React.CSSProperties = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontStyle: 'italic',
      marginTop: 25,
      paddingTop: 10,
    }
    // i18next-extract-disable-next-line
    const maybeInDepartement = city && inDepartement(city, t) || t('dans votre département')
    const jobGroupName = lowerFirstLetter(name)
    return <div style={containerStyle}>
      <Trans style={titleStyle} parent="h2">
        Recrutement en {{jobGroupName}} {{maybeInDepartement}}
      </Trans>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 10}}>
        {Array.from({length: 4}, (unused, index): React.ReactNode =>
          <div key={index} style={itemStyle(colors.BOB_BLUE)} />)}
        <span style={{fontWeight: 'bold', marginLeft: 15}}>
          {getApplicationModeText(t, bestMode)}
        </span>
      </div>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 10}}>
        {Array.from({length: 4}, (unused, index): React.ReactNode =>
          <div
            key={index} style={itemStyle(index ? colors.MODAL_PROJECT_GREY : colors.BOB_BLUE)} />)}
        <span style={{marginLeft: 15}}>{getApplicationModeText(t, worstMode)}{footnote}</span>
      </div>
      {footnote ? <div style={footnoteStyle}>
        {footnote}
        {t("Seulement 7 personnes sur 100 trouvent un emploi grâce aux offres d'emploi")}
      </div> : null}
    </div>
  }
  return null
}
BobThinksVisualCardBase.propTypes = {
  category: PropTypes.string,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
    diagnostic: PropTypes.shape({
      categories: PropTypes.arrayOf(PropTypes.shape({
        categoryId: PropTypes.string.isRequired,
      }).isRequired),
    }),
    localStats: PropTypes.shape({
      imt: PropTypes.shape({
        yearlyAvgOffersPer10Candidates: PropTypes.number,
      }),
    }),
    targetJob: PropTypes.shape({
      jobGroup: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
  }),
  style: PropTypes.object,
}
const BobThinksVisualCard = React.memo(BobThinksVisualCardBase)


interface IntroductionProps {
  onClick: () => void
  text?: string
}


const stratIntroContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
}
const introductionStyle: React.CSSProperties = {
  color: colors.SLATE,
  fontSize: 16,
  fontWeight: 'normal',
  lineHeight: 1.5,
  margin: 20,
  maxWidth: 410,
  textAlign: 'center',
}
const stratIntroButtonStyle: React.CSSProperties = {margin: 20}


const StrategiesIntroductionBase: React.FC<IntroductionProps> =
({onClick, text}: IntroductionProps): React.ReactElement => {
  const {t} = useTranslation()
  useFastForward(onClick)
  return <div style={stratIntroContainerStyle}>
    {text ? <div style={introductionStyle}>{text}</div> : null}
    <Button type="validation" onClick={onClick} style={stratIntroButtonStyle}>
      {t('Découvrir mes stratégies')}
    </Button>
  </div>
}
StrategiesIntroductionBase.propTypes = {
  onClick: PropTypes.func.isRequired,
  text: PropTypes.string,
}
const StrategiesIntroduction = React.memo(StrategiesIntroductionBase)


interface ScoreSectionProps {
  maxBarLength?: number
  score: {
    color: string
    percent: number
  }
  strokeWidth?: number
  style?: React.CSSProperties
}


const FlatScoreSectionBase: React.FC<ScoreSectionProps> =
(props: ScoreSectionProps): React.ReactElement => {
  const {maxBarLength = 200, score: {color, percent}, strokeWidth = 4, style} = props
  const [hasStartedGrowing, setHasStartedGrowing] = useState(false)
  const startGrowing = useCallback((isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    setHasStartedGrowing(true)
  }, [])
  const durationMillisec = 1000
  const percentColor = !hasStartedGrowing ? colors.RED_PINK : color
  const containerStyle: React.CSSProperties = useMemo(() => ({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 20px',
    textAlign: 'left',
    ...style,
  }), [style])
  const transitionStyle: React.CSSProperties = useMemo(() => ({
    transition: `stroke ${durationMillisec}ms linear,
      stroke-dashoffset ${durationMillisec}ms linear`,
  }), [durationMillisec])
  const barLength = percent * maxBarLength / 100
  return <VisibilitySensor
    active={!hasStartedGrowing} intervalDelay={250} partialVisibility={true}
    onChange={startGrowing}>
    <div style={containerStyle}>
      <div style={{display: 'flex', flexDirection: 'column', paddingTop: 10}}>
        <div style={{fontSize: 16, fontWeight: 900}}>Score global</div>
        <div style={{width: maxBarLength}}>
          <svg fill="none" viewBox={`0 0 ${maxBarLength} 30`}>
            <g strokeLinecap="round">
              <path
                stroke={colors.SILVER}
                d={`M ${strokeWidth} 10 H ${maxBarLength - strokeWidth}`} opacity={0.8}
                strokeWidth={strokeWidth} />
              <path
                stroke={percentColor}
                style={transitionStyle}
                d={`M ${strokeWidth} 10 H ${percent * maxBarLength / 100}`}
                strokeDashoffset={hasStartedGrowing ? 0 : barLength}
                strokeDasharray={barLength}
                strokeWidth={2 * strokeWidth}
              />
            </g>
          </svg>
        </div>
      </div>
      <div style={{fontSize: 22, fontWeight: 900}}>
        <GrowingNumber durationMillisec={durationMillisec} number={percent} isSteady={true} />%
      </div>
    </div>
  </VisibilitySensor>
}
FlatScoreSectionBase.propTypes = {
  maxBarLength: PropTypes.number,
  score: PropTypes.shape({
    color: PropTypes.string.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  strokeWidth: PropTypes.number,
  style: PropTypes.object,
}
const FlatScoreSection = React.memo(FlatScoreSectionBase)


// A component to even the filling of rows in a text element.
// NOTE: Move to theme if we ever use it elsewhere.
const BalancedTitleBase: React.FC<{children: React.ReactNode}> =
({children}: {children: React.ReactNode}): React.ReactElement => {
  const [lineWidth, setLineWidth] = useState(0)
  const hiddenTitleRef = useRef<HTMLDivElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const updateLineWidth = useCallback((): void => {
    if (!hiddenTitleRef.current || !placeholderRef.current) {
      return
    }
    // Target width is that of in-flow div, which is dom's grand-parent.
    const {clientWidth} = placeholderRef.current
    const totalWidth = hiddenTitleRef.current.clientWidth
    if (!clientWidth || !totalWidth) {
      return
    }
    setLineWidth(totalWidth / Math.ceil(totalWidth / clientWidth))
  }, [])
  // Update the line width until we get a non 0 value.
  const hasLineWidth = !!lineWidth
  useEffect((): (() => void) => {
    if (hasLineWidth) {
      return () => void 0
    }
    const interval = window.setInterval(updateLineWidth, 200)
    return () => {
      window.clearInterval(interval)
    }
  }, [hasLineWidth, updateLineWidth])
  const titleStyle = useMemo((): React.CSSProperties => ({
    margin: '0 auto',
    ...!!lineWidth && {maxWidth: `calc(2em + ${lineWidth}px`},
  }), [lineWidth])
  return <React.Fragment>
    {lineWidth ? null : <div ref={placeholderRef} style={{opacity: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: '300vw'}}>
        <div ref={hiddenTitleRef} style={{position: 'absolute'}}>{children}</div>
      </div>
    </div>}
    <div style={titleStyle}>{children}</div>
  </React.Fragment>
}
const BalancedTitle = React.memo(BalancedTitleBase)


interface BobScoreProps {
  isAnimated?: boolean
  isTitleShown?: boolean
  score: Score
}

const scoreTitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 18 : 25,
  fontWeight: 'bold',
  lineHeight: 1,
  margin: isMobileVersion ? '20px 0 20px 10px' : '0 0 0 40px',
  textAlign: 'center',
}

const ScoreTitleParagraph = (props: React.HTMLProps<HTMLDivElement> & MarkdownRendererProps):
React.ReactElement => {
  const {node: omittedNode, nodeKey: omittedNodeKey, ...divProps} = props
  return <div {...divProps} style={scoreTitleStyle} />
}

const getScoreTitleStrong = _memoize((color: string) =>
  function ScoreTitleStrong(props: React.HTMLProps<HTMLSpanElement> & MarkdownRendererProps):
  React.ReactElement {
    const {node: omittedNode, nodeKey: omittedNodeKey, ...spanProps} = props
    return <span style={{color}} {...spanProps} />
  })

const BobScoreBase: React.FC<BobScoreProps> =
({isAnimated, isTitleShown, score: {color, percent, shortTitle}}): React.ReactElement => {
  const bobCircleProps = isMobileVersion ? {
    halfAngleDeg: 66.7,
    radius: 60,
    scoreSize: 35,
    strokeWidth: 4,
  } : {}
  const bobScoreStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    justifyContent: 'center',
    margin: '0 auto',
    maxWidth: isMobileVersion ? 320 : 470,
  }
  const components = useMemo(() => ({
    p: ScoreTitleParagraph,
    strong: getScoreTitleStrong(color),
  }), [color])
  // TODO(cyrille): Handle isMobileVersion.
  return <div style={bobScoreStyle}>
    <BobScoreCircle
      {...bobCircleProps}
      color={colorFromPercent(percent)}
      style={{flexShrink: 0}}
      percent={percent}
      isAnimated={isAnimated} />
    {isTitleShown ? <Markdown content={shortTitle} components={components} /> : null}
  </div>
}
BobScoreBase.propTypes = {
  isAnimated: PropTypes.bool,
  isTitleShown: PropTypes.bool,
  score: PropTypes.shape({
    color: PropTypes.string,
    percent: PropTypes.number.isRequired,
    shortTitle: PropTypes.string.isRequired,
  }).isRequired,
}
BobScoreBase.defaultProps = {
  isTitleShown: true,
}
const BobScore = React.memo(BobScoreBase)


const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: isMobileVersion ? `solid 2px ${colors.SILVER}` : 'initial',
  borderRadius: 10,
  boxShadow: isMobileVersion ? 'initial' : '0 4px 14px 0 rgba(0, 0, 0, 0.05)',
  margin: isMobileVersion ? 15 : '20px 0',
}


interface ScoreWithHeaderProps {
  baseUrl: string
  isAnimated?: boolean
  openModifyModal: () => void
  project: bayes.bob.Project
  score: Score
}

const scoreHeaderStyle: React.CSSProperties = {
  ...cardStyle,
  backgroundColor: colors.SLATE,
  marginBottom: -100,
  padding: '35px 20px 125px',
  position: 'relative',
  zIndex: -1,
}

const headerJobCoverStyle = {
  zIndex: -1,
}

const jobStyle: React.CSSProperties = {
  fontSize: 18,
}

const cityStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
}

const modifyProjectStyle: RadiumCSSProperties = {
  ':hover': {
    opacity: 1,
  },
  'fontSize': 13,
  'opacity': .7,
  'position': 'absolute',
  'right': 20,
  'textDecoration': 'underline',
  'top': 10,
}

const scoreCardStyle: React.CSSProperties = {
  ...cardStyle,
  alignItems: 'center',
  fontSize: 18,
  fontWeight: 'bold',
  margin: '0 0 30px',
  padding: '45px 25px 20px',
}

const mainSentenceStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 26,
  fontStyle: 'italic',
  lineHeight: '31px',
  margin: '30px 0',
  textAlign: 'center',
}

const statsLinkStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.COOL_GREY,
  display: 'flex',
  fontSize: 13,
  fontWeight: 'bold',
  justifyContent: 'center',
  padding: '15px 0',
  textDecoration: 'none',
}

const separatorStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  marginTop: 15,
}

const ScoreWithHeaderBase: React.FC<ScoreWithHeaderProps> =
  (props: ScoreWithHeaderProps): React.ReactElement => {
    const {baseUrl, isAnimated, openModifyModal, project, score} = props
    const {
      city: {name: cityName = undefined} = {}, diagnostic: {categories = emptyArray} = {},
      targetJob = {}} = project
    const isConvincePageEnabled = useAlwaysConvincePage()
    const gender = useGender()
    const {t} = useTranslation()
    return <React.Fragment>
      <CoverImageWithText
        imageStyle={headerJobCoverStyle}
        style={{...scoreHeaderStyle, ...isConvincePageEnabled ? {marginTop: 0} : {}}}
        {...{cityName, cityStyle, jobStyle, targetJob}}>
        <SmartLink onClick={openModifyModal} style={modifyProjectStyle}>{t('Modifier')}</SmartLink>
      </CoverImageWithText>
      <div style={scoreCardStyle}>
        <BobScore score={score} isTitleShown={false} isAnimated={isAnimated} />
        {/* TODO(sil): Make sure the title is well balanced. */}
        <div style={mainSentenceStyle}>{score.shortTitle}</div>
        {isConvincePageEnabled ? <div style={separatorStyle} /> : <div style={{margin: '0 20px'}}>
          <MainChallengesTrain
            areDetailsShownAsHover={true} mainChallenges={categories} gender={gender} />
          <div style={separatorStyle} />
        </div>}
        <Link to={`${baseUrl}/${STATS_PAGE}`} style={statsLinkStyle}>
          {isConvincePageEnabled ? t('Voir les statistiques') : t('En savoir plus')}
          <ChevronRightIcon size={18} style={{marginLeft: '.2em'}} />
        </Link>
      </div>
    </React.Fragment>
  }
ScoreWithHeaderBase.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  isAnimated: PropTypes.bool,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
    diagnostic: PropTypes.shape({
      categories: PropTypes.arrayOf(PropTypes.shape({
        categoryId: PropTypes.string.isRequired,
      }).isRequired),
    }),
    targetJob: PropTypes.shape({
      jobGroup: PropTypes.shape({
        romeId: PropTypes.string.isRequired,
      }).isRequired,
    }),
  }).isRequired,
  score: PropTypes.shape({
    color: PropTypes.string,
    percent: PropTypes.number.isRequired,
    shortTitle: PropTypes.string.isRequired,
  }).isRequired,
}
const ScoreWithHeader = React.memo(ScoreWithHeaderBase)

const noMarginStyle = {margin: 0}
const NoMarginParagraph = (props: React.HTMLProps<HTMLParagraphElement>): React.ReactElement =>
  <p style={noMarginStyle} {...props} />
const markdownComponents = {p: NoMarginParagraph}


interface DiagnosticTextProps {
  isFirstTime: boolean
  isModal?: boolean
  onClose: () => void
  percent: number
  style?: React.CSSProperties
  text?: string
  title?: string
}


const DiagnosticTextBase = (props: DiagnosticTextProps): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const {
    isFirstTime, isModal, onClose, percent, style, text, title,
  } = props
  const [isFullTextShown, setIsFullTextShown] = useState(false)

  const onTextForward = useCallback((): void => {
    if (isFullTextShown || isModal) {
      onClose()
      return
    }
    setIsFullTextShown(true)
  }, [isFullTextShown, isModal, onClose])

  const handleFullTextShown = useCallback((): void => setIsFullTextShown(true), [])

  useFastForward(onTextForward)

  const sentences = (text || translate(...defaultDiagnosticSentences) || '').split('\n\n')
  const sentencesToDisplay = title ? [title, ...sentences] : sentences
  if (isModal) {
    return <BobModal
      isShown={true} onConfirm={onClose}
      buttonText={t('OK, voir mon diagnostic')}>
      {sentencesToDisplay.join('\n\n')}
    </BobModal>
  }
  const circleAnimationDuration = 1000
  const pageStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 20,
    ...style,
  }
  return <div style={pageStyle}>
    <Discussion
      style={{flex: 1, margin: '0 10px', maxWidth: 400}}
      isOneBubble={true} isFastForwarded={isFullTextShown}
      onDone={handleFullTextShown}>
      <NoOpElement style={{margin: '0 auto 20px'}}>
        <BobScoreCircle
          percent={percent} isAnimated={!isFullTextShown} color={colorFromPercent(percent)}
          durationMillisec={circleAnimationDuration} />
      </NoOpElement>
      <WaitingElement waitingMillisec={circleAnimationDuration * 1.5} />
      <DiscussionBubble>
        {sentencesToDisplay.map((sentence, index): React.ReactElement<BubbleToReadProps> =>
          <BubbleToRead key={index}>
            <Markdown content={sentence} components={markdownComponents} />
          </BubbleToRead>)}
      </DiscussionBubble>
      <NoOpElement style={{margin: '20px auto 0'}}>
        <Button type="validation" onClick={onClose}>
          {isFirstTime ? t('Étape suivante') : t('Revenir au détail')}
        </Button>
      </NoOpElement>
    </Discussion>
  </div>
}
const DiagnosticText = React.memo(DiagnosticTextBase)


interface DiagnosticProps {
  advices?: readonly bayes.bob.Advice[]
  baseUrl: string
  diagnosticData: bayes.bob.Diagnostic
  isFirstTime?: boolean
  makeAdviceLink: (adviceId: string, strategyId: string) => string
  makeStrategyLink: (strategyId: string) => string
  onDiagnosticTextShown?: () => void
  onFullDiagnosticShown?: () => void
  project: bayes.bob.Project
  strategies?: readonly bayes.bob.Strategy[]
  style?: React.CSSProperties
  userName?: string
}


const panelTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 'bold',
  margin: '0 0 15px',
  paddingLeft: isMobileVersion ? 0 : 10,
  textAlign: isMobileVersion ? 'center' : 'initial',
}

const titleCardStyle: React.CSSProperties = {
  ...cardStyle,
  fontSize: 30,
  fontWeight: 900,
  marginBottom: 35,
  padding: '15px 35px',
  textAlign: 'center',
}

const desktopWidth = 600
const DiagnosticBase = (props: DiagnosticProps): React.ReactElement => {
  const {diagnosticData, isFirstTime = false, onDiagnosticTextShown, onFullDiagnosticShown, style,
    userName} = props

  const isConvincePageEnabled = useAlwaysConvincePage()
  const hasAccount = useSelector(({user: {hasAccount}}: RootState): boolean => !!hasAccount)
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchAllActions>()
  const [areStrategiesShown, setAreStrategiesShown] = useState(!isFirstTime)
  const [isDiagnosticTextShown, setIsDiagnosticTextShown] = useState(isFirstTime)
  const [isModifyModalShown, showModifyModal, hideModifyModal] = useModal(false)

  const onShown = isFirstTime ? onDiagnosticTextShown : onFullDiagnosticShown
  useEffect((): void => {
    onShown?.()
  }, [onShown])

  const score = useMemo((): Score => {
    return computeBobScore(diagnosticData, userName, t)
  }, [diagnosticData, userName, t])

  const handleCloseDiagnosticText = useCallback((): void => {
    setIsDiagnosticTextShown(false)
    onFullDiagnosticShown?.()
  }, [onFullDiagnosticShown])

  useEffect((): void => {
    window.scrollTo(0, 0)
  }, [isDiagnosticTextShown])

  const handleOpenStrategies = useCallback((): void => setAreStrategiesShown(true), [])

  const followJobOffersLink = useCallback(
    (): void => void dispatch(followJobOffersLinkAction),
    [dispatch],
  )

  const {text} = diagnosticData
  const {percent, shortTitle, title} = score

  const scoreSectionStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 35,
    textAlign: 'center',
  }
  const introductionContainerStyle: React.CSSProperties = {
    ...cardStyle,
    padding: 15,
  }
  const {strategiesIntroduction} = diagnosticData
  const mobileTopSections = isMobileVersion ? <React.Fragment>
    <div style={scoreSectionStyle}>
      <BalancedTitle><Markdown content={shortTitle} /></BalancedTitle>
      <FlatScoreSection score={score} style={cardStyle} />
    </div>
    {areStrategiesShown ? null : <div style={introductionContainerStyle}>
      <StrategiesIntroduction onClick={handleOpenStrategies} text={strategiesIntroduction} />
    </div>}
  </React.Fragment> : undefined
  const {advices = [], baseUrl, makeAdviceLink, makeStrategyLink, project,
    project: {city, targetJob, originalSelfDiagnostic: {categoryId: selfDiagnostic} = {},
      diagnostic: {categories = emptyArray} = {}}, strategies = emptyArray} = props
  const {categoryId} = diagnosticData
  const isBobTalksModalShown = isDiagnosticTextShown && !isMobileVersion
  if (isDiagnosticTextShown && isMobileVersion) {
    return <DiagnosticText
      onClose={handleCloseDiagnosticText} {...{isFirstTime, percent, style, text, title}} />
  }
  const isSignUpBannerShown = !hasAccount && !isFirstTime
  const adviceProps = _mapValues(
    _keyBy(advices, 'adviceId'),
    ({isForAlphaOnly, status}): bayes.bob.Advice => ({isForAlphaOnly, status}))
  const pageStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: isMobileVersion ? 0 : 50,
  }
  // TODO(pascal): Add mobile version as well.
  const contentStyle: React.CSSProperties = {
    backgroundColor: isMobileVersion ? '#fff' : 'initial',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    justifyContent: 'center',
    paddingBottom: 50,
    paddingTop: 0,
  }

  const jobBoardURL = config.countryId === 'fr' ? getPEJobBoardURL(targetJob, city) :
    getGoogleJobSearchUrl(t, targetJob?.name)
  // TODO(sil): Put a smooth transition when closing the sign up banner.
  return <div style={pageStyle}>
    {isMobileVersion ? null : <ModifyProjectModal
      project={project} isShown={isModifyModalShown}
      onClose={hideModifyModal} />}
    {isSignUpBannerShown ?
      <SignUpBanner style={{margin: '30px 0', width: 1000}} /> : null}
    <div style={contentStyle}>
      {isBobTalksModalShown ? <DiagnosticText
        {...{isFirstTime, percent, style, text, title}} isModal={true}
        onClose={handleCloseDiagnosticText} /> : null}
      {isMobileVersion ? null : <div style={{position: 'relative', width: 360, zIndex: 1}}>
        {isConvincePageEnabled ? null :
          <Trans parent="h2" style={panelTitleStyle}>Votre projet</Trans>}
        <ScoreWithHeader
          openModifyModal={showModifyModal}
          {...{baseUrl, project, score}} isAnimated={isFirstTime} />
        {isConvincePageEnabled ? null : <div style={{...cardStyle, overflow: 'hidden'}}>
          <BobThinksVisualCard category={categoryId} {...{project}} />
          {/* TODO(cyrille): Only hide the link when the footnote is
            actually present in the visual card. */}
          {categoryId && APPLICATION_MODES_VC_CATEGORIES.has(categoryId) ?
            null : <SideLink
              onClick={followJobOffersLink}
              href={jobBoardURL}>
              {t("Voir les offres d'emploi")}
            </SideLink>}
        </div>}
        {/* TODO(pascal): Re-enable PDF */}
      </div>}
      <div style={
        {marginLeft: isMobileVersion ? 0 : 40, width: isMobileVersion ? '100%' : desktopWidth}}>
        {isMobileVersion ? mobileTopSections :
          areStrategiesShown ? null : <React.Fragment>
            <h2 style={{...panelTitleStyle, visibility: 'hidden'}}>Stratégies possibles</h2>
            <div style={titleCardStyle}>
              <StrategiesIntroduction
                onClick={handleOpenStrategies} text={strategiesIntroduction} />
            </div>
          </React.Fragment>}
        {areStrategiesShown ?
          <React.Fragment>
            {isConvincePageEnabled && !isMobileVersion ?
              <div style={{marginBottom: 20}}>
                <NewMainChallengesTrain
                  selfDiagnostic={selfDiagnostic} showSelfDiagnostic={false}
                  mainChallenges={categories} challengeWidth={desktopWidth / categories.length} />
              </div> : null}
            <Strategies {...{adviceProps, makeAdviceLink, makeStrategyLink, project}}
              strategies={strategies} isAnimationEnabled={isFirstTime}
              strategyStyle={cardStyle} titleStyle={panelTitleStyle} />
          </React.Fragment> : null}
      </div>
    </div>
  </div>
}
DiagnosticBase.propTypes = {
  advices: PropTypes.array,
  baseUrl: PropTypes.string.isRequired,
  diagnosticData: PropTypes.object.isRequired,
  isFirstTime: PropTypes.bool,
  makeAdviceLink: PropTypes.func.isRequired,
  makeStrategyLink: PropTypes.func.isRequired,
  onDiagnosticTextShown: PropTypes.func,
  onFullDiagnosticShown: PropTypes.func,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
    diagnostic: PropTypes.shape({
      categories: PropTypes.arrayOf(PropTypes.shape({
        categoryId: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
    localStats: PropTypes.shape({
      imt: PropTypes.shape({
        yearlyAvgOffersPer10Candidates: PropTypes.number,
      }),
    }),
    originalSelfDiagnostic: PropTypes.shape({
      categoryId: PropTypes.string,
    }),
    targetJob: PropTypes.shape({
      jobGroup: PropTypes.shape({
        romeId: PropTypes.string.isRequired,
      }).isRequired,
      name: PropTypes.string,
    }),
  }),
  strategies: PropTypes.array,
  style: PropTypes.object,
  userName: PropTypes.string,
}
const Diagnostic = React.memo(DiagnosticBase)


export {BobThinksVisualCard, Diagnostic}
