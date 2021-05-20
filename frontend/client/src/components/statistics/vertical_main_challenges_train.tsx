// TODO(pascal): Consider dropping this component in favor of components/challenges_train.
import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import InformationOutlineIcon from 'mdi-react/InformationOutlineIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {getTranslatedMainChallenges} from 'store/i18n'
import {CHALLENGE_RELEVANCE_COLORS, NO_CHALLENGE_CATEGORY_ID} from 'store/project'

import {colorToAlpha} from 'components/colors'
import Trans from 'components/i18n_trans'
import Tag from 'components/tag'
import UpDownIcon from 'components/up_down_icon'


interface LineProps {
  style?: React.CSSProperties
  type: 'arrow' | 'dash'
}

const arrowEndStyle = {
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: `9px solid ${colors.MODAL_PROJECT_GREY}`,
  margin: 'auto',
  width: 4,
} as const

const WagonLineBase = ({style, type}: LineProps): React.ReactElement => {
  const isDash = type === 'dash'
  const containerStyle: React.CSSProperties = {
    marginLeft: isDash ? 9 : 5,
    position: 'absolute',
    ...style,
  }
  const lineStyle: React.CSSProperties = {
    border: `1px ${isDash ? 'dashed' : 'solid'} ${colors.MODAL_PROJECT_GREY}`,
    height: isDash ? 30 : 20,
    margin: 'auto',
    width: 0,
  }
  return <div style={containerStyle}>
    <div style={lineStyle} />{isDash ? null : <div style={arrowEndStyle} />}
  </div>
}
const WagonLine = React.memo(WagonLineBase)

interface WagonDetailsProps {
  children: React.ReactNode
}

const toggleStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.COOL_GREY,
  display: 'flex',
  fontSize: 11,
  fontStyle: 'italic',
}

const hoveredDetailsStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  left: 250,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 230,
  zIndex: 1,
}

const bubbleTailStyle: React.CSSProperties = {
  borderBottom: '15px solid transparent',
  borderRight: `10px solid ${colors.DARK_TWO}`,
  borderTop: '15px solid transparent',
  height: 0,
  width: 0,
}

const hoveredDetailsBubbleStyle: React.CSSProperties = {
  backgroundColor: colors.DARK_TWO,
  borderRadius: 13,
  boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
  color: '#fff',
  fontWeight: 'bold',
  padding: '20px 25px',
}

const WagonDetailsHoverBase: React.FC<WagonDetailsProps> = ({children}): React.ReactElement => {
  return <div style={hoveredDetailsStyle}>
    <div style={bubbleTailStyle} />
    <div style={hoveredDetailsBubbleStyle}>{children}</div>
  </div>
}
WagonDetailsHoverBase.propTypes = {
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
}
const WagonDetailsHover = React.memo(WagonDetailsHoverBase)


const WagonDetailsBase: React.FC<WagonDetailsProps> = ({children}): React.ReactElement => {
  const [isExpanded, setIsExpanded] = useState(false)
  const toggleExpanded = useCallback(
    () => setIsExpanded((wasExpanded): boolean => !wasExpanded), [])
  const {t} = useTranslation()
  return <div style={{fontWeight: 'normal'}}>
    {isExpanded ? <div style={{padding: '10px 0'}}>{children}</div> : null}
    <button style={toggleStyle} onClick={toggleExpanded}>
      {isExpanded ? t("J'ai compris") : t('En savoir plus')}
      <UpDownIcon icon="chevron" isUp={isExpanded} size={14} />
    </button>
  </div>
}
WagonDetailsBase.propTypes = WagonDetailsHoverBase.propTypes
const WagonDetails = React.memo(WagonDetailsBase)


interface MainChallengeWagonProps extends bayes.bob.DiagnosticMainChallenge {
  areDetailsShownAsHover?: boolean
  areNeutralDetailsShown?: boolean
  children?: never
  gender?: bayes.bob.Gender
  hasFirstBlockerTag: boolean
  hasTopBorder: boolean
  isMainChallengeShown: boolean
  line?: LineProps['type']
  style?: React.CSSProperties
}

type WagonMarkerProps = Pick<MainChallengeWagonProps, 'line' | 'relevance'>

const wagonMarkerWidth = 20 as const

const getWagonMarkerStyle = (relevance?: bayes.bob.MainChallengeRelevance):
React.CSSProperties => ({
  backgroundColor: CHALLENGE_RELEVANCE_COLORS[relevance || 'NEUTRAL_RELEVANCE'],
  borderRadius: 20,
  color: '#fff',
  flexShrink: 0,
  height: 20,
  marginRight: 15,
  position: 'relative',
  width: wagonMarkerWidth,
})

const wagonMarkerIconStyle = {
  left: '50%',
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
} as const

