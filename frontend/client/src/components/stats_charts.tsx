import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import _range from 'lodash/range'
import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import HumanFemaleIcon from 'mdi-react/HumanFemaleIcon'
import HumanMaleIcon from 'mdi-react/HumanMaleIcon'
import HumanMaleFemaleIcon from 'mdi-react/HumanMaleFemaleIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import VisibilitySensor from 'react-visibility-sensor'

import {genderize, getTranslatedCategories} from 'store/french'
import {prepareT} from 'store/i18n'

import vaeStats from 'components/advisor/data/vae.json'
import {DataSource} from 'components/advisor/base'
import FrenchDepartements from 'components/france_departements'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {Tag, SmoothTransitions, UpDownIcon, colorToAlpha, colorGradient} from 'components/theme'


const emptyArray = [] as const


// Our data is updated monthly so it's 2 weeks old in average.
const yearForData = new Date(new Date().getTime() - 14 * 24 * 3600 * 1000).getFullYear()
const bobSourceText = prepareT(
  'Enquête réalisée auprès des utilisateurs de {{config.productName}} ({{yearForData}}).',
)


const relevanceColors: {[R in bayes.bob.CategoryRelevance]?: string} = {
  NEEDS_ATTENTION: colors.RED_PINK,
  NEUTRAL_RELEVANCE: colors.MODAL_PROJECT_GREY,
  NOT_RELEVANT: 'rgba(0, 0, 0, 0)',
  RELEVANT_AND_GOOD: colors.GREENISH_TEAL,
}


interface ArrowProps {
  style?: React.CSSProperties
}

const arrowLineStyle = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  height: 20,
  margin: 'auto',
  width: 2,
} as const

const arrowEndStyle = {
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: `9px solid ${colors.MODAL_PROJECT_GREY}`,
  margin: 'auto',
  width: 4,
} as const

const ArrowBase = ({style}: ArrowProps): React.ReactElement => {
  const arrowStyle: React.CSSProperties = useMemo(() => ({
    marginLeft: 5,
    position: 'absolute',
    ...style,
  }), [style])

  return <div style={arrowStyle}>
    <div style={arrowLineStyle} /><div style={arrowEndStyle} />
  </div>
}
const Arrow = React.memo(ArrowBase)

interface WagonDetailsProps {
  children: string
}

const toggleStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.COOL_GREY,
  cursor: 'pointer',
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
  children: PropTypes.string,
}
const WagonDetailsHover = React.memo(WagonDetailsHoverBase)


const WagonDetailsBase: React.FC<WagonDetailsProps> = ({children}): React.ReactElement => {
  const [isExpanded, setIsExpanded] = useState(false)
  const toggleExpanded = useCallback(
    () => setIsExpanded((wasExpanded): boolean => !wasExpanded), [])
  const {t} = useTranslation()
  return <div style={{fontWeight: 'normal'}}>
    {isExpanded ? <div style={{padding: '10px 0'}}>{children}</div> : null}
    <div style={toggleStyle} onClick={toggleExpanded}>
      {isExpanded ? t("Voir moins d'infos") : t("Voir plus d'infos")}
      <UpDownIcon icon="chevron" isUp={isExpanded} size={14} />
    </div>
  </div>
}
WagonDetailsBase.propTypes = WagonDetailsHoverBase.propTypes
const WagonDetails = React.memo(WagonDetailsBase)


interface CategoryWagonProps extends bayes.bob.DiagnosticCategory {
  areDetailsShownAsHover?: boolean
  areNeutralDetailsShown?: boolean
  children?: never
  gender?: bayes.bob.Gender
  hasFirstBlockerTag: boolean
  hasTopBorder: boolean
  isCategoryShown: boolean
  isLast?: boolean
  style?: React.CSSProperties
}

interface WagonMarkerProps {
  hasArrow?: boolean
  relevance?: bayes.bob.CategoryRelevance
}

const wagonMarkerWidth = 20 as const

const getWagonMarkerStyle = (relevance?: bayes.bob.CategoryRelevance): React.CSSProperties => ({
  backgroundColor: relevanceColors[relevance || 'NEUTRAL_RELEVANCE'],
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

const WagonMarker: React.FC<WagonMarkerProps> = ({hasArrow, relevance}):
React.ReactElement => {
  const style = useMemo((): React.CSSProperties => getWagonMarkerStyle(relevance), [relevance])
  return <div><div style={style}>
    {relevance === 'NEEDS_ATTENTION' ? <CloseIcon size={17} style={wagonMarkerIconStyle} /> : null}
    {relevance === 'RELEVANT_AND_GOOD' ?
      <CheckIcon size={17} style={wagonMarkerIconStyle} /> : null}
  </div>
  {hasArrow ? <Arrow /> : null}</div>
}
WagonMarker.propTypes = {
  hasArrow: PropTypes.bool,
  relevance: PropTypes.string,
}

const getWagonStyle = (relevance?: bayes.bob.CategoryRelevance, style?: React.CSSProperties):
React.CSSProperties => ({
  color: relevance === 'NEUTRAL_RELEVANCE' ? colors.COOL_GREY : colors.DARK_TWO,
  display: 'flex',
  fontSize: 13,
  fontWeight: 'bold',
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

const wagonTagStyle = {
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

const wagonTitleStyle = {
  alignItems: 'center',
  display: 'flex',
  height: wagonMarkerWidth,
}
const neutralWagonTitleStyle = {
  ...wagonTitleStyle,
  fontStyle: 'italic',
} as const

const CategoryWagonBase: React.FC<CategoryWagonProps> = (props): React.ReactElement => {
  const {areDetailsShownAsHover, areNeutralDetailsShown, categoryId, gender, hasFirstBlockerTag,
    hasTopBorder, isCategoryShown, isHighlighted, isLast, metricDetails = '', metricDetailsFeminine,
    metricTitle, relevance, style} = props
  const [isHovered, setIsHovered] = useState(false)
  const handleHover = useCallback((): void => setIsHovered(true), [])
  const handleLeave = useCallback((): void => setIsHovered(false), [])
  const containerStyle =
    useMemo((): React.CSSProperties => getWagonStyle(relevance, style), [relevance, style])
  const details = genderize(
    metricDetails, metricDetailsFeminine || metricDetails, metricDetails, gender)
  const canShowDetails = details &&
    (relevance === 'NEEDS_ATTENTION' || relevance === 'RELEVANT_AND_GOOD' ||
      areNeutralDetailsShown && relevance === 'NEUTRAL_RELEVANCE') &&
    (!areDetailsShownAsHover || isHovered)
  const Details = areDetailsShownAsHover ? WagonDetailsHover : WagonDetails
  return <li
    onMouseEnter={handleHover} onMouseLeave={handleLeave}
    style={containerStyle} title={isCategoryShown ? categoryId : undefined}>
    <WagonMarker relevance={relevance} hasArrow={!isLast} />
    <div>
      <div style={relevance === 'NEUTRAL_RELEVANCE' ? neutralWagonTitleStyle : wagonTitleStyle}>
        {metricTitle}
        {hasFirstBlockerTag ? <Trans parent={Tag} style={wagonTagStyle}>
          Frein principal
        </Trans> : null}
      </div>
      {canShowDetails ? <Details>{details}</Details> : null}
    </div>
    {isHighlighted ? <div style={wagonBackgroundOverlayStyle} /> : null}
    {hasTopBorder ? <div style={wagonTopBorderStyle} /> : null}
  </li>
}
CategoryWagonBase.propTypes = {
  areDetailsShownAsHover: PropTypes.bool,
  areNeutralDetailsShown: PropTypes.bool,
  categoryId: PropTypes.string.isRequired,
  gender: PropTypes.oneOf(['MASCULINE', 'FEMININE']),
  hasFirstBlockerTag: PropTypes.bool,
  hasTopBorder: PropTypes.bool,
  isCategoryShown: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  isLast: PropTypes.bool,
  metricDetails: PropTypes.string,
  metricDetailsFeminine: PropTypes.string,
  metricTitle: PropTypes.string.isRequired,
  relevance: PropTypes.string.isRequired,
  style: PropTypes.object,
}
const CategoryWagon = React.memo(CategoryWagonBase)


const categoryPadding = 20 as const

const wagonStyle = {
  paddingLeft: categoryPadding,
  paddingRight: categoryPadding,
  position: 'relative',
} as const

interface CategoriesTrainProps {
  areCategoryIdsShown?: boolean
  areDetailsShownAsHover?: boolean
  areNeutralDetailsShown?: boolean
  categories: readonly bayes.bob.DiagnosticCategory[]
  gender?: bayes.bob.Gender
  hasFirstBlockerTag?: boolean
  style?: React.CSSProperties & {padding: number}
}

// TODO(cyrille): Add arrows for direction.
const CategoriesTrain: React.FC<CategoriesTrainProps> = (props): React.ReactElement => {
  const {areCategoryIdsShown, areDetailsShownAsHover, areNeutralDetailsShown, categories, gender,
    hasFirstBlockerTag, style} = props
  const {t} = useTranslation()
  const categoriesData = getTranslatedCategories(t)
  const shownCategories = useMemo(() =>
    categories.filter(({categoryId, metricTitle, relevance}): boolean =>
      !!(metricTitle || !!(categoryId && categoriesData[categoryId] || {}).metricTitle) &&
      relevance !== 'NOT_RELEVANT'), [categories, categoriesData])
  const firstBlockerIndex = shownCategories.
    findIndex(({relevance}): boolean => relevance === 'NEEDS_ATTENTION')
  const highlightedIndex = shownCategories.
    findIndex(({isHighlighted}): boolean => !!isHighlighted)
  const padding = style?.padding || 0
  // TODO(pascal): Find a better UI for the "end" of the line at the bottom.
  return <ul style={{margin: 0, padding, position: 'relative', zIndex: 0, ...style}}>
    {shownCategories.map((category, index): React.ReactNode =>
      <CategoryWagon
        key={category.categoryId}
        isCategoryShown={!!areCategoryIdsShown}
        hasFirstBlockerTag={!!hasFirstBlockerTag && index === firstBlockerIndex}
        {...{areDetailsShownAsHover, areNeutralDetailsShown, gender}}
        hasTopBorder={!!index && index !== highlightedIndex && index !== highlightedIndex + 1}
        isLast={index === shownCategories.length - 1}
        style={wagonStyle}
        // TODO(cyrille): Decide whether we want to keep metric content in client or server.
        {...(category.categoryId && categoriesData[category.categoryId])} {...category} />)}
  </ul>
}
CategoriesTrain.propTypes = {
  areCategoryIdsShown: PropTypes.bool,
  areDetailsShownAsHover: PropTypes.bool,
  areNeutralDetailsShown: PropTypes.bool,
  categories: PropTypes.arrayOf(PropTypes.shape({
    categoryId: PropTypes.string.isRequired,
    metricTitle: PropTypes.string,
    relevance: PropTypes.string,
  }).isRequired),
  gender: PropTypes.oneOf(['MASCULINE', 'FEMININE']),
  hasFirstBlockerTag: PropTypes.bool,
  style: PropTypes.shape({
    padding: PropTypes.number.isRequired,
  }),
}
const MemoTrain = React.memo(CategoriesTrain)


const colorFromMarketScore = (score: number): string => {
  if (score < 3) {
    return colors.RED_PINK
  }
  if (score >= 6) {
    return colors.GREENISH_TEAL
  }
  return colors.SQUASH
}


// Fixes the scale of market scores to see the importance of small values with a log scale:
const fixScale = (score: number): number => (.5 + 10 * Math.min(1, Math.log10(score))) / .12


interface StressBarProps extends bayes.bob.RelatedLocalJobGroup {
  children?: React.ReactNode
  color?: string
  isMarketScoreShown?: boolean
  maxBarWidth: number | string
  style?: React.CSSProperties
  titleStyle?: React.CSSProperties
}


const JobGroupStressBarBase: React.FC<StressBarProps> =
(props: StressBarProps): React.ReactElement|null => {
  const {
    children,
    isMarketScoreShown,
    jobGroup: {name = ''} = {},
    localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {},
    maxBarWidth,
    mobilityType = '',
    style,
    titleStyle,
  } = props
  const [hasStarted, setHasStarted] = useState(false)
  const width = hasStarted ? `${fixScale(yearlyAvgOffersPer10Candidates)}%` : 1
  const color = colorFromMarketScore(yearlyAvgOffersPer10Candidates)
  const barStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: color,
    flex: 'none',
    height: 5,
    position: 'relative',
    width,
    ...SmoothTransitions,
  }), [color, width])
  const bulletStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: barStyle.backgroundColor,
    borderRadius: 10,
    height: 20,
    position: 'absolute',
    right: -10,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 20,
    ...SmoothTransitions,
  }), [barStyle.backgroundColor])
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    fontSize: 14,
    ...style,
  }), [style])
  if (!yearlyAvgOffersPer10Candidates) {
    return null
  }
  return <div
    style={containerStyle}
    title={isMarketScoreShown ? `10/${yearlyAvgOffersPer10Candidates}` : undefined}>
    <VisibilitySensor
      active={!hasStarted} intervalDelay={250}
      partialVisibility={true} onChange={setHasStarted}>
      <div style={{flexShrink: 0, width: maxBarWidth}}>
        <div style={barStyle}>
          <div style={bulletStyle} />
        </div>
      </div>
    </VisibilitySensor>
    <span style={titleStyle}>{name}{mobilityType === 'CLOSE' ? '*' : ''} {children}</span>
  </div>
}
const JobGroupStressBar = React.memo(JobGroupStressBarBase)