const WagonMarkerBase: React.FC<WagonMarkerProps> = ({line, relevance}):
React.ReactElement => {
  const {t} = useTranslation()
  const style = useMemo((): React.CSSProperties => getWagonMarkerStyle(relevance), [relevance])
  const title = relevance === 'NEEDS_ATTENTION' ? t('Attention') :
    relevance === 'RELEVANT_AND_GOOD' ? t('OK') : t('Inconnu ou données manquantes')
  return <div aria-label={title} title={title}><div style={style}>
    {relevance === 'NEEDS_ATTENTION' ? <CloseIcon size={17} style={wagonMarkerIconStyle} /> : null}
    {relevance === 'RELEVANT_AND_GOOD' ?
      <CheckIcon size={17} style={wagonMarkerIconStyle} /> : null}
  </div>
  {line ? <WagonLine type={line} /> : null}</div>
}
WagonMarkerBase.propTypes = {
  line: PropTypes.oneOf(['arrow', 'dash']),
  relevance: PropTypes.string,
}
const WagonMarker = React.memo(WagonMarkerBase)

const getWagonStyle = (relevance?: bayes.bob.MainChallengeRelevance, style?: React.CSSProperties):
React.CSSProperties => ({
  color: relevance === 'NEUTRAL_RELEVANCE' ? colors.COOL_GREY : colors.DARK_TWO,
  display: 'flex',
  flexDirection: 'row-reverse',
  fontSize: 13,
  fontWeight: 'bold',
  justifyContent: 'flex-end',
  paddingBottom: 15,
  paddingTop: 15,
  position: 'relative',
  ...style,
})

const wagonBackgroundOverlayStyle = {
  backgroundColor: colorToAlpha(colors.RED_PINK, .03),
  border: `solid 1px ${colorToAlpha(colors.RED_PINK, .2)}`,
  borderRadius: 5,
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: -2,
} as const

const wagonTopBorderStyle = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  height: 1,
  left: 50,
  position: 'absolute',
  top: 0,
  width: 'calc(100% - 80px)',
} as const

const wagonTagStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.RED_PINK,
  borderRadius: 2,
  display: 'flex',
  fontSize: 11,
  fontStyle: 'italic',
  fontWeight: 900,
  height: 18,
  marginLeft: 5,
  padding: '0 7px 0 5px',
  textTransform: 'none',
} as const
const wagonNeutralTagStyle: React.CSSProperties = {
  ...wagonTagStyle,
  backgroundColor: colors.MODAL_PROJECT_GREY,
  border: `solid 1px ${colors.COOL_GREY}`,
  color: colors.DARK_TWO,
  fontWeight: 'normal',
  padding: '0 7px',
}
const betaInfoIconStyle = {
  marginLeft: 2,
}

const wagonTitleStyle = {
  alignItems: 'center',
  display: 'flex',
  height: wagonMarkerWidth,
}
const neutralWagonTitleStyle = {
  ...wagonTitleStyle,
  fontStyle: 'italic',
} as const

const MainChallengeWagonBase: React.FC<MainChallengeWagonProps> = (props): React.ReactElement => {
  const {areDetailsShownAsHover, areNeutralDetailsShown, categoryId, hasFirstBlockerTag,
    hasTopBorder, isMainChallengeShown, isHighlighted, line, metricDetails = '',
    metricTitle, relevance, style} = props
  const {t} = useTranslation()
  const [isHovered, setIsHovered] = useState(false)
  const handleHover = useCallback((): void => setIsHovered(true), [])
  const handleLeave = useCallback((): void => setIsHovered(false), [])
  const containerStyle =
    useMemo((): React.CSSProperties => getWagonStyle(relevance, style), [relevance, style])
  const canShowDetails = metricDetails &&
    (relevance === 'NEEDS_ATTENTION' || relevance === 'RELEVANT_AND_GOOD' ||
      areNeutralDetailsShown && relevance === 'NEUTRAL_RELEVANCE') &&
    (!areDetailsShownAsHover || isHovered)
  const Details = areDetailsShownAsHover ? WagonDetailsHover : WagonDetails
  const isLmiBeta = config.isLmiInBeta && categoryId === 'stuck-market'
  return <li
    onMouseEnter={handleHover} onMouseLeave={handleLeave}
    // Interactivity is handled specifically to show the tooltip: no real interactions on this
    // element.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    tabIndex={0} onFocus={handleHover} onBlur={handleLeave}
    style={containerStyle} title={isMainChallengeShown ? categoryId : undefined}>
    <div>
      <div style={relevance === 'NEUTRAL_RELEVANCE' ? neutralWagonTitleStyle : wagonTitleStyle}>
        {metricTitle}
        {hasFirstBlockerTag ? <Trans parent={Tag} style={wagonTagStyle}>
          Frein principal
        </Trans> : isLmiBeta ? <Trans parent={Tag} style={wagonNeutralTagStyle}>
          bêta <InformationOutlineIcon size={11} style={betaInfoIconStyle} />
        </Trans> : null}
      </div>
      {canShowDetails ? <Details>{metricDetails}{isLmiBeta ? ' ' + t(
        'Nos données ne sont pas encore parfaites. Nous vous prions de vous appuyer également ' +
        'sur votre connaissance et votre expérience du marché du travail. Notre équipe travaille ' +
        'actuellement à améliorer ces données.',
      ) : null}</Details> : null}
    </div>
    <WagonMarker {...{line, relevance}} />
    {isHighlighted ? <div style={wagonBackgroundOverlayStyle} /> : null}
    {hasTopBorder ? <div style={wagonTopBorderStyle} /> : null}
  </li>
}
MainChallengeWagonBase.propTypes = {
  areDetailsShownAsHover: PropTypes.bool,
  areNeutralDetailsShown: PropTypes.bool,
  categoryId: PropTypes.string.isRequired,
  hasFirstBlockerTag: PropTypes.bool,
  hasTopBorder: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  isMainChallengeShown: PropTypes.bool,
  line: PropTypes.string,
  metricDetails: PropTypes.string,
  metricTitle: PropTypes.string.isRequired,
  relevance: PropTypes.string.isRequired,
  style: PropTypes.object,
}
const MainChallengeWagon = React.memo(MainChallengeWagonBase)