const isValidRelatedJobGroup = (g: bayes.bob.RelatedLocalJobGroup):
g is bayes.bob.RelatedLocalJobGroup & {jobGroup: {romeId: string}} =>
  !!(g.jobGroup && g.jobGroup.romeId)


interface StressBarsProps {
  areMarketScoresShown?: boolean
  jobGroups: readonly bayes.bob.RelatedLocalJobGroup[]
  maxBarWidth?: number | string
  source?: string
  style?: React.CSSProperties
  targetJobGroup: bayes.bob.RelatedLocalJobGroup
}


const jobGroupStressBarsCaptionStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 14,
  marginTop: 25,
  paddingTop: 15,
  position: 'relative',
  textAlign: 'right',
}


const JobGroupStressBarsBase: React.FC<StressBarsProps> =
(props: StressBarsProps): React.ReactElement => {
  const {areMarketScoresShown, jobGroups, maxBarWidth = 330, source = `Pôle emploi ${yearForData}`,
    style, targetJobGroup} = props
  const {t} = useTranslation()
  const captionEltStyle = (min: number, max: number): React.CSSProperties => ({
    color: colorFromMarketScore((min + max) / 2),
    left: `${(fixScale(min) + fixScale(max)) / 2}%`,
    position: 'absolute',
    transform: 'translateX(-50%)',
  })
  const hasAnyCloseJob = jobGroups.some(({mobilityType}): boolean => mobilityType === 'CLOSE')
  return <figure style={style}>
    {jobGroups.filter(isValidRelatedJobGroup).map((relatedJobGroup, index): React.ReactNode =>
      <JobGroupStressBar
        maxBarWidth={maxBarWidth}
        style={{marginTop: index ? 15 : 0}} key={relatedJobGroup.jobGroup.romeId}
        isMarketScoreShown={areMarketScoresShown} {...relatedJobGroup} />)}
    <JobGroupStressBar
      isMarketScoreShown={areMarketScoresShown} {...targetJobGroup}
      maxBarWidth={maxBarWidth}
      style={{marginTop: 15}} titleStyle={{fontWeight: 'bold'}}>
      ({t('vous')})
    </JobGroupStressBar>
    <figcaption style={jobGroupStressBarsCaptionStyle}>
      <div style={{position: 'relative', width: maxBarWidth}}>
        <Trans style={captionEltStyle(1, 2)} parent="span">Forte</Trans>
        <Trans style={captionEltStyle(2, 6)} parent="span">Moyenne</Trans>
        <Trans style={captionEltStyle(6, 10)} parent="span">Faible</Trans>
      </div>
      <span style={{fontStyle: 'italic', visibility: hasAnyCloseJob ? 'initial' : 'hidden'}}>
        * {t('ne nécessite pas de formation')}
      </span>
    </figcaption>
    <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
      {source}
    </DataSource>
  </figure>
}
const JobGroupStressBars = React.memo(JobGroupStressBarsBase)



interface PictorialChartProps {
  gender?: bayes.bob.Gender
  percent: number
  size?: number
  style?: React.CSSProperties
}


const captionStyle = _memoize((color): React.CSSProperties => ({
  color,
  flex: 'none',
  marginRight: 5,
}))
const stressPictorialCaptionRowStyle = {
  alignItems: 'center',
  display: 'flex',
  marginLeft: isMobileVersion ? 0 : 10,
  marginTop: 10,
}


const GOOD_COLOR = colorToAlpha(colors.GREENISH_TEAL, .5)

const YOU_COLOR = colors.BOB_BLUE

const BAD_COLOR = colorToAlpha(colors.RED_PINK, 5)

const StressPictorialChartBase: React.FC<PictorialChartProps> =
(props: PictorialChartProps): React.ReactElement => {
  const {gender, percent, size = 300, style} = props
  const {t} = useTranslation()

  const lessStressedPercent = Math.round(100 - percent)
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    ...style,
  }), [style])
  const gridStyle = useMemo((): React.CSSProperties => ({
    direction: 'rtl',
    display: 'grid',
    gridGap: 1,
    gridTemplate: 'repeat(10, 1fr) / repeat(10, 1fr)',
    height: size,
    width: size,
  }), [size])
  const elementStyle = (index: number): React.CSSProperties => ({
    color: index === lessStressedPercent + 1 ? YOU_COLOR :
      index > lessStressedPercent ? BAD_COLOR : GOOD_COLOR,
  })
  const genderOffset = gender === 'MASCULINE' ? 0 : 1
  const SelfIcon = gender === 'MASCULINE' ? HumanMaleIcon : HumanFemaleIcon
  return <figure style={containerStyle}>
    <div style={gridStyle}>
      {new Array(100).fill(undefined).map((_, index): React.ReactNode =>
        (genderOffset + index - lessStressedPercent) % 2 ?
          <HumanMaleIcon size={size / 10} style={elementStyle(index)} key={index} /> :
          <HumanFemaleIcon size={size / 10} style={elementStyle(index)} key={index} />)}
    </div>
    <figcaption style={{marginTop: isMobileVersion ? 0 : -10}}>
      <div style={stressPictorialCaptionRowStyle}>
        <HumanMaleFemaleIcon style={captionStyle(GOOD_COLOR)} />
        {t('Personnes qui font face à plus de concurrence que vous')}
      </div>
      <div style={stressPictorialCaptionRowStyle}>
        <SelfIcon style={captionStyle(YOU_COLOR)} />
        {t('Vous')}
      </div>
      <div style={stressPictorialCaptionRowStyle}>
        <HumanMaleFemaleIcon style={captionStyle(BAD_COLOR)} />
        {t('Personnes qui font face à moins de concurrence que vous')}
      </div>
    </figcaption>
  </figure>
}
const StressPictorialChart = React.memo(StressPictorialChartBase)


interface MapProps {
  departements?: readonly bayes.bob.DepartementStats[]
  selectedDepartementId?: string
  style?: React.CSSProperties
}

// Rescale the offers per 10 candidates to fit between 0 and 12 and to have a logarithmic
// progression.
const imtToValue = ({yearlyAvgOffersPer10Candidates}: bayes.bob.ImtLocalJobStats = {}): number => {
  // -1 values in the proto actually mean 0 offers.
  const offersPer10 = yearlyAvgOffersPer10Candidates && yearlyAvgOffersPer10Candidates < 0 ? 0 :
    yearlyAvgOffersPer10Candidates || 0
  return Math.min(1, Math.log10((offersPer10 + 1.3) / 1.3))
}