const categoryPadding = 20 as const

const wagonStyle = {
  paddingLeft: categoryPadding,
  paddingRight: categoryPadding,
  position: 'relative',
} as const

interface Props {
  areMainChallengeIdsShown?: boolean
  areDetailsShownAsHover?: boolean
  areNeutralDetailsShown?: boolean
  mainChallenges: readonly bayes.bob.DiagnosticMainChallenge[]
  gender?: bayes.bob.Gender
  hasFirstBlockerTag?: boolean
  style?: React.CSSProperties & {padding: number}
}

// TODO(cyrille): Add arrows for direction.
const MainChallengesTrain: React.FC<Props> = (props): React.ReactElement => {
  const {areMainChallengeIdsShown, areDetailsShownAsHover, areNeutralDetailsShown, mainChallenges,
    gender, hasFirstBlockerTag, style} = props
  const {t} = useTranslation()
  const mainChallengesData = getTranslatedMainChallenges(t, gender)
  const shownMainChallenges = useMemo(() => mainChallenges.
    filter((challenge): challenge is ValidMainChallenge => !!challenge.categoryId).
    map(({categoryId, ...challengeOverride}) => ({
      categoryId,
      // TODO(cyrille): Decide whether we want to keep metric content in client or server.
      ...mainChallengesData[categoryId],
      ...challengeOverride,
    })).
    filter(({categoryId, metricTitle, relevance}): boolean =>
      !!metricTitle && categoryId !== NO_CHALLENGE_CATEGORY_ID && relevance !== 'NOT_RELEVANT'),
  [mainChallenges, mainChallengesData])
  const firstBlockerIndex = shownMainChallenges.
    findIndex(({relevance}): boolean => relevance === 'NEEDS_ATTENTION')
  const highlightedIndex = shownMainChallenges.
    findIndex(({isHighlighted}): boolean => !!isHighlighted)
  const padding = style?.padding || 0
  // TODO(pascal): Find a better UI for the "end" of the line at the bottom.
  return <ul style={{margin: 0, padding, position: 'relative', zIndex: 0, ...style}}>
    {shownMainChallenges.map((mainChallenge, index): React.ReactNode =>
      <MainChallengeWagon
        key={mainChallenge.categoryId}
        isMainChallengeShown={!!areMainChallengeIdsShown}
        hasFirstBlockerTag={!!hasFirstBlockerTag && index === firstBlockerIndex}
        {...{areDetailsShownAsHover, areNeutralDetailsShown}}
        hasTopBorder={!!index && index !== highlightedIndex && index !== highlightedIndex + 1}
        line={index === shownMainChallenges.length - 1 ? undefined :
          index < firstBlockerIndex ? 'arrow' : 'dash'}
        style={wagonStyle} {...mainChallenge} />)}
  </ul>
}
MainChallengesTrain.propTypes = {
  areDetailsShownAsHover: PropTypes.bool,
  areMainChallengeIdsShown: PropTypes.bool,
  areNeutralDetailsShown: PropTypes.bool,
  gender: PropTypes.oneOf(['MASCULINE', 'FEMININE']),
  hasFirstBlockerTag: PropTypes.bool,
  mainChallenges: PropTypes.arrayOf(PropTypes.shape({
    categoryId: PropTypes.string.isRequired,
    metricTitle: PropTypes.string,
    relevance: PropTypes.string,
  }).isRequired),
  style: PropTypes.shape({
    padding: PropTypes.number.isRequired,
  }),
}


export default React.memo(MainChallengesTrain)