const FrenchDepartementsMapBase: React.FC<MapProps> = (props: MapProps): React.ReactElement => {
  const {departements = emptyArray, selectedDepartementId, style} = props

  const {t} = useTranslation()

  const sortFunc = useCallback((depA: string, depB: string): number => {
    if (depA === selectedDepartementId) {
      return 1
    }
    if (depB === selectedDepartementId) {
      return -1
    }
    return depA < depB ? -1 : 1
  }, [selectedDepartementId])

  const departementProps = useMemo(() => {
    const depProps = _mapValues(
      _keyBy(departements, 'departementId'),
      ({localStats: {imt = undefined} = {}}): React.SVGProps<SVGPathElement> => ({
        fill: colorGradient(
          '#fff', colors.BOB_BLUE,
          imtToValue(imt) * .9 + .1),
      }))
    if (selectedDepartementId) {
      depProps[selectedDepartementId] = {
        ...depProps[selectedDepartementId],
        stroke: '#000',
      }
    }
    return depProps
  }, [departements, selectedDepartementId])
  const selectedValue = useMemo((): number | undefined => {
    if (selectedDepartementId) {
      const selectedDepartement = departements.
        find(({departementId}): boolean => departementId === selectedDepartementId)
      const {localStats: {imt = undefined} = {}} = selectedDepartement || {}
      if (imt) {
        return imtToValue(imt)
      }
    }
  }, [departements, selectedDepartementId])
  const hasSelectedValue = selectedValue !== undefined
  const scaleStyle = useMemo((): React.CSSProperties => ({
    background: `linear-gradient(to right,
      ${colorGradient('#fff', colors.BOB_BLUE, .1)}, ${colors.BOB_BLUE})`,
    height: 20,
    margin: hasSelectedValue ? '5px 0 23px' : 0,
    position: 'relative',
  }), [hasSelectedValue])
  const selectedMarkerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#000',
    bottom: -5,
    left: `${(selectedValue || 0) * 100}%`,
    position: 'absolute',
    top: -5,
    transform: 'translateX(-50%)',
    width: 2,
  }), [selectedValue])
  const youTextStyle = useMemo((): React.CSSProperties => ({
    left: '50%',
    position: 'absolute',
    top: '100%',
    transform: selectedValue && selectedValue > .9 ? 'translateX(-100%)' :
      (!selectedValue || selectedValue < .1) ? '' : 'translateX(-50%)',
  }), [selectedValue])
  return <div style={style}>
    <FrenchDepartements
      departementProps={departementProps} style={{height: 'auto', width: '100%'}}
      pathProps={{fill: colors.MODAL_PROJECT_GREY, stroke: 'none'}}
      sortFunc={selectedDepartementId ? sortFunc : undefined} />
    <div style={{overflow: 'hidden'}}>
      <Trans style={{display: 'flex', justifyContent: 'space-between', marginBottom: 10}}>
        <span>Concurrence forte</span>
        <span style={{textAlign: 'right'}}>Plus d'offres que de candidats</span>
      </Trans>
      <div style={scaleStyle}>
        {hasSelectedValue ? <div style={selectedMarkerStyle}>
          <div style={youTextStyle}>{t('vous')}</div>
        </div> : null}
      </div>
    </div>
    <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
      Pôle emploi {yearForData}
    </DataSource>
  </div>
}
const FrenchDepartementsMap = React.memo(FrenchDepartementsMapBase)



interface VertHistogramBarProps {
  percent: number
  xLabel: string
  userInterviewsBucket: string
}


const xLabelStyle: React.CSSProperties = {
  left: '50%',
  padding: 5,
  position: 'absolute',
  transform: 'translateX(-50%)',
}


// TODO(pascal): Maybe combine with HistogramBar.
const VertHistogramBarBase = (props: VertHistogramBarProps): React.ReactElement => {
  const {percent, userInterviewsBucket, xLabel} = props
  const isUserBucket = userInterviewsBucket !== '0' && userInterviewsBucket === xLabel
  const {t} = useTranslation()
  const barStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.BOB_BLUE,
    height: percent,
    margin: 'auto 2px',
  }), [percent])
  return <div style={{flex: 1, position: 'relative'}} >
    {isUserBucket ? <div style={{paddingBottom: 5, textAlign: 'center'}}>
      {t('vous')}</div> : null}
    <div style={barStyle}></div>
    <div style={xLabelStyle}>{xLabel}</div>
  </div>
}
const VertHistogramBar = React.memo(VertHistogramBarBase)


interface HistogramLineProps {
  height: number
  isDashed?: boolean
  label?: number
}


const HorizHistogramLineBase = (props: HistogramLineProps): React.ReactElement => {
  const {height, isDashed, label} = props
  const lineStyle = useMemo((): React.CSSProperties => ({
    borderTop: '1px solid #000',
    width: '100%',
    ...(isDashed ? {borderStyle: 'dashed none none none'} : {}),
  }), [isDashed])
  const containerStyle = useMemo((): React.CSSProperties => ({
    bottom: height,
    position: 'absolute',
    width: '100%',
  }), [height])
  return <div key={height} style={containerStyle}>
    {label ? <span>{label}%</span> : null}
    <div style={lineStyle}></div>
  </div>
}
const HorizHistogramLine = React.memo(HorizHistogramLineBase)


interface CountProps {
  [label: string]: number
}

interface HistogramProps {
  counts: CountProps
  style?: React.CSSProperties
  userInterviewsBucket: string
  xLabel: readonly string[]
}


const histogramFigureStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 250,
  position: 'relative',
}


const HistogramBase: React.FC<HistogramProps> =
(props: HistogramProps): React.ReactElement|null => {
  const {counts = {}, style, userInterviewsBucket, xLabel = []} = props
  const {t: translate} = useTranslation()
  const heightFactor = 2
  const totalCounts = Object.values(counts).reduce((a: number, b: number): number => a + b)
  const containerStyle = useMemo((): React.CSSProperties => ({
    maxWidth: 500,
    ...style,
  }), [style])
  if (xLabel.length < 1) {
    return null
  }
  return <div style={containerStyle}>
    <div style={histogramFigureStyle}>
      <div style={{flex: 1}} />
      <div style={{alignItems: 'flex-end', display: 'flex', marginLeft: 50}}>
        {xLabel.map(
          (interviewNumber: string, index: number): React.ReactNode =>
            <VertHistogramBar
              percent={Math.round((counts[interviewNumber] || 0) / totalCounts * 100)
                * heightFactor}
              xLabel={interviewNumber} key={index} userInterviewsBucket={userInterviewsBucket} />)}
      </div>
      {_range(0, 125, 25).map((percent: number): React.ReactNode =>
        <HorizHistogramLine
          height={percent * heightFactor} label={percent || undefined} isDashed={!!percent}
          key={`line${percent}`} />)}
    </div>
    <DataSource style={{marginTop: 40}}>{translate(
      bobSourceText, {productName: config.productName, yearForData},
    )}</DataSource>
  </div>
}
const Histogram = React.memo(HistogramBase)


interface InterviewHistogramProps {
  interviewCounts: CountProps
  style?: React.CSSProperties
  totalInterviewCount: number
}

const USER_INTERVIEW_COUNT_OPTIONS = ['0', '1', '2', '3', '4', '5+'] as const


function getOptionFromInterviewCount(interviewCount: string): string|undefined {
  const firstOptionName = USER_INTERVIEW_COUNT_OPTIONS[0]
  const lastOptionIndex = USER_INTERVIEW_COUNT_OPTIONS.length - 1
  const lastOptionName = USER_INTERVIEW_COUNT_OPTIONS[lastOptionIndex]

  // In the proto -1 is for no interviews while 0 is for unknown number of
  // interviews. We discard the latest as well as value we can't parse to int.
  if (interviewCount === '0') {
    return undefined
  }
  if (interviewCount === '-1') {
    return firstOptionName
  }
  if (interviewCount in USER_INTERVIEW_COUNT_OPTIONS) {
    return interviewCount
  }
  if (parseInt(interviewCount) >
    parseInt(USER_INTERVIEW_COUNT_OPTIONS[lastOptionIndex - 1])) {
    return lastOptionName
  }
}


const InterviewHistogramBase = (props: InterviewHistogramProps): React.ReactElement => {
  const {interviewCounts, style, totalInterviewCount} = props
  const interviewCount = totalInterviewCount.toString()

  const userInterviewBucket = getOptionFromInterviewCount(interviewCount)

  const counts = useMemo((): CountProps => {
    const interviewBuckets: {[bucketName: string]: number} = {}
    Object.keys(interviewCounts).forEach((countNumber: string): void => {
      const bucketName = getOptionFromInterviewCount(countNumber)
      if (!bucketName) {
        return
      }
      if (bucketName in interviewBuckets) {
        interviewBuckets[bucketName] += interviewCounts[countNumber]
      } else {
        interviewBuckets[bucketName] = interviewCounts[countNumber]
      }
    })
    return interviewBuckets
  }, [interviewCounts])

  return <Histogram
    xLabel={USER_INTERVIEW_COUNT_OPTIONS}
    userInterviewsBucket={userInterviewBucket || ''}
    counts={counts}
    style={style} />
}
const InterviewHistogram = React.memo(InterviewHistogramBase)


interface HistogramBarProps {
  height: string
  isHighlighted: boolean
  style?: React.CSSProperties
  subtitle?: string
  title: string
}


const titleStyle: React.CSSProperties = {
  left: 0,
  marginTop: 8,
  position: 'absolute',
  right: 0,
  textAlign: 'center',
  top: '100%',
}

const valueStyle: React.CSSProperties = {
  bottom: '100%',
  left: 0,
  position: 'absolute',
  right: 0,
  textAlign: 'center',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
}

const transparentBlue = colorToAlpha(colors.BOB_BLUE, .7)


const HistogramBarBase: React.FC<HistogramBarProps> =
(props: HistogramBarProps): React.ReactElement => {
  const {height, isHighlighted, style, subtitle, title} = props
  // TODO(marielaure): Find a way to explain why a bar is highlighted.
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isHighlighted ? colors.BOB_BLUE : transparentBlue,
    height,
    position: 'relative',
    ...style,
  }), [height, isHighlighted, style])
  return <div style={containerStyle}>
    <div style={titleStyle}>
      <div>{title}</div>
      {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
    </div>
    <div style={valueStyle}>{height}</div>
  </div>
}
const HistogramBar = React.memo(HistogramBarBase)


interface DiplomaRequirementsHistogramProps {
  highestDegree?: bayes.bob.DegreeLevel
  requirements: readonly bayes.bob.JobRequirement[]
  style?: React.CSSProperties
}


const barsContainerStyle = {
  alignItems: 'flex-end',
  borderBottom: `solid 1px ${colors.DARK_TWO}`,
  display: 'flex',
  height: 300,
  justifyContent: 'space-around',
  margin: '20px 0 68px',
  width: '100%',
} as const
const barStyle = {flex: 1, margin: '0 15px'} as const


// Find the best degree in a list of diploma requirements lower or equal to a given degree.
const findBestMatchingDegree =
(degree: bayes.bob.DegreeLevel|undefined, requirements: readonly bayes.bob.JobRequirement[]):
bayes.bob.DegreeLevel|undefined => {
  if (!degree) {
    return degree
  }
  for (let i = requirements.length - 1; i >= 0; --i) {
    const {diploma} = requirements[i]
    if (diploma && diploma.level && diploma.level <= degree) {
      return diploma.level
    }
  }
  return undefined
}


const DiplomaRequirementsHistogramBase: React.FC<DiplomaRequirementsHistogramProps> =
(props: DiplomaRequirementsHistogramProps): React.ReactElement => {
  const {highestDegree, requirements, style} = props
  const {t} = useTranslation()
  let totalRequirement = 0
  const cumSumRequirements = requirements.map(
    (requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => {
      totalRequirement += requirement.percentRequired || 0
      return {
        ...requirement,
        percentRequired: totalRequirement,
      }
    })
  const bestDegree = findBestMatchingDegree(highestDegree, requirements)
  const percentNoRequirement = 100 - totalRequirement
  const accessibleOffers =
    [{name: t('Aucune formation scolaire')} as bayes.bob.JobRequirement].
      concat(cumSumRequirements).
      map((requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => ({
        ...requirement,
        percentRequired: (requirement.percentRequired || 0) + percentNoRequirement,
      }))
  return <div style={style}>
    <div style={barsContainerStyle}>
      {accessibleOffers.map((level: bayes.bob.JobRequirement): React.ReactNode =>
        <HistogramBar
          key={level.name} title={level.name || ''} height={`${level.percentRequired}%`}
          style={barStyle}
          isHighlighted={!bestDegree || (level.diploma && level.diploma.level) === bestDegree} />,
      )}
    </div>
    <DataSource style={{marginTop: 40}}>
      {t("Offres d'emploi enregistrées par Pôle emploi (2015-2017)")}
    </DataSource>
  </div>
}
const DiplomaRequirementsHistogram = React.memo(DiplomaRequirementsHistogramBase)


interface VAEDiploma {
  name: string
  romeIds: readonly string[]
  vaeRatioInDiploma: number
}


interface MostVaeDiplomaTableProps {
  style?: React.CSSProperties
  targetJobGroup?: bayes.bob.JobGroup
}


const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
}


const tableRowStyle = _memoize(
  (isEven: boolean, isTargeted: boolean): React.CSSProperties => ({
    backgroundColor: isEven ? colorToAlpha(colors.BOB_BLUE, .1) : 'transparent',
    fontWeight: isTargeted ? 900 : undefined,
  }),
  (isEven: boolean, isTargeted: boolean): string => `${isEven}-${isTargeted}`,
)


const cellStyle: React.CSSProperties = {
  padding: 10,
}


const numberCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
}

const sourceStyle: React.CSSProperties = {
  marginTop: 15,
}


const MostVaeDiplomaTableBase: React.FC<MostVaeDiplomaTableProps> =
(props: MostVaeDiplomaTableProps): React.ReactElement => {
  const {style, targetJobGroup: {romeId = undefined} = {}} = props
  return <div style={style}>
    <table style={tableStyle}><tbody>
      {vaeStats.map((diploma: VAEDiploma, index: number): React.ReactElement => <tr
        key={diploma.name}
        style={tableRowStyle(!(index % 2), !!romeId && diploma.romeIds.includes(romeId))}>
        <td style={cellStyle}>{diploma.name}</td>
        <td style={numberCellStyle}>{diploma.vaeRatioInDiploma.toLocaleString(undefined, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}%</td>
      </tr>)}
    </tbody></table>
    <DataSource style={sourceStyle}>
      MENJ-DEPP, enquête n°62
    </DataSource>
  </div>
}
MostVaeDiplomaTableBase.propTypes = {
  targetJobGroup: PropTypes.shape({
    romeId: PropTypes.string,
  }),
}
const MostVaeDiplomaTable = React.memo(MostVaeDiplomaTableBase)

interface ApplicationOption {
  name: string
  value: string
}

interface DoughnutProps {
  counts: CountProps
  circlePadding?: number
  height?: number
  isSegmentsStartingTop?: boolean
  labels: readonly ApplicationOption[]
  style?: React.CSSProperties
  thickness?: number
  numApplications?: bayes.bob.NumberOfferEstimateOption
}

interface DoughnutAttributeProps {
  color: string
  name: string
  percentage: number
  strokeDiff: number
  value: string
}

const computeAngleOffsets = (
  attributes: readonly DoughnutAttributeProps[], initialOffset: number): CountProps => {
  const angleOffsets: CountProps = {}
  attributes.reduce((offset, {percentage, value}): number => {
    angleOffsets[value] = offset
    return percentage * 360 + offset
  }, initialOffset)
  return angleOffsets
}

const getDoughnutAttributes = (
  labels: readonly ApplicationOption[],
  counts: CountProps, circumference: number): DoughnutAttributeProps[] => {
  const nbLabels = labels.length
  const totalCounts = Object.values(counts).reduce((a: number, b: number): number => a + b)
  return labels.map(({name, value}, index): DoughnutAttributeProps => {
    const percentage = counts[value] / totalCounts
    const color = colorToAlpha(colors.BOB_BLUE, (index + 1) / nbLabels)
    const strokeDiff = circumference - percentage * circumference
    return {color, name, percentage, strokeDiff, value}
  })
}

const captionRowStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  marginLeft: isMobileVersion ? 0 : '1em',
  marginTop: 10,
}

const captionEltStyle = (color?: string): React.CSSProperties => ({
  backgroundColor: color,
  borderRadius: '.2em',
  height: '1em',
  marginRight: 5,
  width: '1.618em',
})

const graphAreaStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'space-around',
}

const DoughnutChart: React.FC<DoughnutProps> = (props: DoughnutProps): React.ReactElement => {
  const {counts, circlePadding = 10, isSegmentsStartingTop = true, height = 160, labels,
    numApplications, thickness = 30, style} = props
  const {t, t: translate} = useTranslation()
  const xAxisCoord = height / 2
  const yAxisCoord = xAxisCoord
  const initialAngleOffset = isSegmentsStartingTop ? -90 : 0
  const radius = xAxisCoord - 2 * circlePadding
  const circumference = 2 * Math.PI * radius
  const attributes = getDoughnutAttributes(labels, counts, circumference)
  const angleOffsets = computeAngleOffsets(attributes, initialAngleOffset)
  const figureStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    ...style,
  }), [style])

  return <figure style={figureStyle}>
    <div style={graphAreaStyle}>
      <svg
        height={2 * xAxisCoord} width={2 * xAxisCoord}
        viewBox={`0 0 ${2 * xAxisCoord} ${2 * xAxisCoord}`}>
        <g>
          {attributes.map(({color, strokeDiff, value}, index): React.ReactNode =>
            <circle
              cx={xAxisCoord} cy={yAxisCoord} r={radius} fill="transparent"
              stroke={color} strokeWidth={thickness}
              strokeDasharray={circumference} key={`circle-${index}`}
              strokeDashoffset={strokeDiff}
              transform={`rotate(${angleOffsets[value]}, ${xAxisCoord}, ${yAxisCoord})`}>
            </circle>)}
        </g>
      </svg>
      <figcaption style={{marginTop: isMobileVersion ? 0 : -10}}>
        {attributes.map(({color, name, percentage, value}): React.ReactNode =>
          percentage ? <div style={captionRowStyle} key={value}>
            <div style={captionEltStyle(color)} />
            {name}
            {!!numApplications && numApplications === value ? ` (${t('vous')})` : ''}
          </div> : null)}
      </figcaption>
    </div>
    <DataSource style={{marginTop: 30}}>{translate(
      bobSourceText, {productName: config.productName, yearForData},
    )}</DataSource>
  </figure>
}


interface PassionLevelHistogramProps {
  counts: readonly bayes.bob.PassionLevelCount[]
  passionLevel?: bayes.bob.PassionateLevel
  style?: React.CSSProperties
}

interface PassionLevelOption {
  altText: string
  name: string
  value: string
}

interface SearchLenghtMotivationCounts {
  altText: string
  emoji: string
  name: string
  percent: number
}

// Keep in increasing order, for the motivation histogram.
const passionLevelOptions = [
  {altText: prepareT('métier acceptable'), name: '😐', value: 'ALIMENTARY_JOB'},
  {altText: prepareT('métier intéressant'), name: '😊', value: 'LIKEABLE_JOB'},
  {altText: prepareT('métier passionnant'), name: '😍', value: 'PASSIONATING_JOB'},
  {altText: prepareT('métier idéal'), name: '🤩', value: 'LIFE_GOAL_JOB'},
]

const motivationBarsContainerStyle = {
  ...barsContainerStyle,
  height: 100,
} as const

// Get counts for the user search length bucket.
const getSearchLenghtCounts =
(searchLenghtMonths: number|undefined, counts: readonly bayes.bob.PassionLevelCategory[]):
readonly bayes.bob.PassionLevelCount[]|undefined => {
  const searchInMonths = searchLenghtMonths || 0
  const filter = searchInMonths < 4 ? 'SHORT_SEARCH_LENGTH' : searchInMonths < 13 ?
    'MEDIUM_SEARCH_LENGTH' : searchInMonths > 13 ? 'LONG_SEARCH_LENGTH' : ''
  if (filter) {
    const SearchLenghtCounts = counts.find(count => count.searchLength === filter)
    return SearchLenghtCounts && SearchLenghtCounts.levelCounts
  }
  return undefined
}

// TODO(marielaure): Add a legend and find a better title.
const PassionLevelHistogramBase: React.FC<PassionLevelHistogramProps> =
(props: PassionLevelHistogramProps): React.ReactElement => {
  const {passionLevel, counts, style} = props
  const {t: translate} = useTranslation()
  const totalCounts = counts.reduce((total: number, {count}): number => {
    return total += count || 0
  }, 0)
  const formattedCounts = passionLevelOptions.map((option: PassionLevelOption):
  SearchLenghtMotivationCounts => {
    const categoryCount = counts.find(count => count.passionateLevel === option.value)
    return {
      altText: translate(option.altText),
      emoji: option.name,
      name: option.value,
      percent: categoryCount && categoryCount.count ?
        Math.round(100 * categoryCount.count / totalCounts) : 0,
    }
  })
  return <div style={style}>
    <div style={motivationBarsContainerStyle}>
      {formattedCounts.map((level: SearchLenghtMotivationCounts): React.ReactNode =>
        <HistogramBar
          key={level.name} title={level.emoji || ''}
          subtitle={level.altText || ''}
          height={`${level.percent}%`}
          style={barStyle}
          isHighlighted={!passionLevel || (level.name) === passionLevel} />,
      )}
    </div>
    <DataSource style={{marginTop: 40}}>{translate(
      bobSourceText, {productName: config.productName, yearForData},
    )}</DataSource>
  </div>
}
const PassionLevelHistogram = React.memo(PassionLevelHistogramBase)


export {MemoTrain as CategoriesTrain, DiplomaRequirementsHistogram, FrenchDepartementsMap,
  InterviewHistogram, JobGroupStressBars, MostVaeDiplomaTable, StressPictorialChart, HistogramBar,
  DoughnutChart, PassionLevelHistogram, getSearchLenghtCounts}
