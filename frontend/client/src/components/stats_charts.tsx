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
import VisibilitySensor from 'react-visibility-sensor'


import {YouChooser, genderize, getCategories, vouvoyer} from 'store/french'

import {DataSource} from 'components/advisor/base'
import FrenchDepartements from 'components/france_departements'
import {isMobileVersion} from 'components/mobile'
import {Tag, SmoothTransitions, UpDownIcon, colorToAlpha, colorGradient} from 'components/theme'


// Our data is updated monthly so it's 2 weeks old in average.
const yearForData = new Date(new Date().getTime() - 14 * 24 * 3600 * 1000).getFullYear()


const relevanceColors: {[R in bayes.bob.CategoryRelevance]?: string} = {
  'NEEDS_ATTENTION': colors.RED_PINK,
  'NEUTRAL_RELEVANCE': colors.MODAL_PROJECT_GREY,
  'NOT_RELEVANT': 'rgba(0, 0, 0, 0)',
  'RELEVANT_AND_GOOD': colors.GREENISH_TEAL,
}


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
  return <div style={{fontWeight: 'normal'}}>
    {isExpanded ? <div style={{padding: '10px 0'}}>{children}</div> : null}
    <div style={toggleStyle} onClick={toggleExpanded}>
      Voir {isExpanded ? 'moins' : 'plus'} d'infos
      <UpDownIcon icon="chevron" isUp={isExpanded} size={14} />
    </div>
  </div>
}
WagonDetailsBase.propTypes = WagonDetailsHoverBase.propTypes
const WagonDetails = React.memo(WagonDetailsBase)


interface CategoryWagonProps extends bayes.bob.DiagnosticCategory {
  areDetailsShownAsHover?: boolean
  children?: never
  gender?: bayes.bob.Gender
  isCategoryShown: boolean
  isHighlighted: boolean
  hasSelectedCategoryTag: boolean
  hasTopBorder: boolean
  style?: React.CSSProperties
}


class CategoryWagon extends React.PureComponent<CategoryWagonProps, {isHovered: boolean}> {
  public static markerWidth = 20 as const

  public state = {
    isHovered: false,
  }

  private handleHover = _memoize((isHovered): (() => void) =>
    (): void => this.setState({isHovered}))

  private renderMarker(relevance?: bayes.bob.CategoryRelevance): React.ReactNode {
    const style = {
      backgroundColor: relevanceColors[relevance || 'NEUTRAL_RELEVANCE'],
      borderRadius: 20,
      color: '#fff',
      flexShrink: 0,
      height: 20,
      marginRight: 15,
      position: 'relative',
      width: CategoryWagon.markerWidth,
    } as const
    const iconStyle = {
      left: '50%',
      position: 'absolute',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    } as const
    return <div style={style}>
      {relevance === 'NEEDS_ATTENTION' ? <CloseIcon size={17} style={iconStyle} /> : null}
      {relevance === 'RELEVANT_AND_GOOD' ? <CheckIcon size={17} style={iconStyle} /> : null}
    </div>
  }

  public render(): React.ReactNode {
    const {areDetailsShownAsHover, categoryId, gender, isCategoryShown, isHighlighted,
      hasSelectedCategoryTag, hasTopBorder, metricDetails = '', metricDetailsFeminine, metricTitle,
      relevance, style} = this.props
    const containerStyle = {
      color: relevance === 'NEUTRAL_RELEVANCE' ? colors.COOL_GREY : colors.DARK_TWO,
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      paddingBottom: 15,
      paddingTop: 15,
      position: 'relative',
      ...style,
    } as const
    const backgroundOverlayStyle = {
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
    const topBorderStyle = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      height: 1,
      left: 50,
      position: 'absolute',
      top: 0,
      width: 'calc(100% - 80px)',
    } as const
    const tagStyle = {
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
    const details = genderize(
      metricDetails, metricDetailsFeminine || metricDetails, metricDetails, gender)
    const canShowDetails = details &&
      (relevance === 'NEEDS_ATTENTION' || relevance === 'RELEVANT_AND_GOOD') &&
      (!areDetailsShownAsHover || this.state.isHovered)
    const Details = areDetailsShownAsHover ? WagonDetailsHover : WagonDetails
    return <li
      onMouseEnter={this.handleHover(true)} onMouseLeave={this.handleHover(false)}
      style={containerStyle} title={isCategoryShown ? categoryId : undefined}>
      {this.renderMarker(relevance)}
      <div>
        <div style={{alignItems: 'center', display: 'flex', height: CategoryWagon.markerWidth}}>
          {metricTitle}
          {hasSelectedCategoryTag && isHighlighted ? <Tag style={tagStyle}>
            Frein principal
          </Tag> : null}
        </div>
        {canShowDetails ? <Details>{details}</Details> : null}
      </div>
      {isHighlighted ? <div style={backgroundOverlayStyle} /> : null}
      {hasTopBorder ? <div style={topBorderStyle} /> : null}
    </li>
  }
}


interface CategoriesTrainProps {
  areCategoryIdsShown?: boolean
  areDetailsShownAsHover?: boolean
  categories: readonly bayes.bob.DiagnosticCategory[]
  gender?: bayes.bob.Gender
  hasSelectedCategoryTag?: boolean
  style?: React.CSSProperties & {padding: number}
  userYou?: YouChooser
}


class CategoriesTrain extends React.PureComponent<CategoriesTrainProps> {
  private static categoryPadding = 20 as const

  public render(): React.ReactNode {
    const {areCategoryIdsShown, areDetailsShownAsHover, categories, gender, hasSelectedCategoryTag,
      style, userYou} = this.props
    const categoriesData = getCategories(userYou || vouvoyer)
    const shownCategories = categories.filter(({categoryId, relevance}): boolean =>
      !!(categoryId && categoriesData[categoryId] || {}).metricTitle &&
      relevance !== 'NOT_RELEVANT')
    const highlightedIndex = shownCategories.
      findIndex(({relevance}): boolean => relevance === 'NEEDS_ATTENTION')
    const padding = style && style.padding || 0
    const wagonStyle = {
      paddingLeft: CategoriesTrain.categoryPadding,
      paddingRight: CategoriesTrain.categoryPadding,
      position: 'relative',
    } as const
    const lineContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      // Compensate for: the padding of ul, the border of li, the padding of li, and half the width
      // of the marker.
      left: padding + 1 + CategoriesTrain.categoryPadding + CategoryWagon.markerWidth / 2,
      padding: `${padding / 2}px 0`,
      position: 'absolute',
      top: 0,
      transform: 'translateX(-50%)',
      width: 3,
      zIndex: -1,
    }
    const lineColor = colors.MODAL_PROJECT_GREY
    const transparentColor = colorToAlpha(lineColor, 0)
    // TODO(pascal): Find a better UI for the "end" of the line at the bottom.
    return <ul style={{margin: 0, padding, position: 'relative', zIndex: 0, ...style}}>
      {shownCategories.map((category, index): React.ReactNode =>
        <CategoryWagon
          key={category.categoryId}
          isCategoryShown={!!areCategoryIdsShown} gender={gender}
          hasSelectedCategoryTag={!!hasSelectedCategoryTag}
          isHighlighted={index === highlightedIndex}
          areDetailsShownAsHover={areDetailsShownAsHover}
          hasTopBorder={!!index && index !== highlightedIndex && index !== highlightedIndex + 1}
          style={wagonStyle} {...category}
          {...(category.categoryId && categoriesData[category.categoryId])} />)}
      <div style={lineContainerStyle}>
        <span style={{
          background: `linear-gradient(to bottom, ${transparentColor}, ${lineColor})`,
          height: 20,
          zIndex: -1}} />
        <span style={{backgroundColor: lineColor, flex: 1}} />
        <span style={{
          background: `linear-gradient(to top, ${transparentColor}, ${lineColor})`,
          height: 20,
          zIndex: -1}} />
      </div>
    </ul>
  }
}


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


class JobGroupStressBar extends React.PureComponent<StressBarProps, {hasStarted: boolean}> {
  public state = {
    hasStarted: false,
  }

  private handleVisibilityChange = (isVisible: boolean): void =>
    this.setState({hasStarted: isVisible})

  public render(): React.ReactNode {
    const {
      children,
      isMarketScoreShown,
      jobGroup: {name = ''} = {},
      localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {},
      maxBarWidth,
      mobilityType = '',
      style,
      titleStyle,
    } = this.props
    if (!yearlyAvgOffersPer10Candidates) {
      return null
    }
    const {hasStarted} = this.state
    const width = hasStarted ? `${fixScale(yearlyAvgOffersPer10Candidates)}%` : 1
    const color = colorFromMarketScore(yearlyAvgOffersPer10Candidates)
    const barStyle: React.CSSProperties = {
      backgroundColor: color,
      flex: 'none',
      height: 5,
      position: 'relative',
      width,
      ...SmoothTransitions,
    }
    const bulletStyle: React.CSSProperties = {
      backgroundColor: barStyle.backgroundColor,
      borderRadius: 10,
      height: 20,
      position: 'absolute',
      right: -10,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 20,
      ...SmoothTransitions,
    }
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 14,
      ...style,
    }

    return <div
      style={containerStyle}
      title={isMarketScoreShown ? `10/${yearlyAvgOffersPer10Candidates}` : undefined}>
      <VisibilitySensor
        active={!hasStarted} intervalDelay={250}
        partialVisibility={true} onChange={this.handleVisibilityChange}>
        <div style={{flexShrink: 0, width: maxBarWidth}}>
          <div style={barStyle}>
            <div style={bulletStyle} />
          </div>
        </div>
      </VisibilitySensor>
      <span style={titleStyle}>{name}{mobilityType === 'CLOSE' ? '*' : ''} {children}</span>
    </div>
  }
}


const isValidRelatedJobGroup = (g: bayes.bob.RelatedLocalJobGroup):
g is bayes.bob.RelatedLocalJobGroup & {jobGroup: {romeId: string}} =>
  !!(g.jobGroup && g.jobGroup.romeId)


interface StressBarsProps {
  areMarketScoresShown?: boolean
  jobGroups: readonly bayes.bob.RelatedLocalJobGroup[]
  maxBarWidth: number | string
  style?: React.CSSProperties
  targetJobGroup: bayes.bob.RelatedLocalJobGroup
  userYou: YouChooser
}

class JobGroupStressBars extends React.PureComponent<StressBarsProps> {
  public static defaultProps = {
    maxBarWidth: 330,
  }

  public render(): React.ReactNode {
    const {areMarketScoresShown, jobGroups, maxBarWidth, style, targetJobGroup,
      userYou} = this.props
    const captionStyle: React.CSSProperties = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontSize: 14,
      marginTop: 25,
      paddingTop: 15,
      position: 'relative',
      textAlign: 'right',
    }
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
        ({userYou('toi', 'vous')})
      </JobGroupStressBar>
      <figcaption style={captionStyle}>
        <div style={{position: 'relative', width: maxBarWidth}}>
          <span style={captionEltStyle(1, 2)}>Forte</span>
          <span style={captionEltStyle(2, 6)}>Moyenne</span>
          <span style={captionEltStyle(6, 10)}>Faible</span>
        </div>
        <span style={{fontStyle: 'italic', visibility: hasAnyCloseJob ? 'initial' : 'hidden'}}>
          * ne nécessite pas de formation
        </span>
      </figcaption>
      <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
        Pôle emploi {yearForData}
      </DataSource>
    </figure>
  }
}



interface PictorialChartConfig {
  gender?: bayes.bob.Gender
  percent: number
  size?: number
  style?: React.CSSProperties
  userYou: YouChooser
}

interface PictorialChartProps extends PictorialChartConfig {
  size: number
}


const captionStyle = _memoize((color): React.CSSProperties => ({
  color,
  flex: 'none',
  marginRight: 5,
}))

class StressPictorialChart extends React.PureComponent<PictorialChartConfig> {
  public static defaultProps = {
    size: 300,
  }

  private static GOOD_COLOR = colorToAlpha(colors.GREENISH_TEAL, .5)

  private static YOU_COLOR = colors.BOB_BLUE

  private static BAD_COLOR = colorToAlpha(colors.RED_PINK, 5)

  public render(): React.ReactNode {
    const {gender, percent, size, style, userYou} = this.props as PictorialChartProps
    const lessStressedPercent = Math.round(100 - percent)
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      ...style,
    }
    const gridStyle: React.CSSProperties = {
      direction: 'rtl',
      display: 'grid',
      gridGap: 1,
      gridTemplate: 'repeat(10, 1fr) / repeat(10, 1fr)',
      height: size,
      width: size,
    }
    const elementStyle = (index): React.CSSProperties => ({
      color: index === lessStressedPercent + 1 ? StressPictorialChart.YOU_COLOR :
        index > lessStressedPercent ? StressPictorialChart.BAD_COLOR :
          StressPictorialChart.GOOD_COLOR,
    })
    const captionRowStyle = {
      alignItems: 'center',
      display: 'flex',
      marginLeft: isMobileVersion ? 0 : 10,
      marginTop: 10,
    }
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
        <div style={captionRowStyle}>
          <HumanMaleFemaleIcon style={captionStyle(StressPictorialChart.GOOD_COLOR)} />
          Personnes qui font face à moins de concurrence que {userYou('toi', 'vous')}
        </div>
        <div style={captionRowStyle}>
          <SelfIcon style={captionStyle(StressPictorialChart.YOU_COLOR)} />
          {userYou('Toi', 'Vous')}
        </div>
        <div style={captionRowStyle}>
          <HumanMaleFemaleIcon style={captionStyle(StressPictorialChart.BAD_COLOR)} />
          Personnes qui font face à plus de concurrence que {userYou('toi', 'vous')}
        </div>
      </figcaption>
    </figure>
  }
}


interface MapProps {
  departements?: readonly bayes.bob.DepartementStats[]
  selectedDepartementId?: string
  style?: React.CSSProperties
  userYou: YouChooser
}

// Rescale the offers per 10 candidates to fit between 0 and 12 and to have a logarithmic
// progression.
const imtToValue = ({yearlyAvgOffersPer10Candidates}: bayes.bob.ImtLocalJobStats = {}): number => {
  // -1 values in the proto actually mean 0 offers.
  const offersPer10 = yearlyAvgOffersPer10Candidates && yearlyAvgOffersPer10Candidates < 0 ? 0 :
    yearlyAvgOffersPer10Candidates || 0
  return Math.min(1, Math.log10((offersPer10 + 1.3) / 1.3))
}

class FrenchDepartementsMap extends React.PureComponent<MapProps> {

  private sortFunc = (depA: string, depB: string): number => {
    if (depA === this.props.selectedDepartementId) {
      return 1
    }
    if (depB === this.props.selectedDepartementId) {
      return -1
    }
    return depA < depB ? -1 : 1
  }

  public render(): React.ReactNode {
    const {departements = [], selectedDepartementId, style, userYou} = this.props
    const departementProps = _mapValues(
      _keyBy(departements, 'departementId'),
      ({localStats: {imt = undefined} = {}}): React.SVGProps<SVGPathElement> => ({
        fill: colorGradient(
          '#fff', colors.BOB_BLUE,
          imtToValue(imt) * .9 + .1),
      }))
    let selectedValue: number | undefined
    if (selectedDepartementId) {
      departementProps[selectedDepartementId] = {
        ...departementProps[selectedDepartementId],
        stroke: '#000',
      }
      const selectedDepartement = departements.
        find(({departementId}): boolean => departementId === selectedDepartementId)
      const {localStats: {imt = undefined} = {}} = selectedDepartement || {}
      if (imt) {
        selectedValue = imtToValue(imt)
      }
    }
    const hasSelectedValue = selectedValue !== undefined
    const scaleStyle: React.CSSProperties = {
      background: `linear-gradient(to right,
        ${colorGradient('#fff', colors.BOB_BLUE, .1)}, ${colors.BOB_BLUE})`,
      height: 20,
      margin: hasSelectedValue ? '5px 0 23px' : 0,
      position: 'relative',
    }
    const selectedMarkerStyle: React.CSSProperties = {
      backgroundColor: '#000',
      bottom: -5,
      left: `${(selectedValue || 0) * 100}%`,
      position: 'absolute',
      top: -5,
      transform: 'translateX(-50%)',
      width: 2,
    }
    const youTextStyle: React.CSSProperties = {
      left: '50%',
      position: 'absolute',
      top: '100%',
      transform: selectedValue && selectedValue > .9 ? 'translateX(-100%)' :
        (!selectedValue || selectedValue < .1) ? '' : 'translateX(-50%)',
    }
    return <div style={style}>
      <FrenchDepartements
        departementProps={departementProps} style={{height: 'auto', width: '100%'}}
        pathProps={{fill: colors.MODAL_PROJECT_GREY, stroke: 'none'}}
        sortFunc={selectedDepartementId ? this.sortFunc : undefined} />
      <div style={{overflow: 'hidden'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 10}}>
          <span>Concurrence forte</span>
          <span style={{textAlign: 'right'}}>Plus d'offres que de candidats</span>
        </div>
        <div style={scaleStyle}>
          {hasSelectedValue ? <div style={selectedMarkerStyle}>
            <div style={youTextStyle}>{userYou('toi', 'vous')}</div>
          </div> : null}
        </div>
      </div>
      <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
        Pôle emploi {yearForData}
      </DataSource>
    </div>
  }
}


interface CountProps {
  [label: string]: number
}

interface HistogramProps {
  counts: CountProps
  style?: React.CSSProperties
  userInterviewsBucket: string
  userYou: YouChooser
  xLabel: string[]
}

class Histogram extends React.PureComponent<HistogramProps> {
  private renderBar(percent: number, xLabel: string, index: number): React.ReactNode {
    const {userInterviewsBucket, userYou} = this.props
    const isUserBucket = userInterviewsBucket !== '0' && userInterviewsBucket === xLabel
    const barStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      height: percent,
      margin: 'auto 2px',
    }
    const xLabelStyle: React.CSSProperties = {
      left: '50%',
      padding: 5,
      position: 'absolute',
      transform: 'translateX(-50%)',
    }
    return <div key={index} style={{flex: 1, position: 'relative'}} >
      {isUserBucket ? <div style={{paddingBottom: 5, textAlign: 'center'}}>
        {userYou('toi', 'vous')}</div> : null}
      <div style={barStyle}></div>
      <div style={xLabelStyle}>{xLabel}</div>
    </div>
  }

  private renderLine(height: number, label?: number, isDashed?: boolean): React.ReactNode {
    const border = isDashed ? {borderStyle: 'dashed none none none'} : {}
    const lineStyle: React.CSSProperties = {
      borderTop: '1px solid #000',
      width: '100%',
      ...border,
    }
    return <div key={height} style={{bottom: height, position: 'absolute', width: '100%'}}>
      {label ? <span >{label}%</span> : null}
      <div style={lineStyle}></div>
    </div>
  }

  public render(): React.ReactNode {
    const {counts = {}, style, xLabel = []} = this.props
    const heightFactor = 2
    const histogramSourceText = `Enquête réalisée auprès
      des utilisateurs de ${config.productName} (${yearForData}).`
    const totalCounts = Object.values(counts).reduce((a: number, b: number): number => a + b)
    if (xLabel.length < 1) {
      return null
    }
    const figureStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      height: 250,
      position: 'relative',
    }
    return <div style={{maxWidth: 500, ...style}}>
      <div style={figureStyle}>
        <div style={{flex: 1}} />
        <div style={{alignItems: 'flex-end', display: 'flex', marginLeft: 50}}>
          {xLabel.map(
            (interviewNumber: string, index: number): React.ReactNode =>
              this.renderBar(
                Math.round((counts[interviewNumber] || 0) / totalCounts * 100) * heightFactor,
                interviewNumber,
                index))}
        </div>
        {_range(0, 125, 25).map((percent: number): React.ReactNode =>
          this.renderLine(percent * heightFactor, percent || undefined, !!percent))}
      </div>
      <DataSource style={{marginTop: 40}}>{histogramSourceText}</DataSource>
    </div>
  }
}


interface InterviewHistogramProps {
  interviewCounts: CountProps
  style?: React.CSSProperties
  totalInterviewCount: number
  userYou: YouChooser
}

class InterviewHistogram extends React.PureComponent<InterviewHistogramProps> {
  // Buckets for user interview counts Histogram.
  private static USER_INTERVIEW_COUNT_OPTIONS = ['0', '1', '2', '3', '4', '5+']

  private static getOptionFromInterviewCount(interviewCount: string): string|undefined {
    const firstOptionIndex = InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS[0]
    const lastOptionIndex = InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS.length - 1
    const lastOptionName = InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS[lastOptionIndex]

    // In the proto -1 is for no interviews while 0 is for unknown number of
    // interviews. We discard the latest as well as value we can't parse to int.
    if (interviewCount === '0') {
      return undefined
    }
    if (interviewCount === '-1') {
      return InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS[firstOptionIndex]
    }
    if (interviewCount in InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS) {
      return interviewCount
    }
    if (parseInt(interviewCount) >
      parseInt(InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS[lastOptionIndex - 1])) {
      return lastOptionName
    }
  }

  private static computeInterviewBuckets(
    interviewCounts: CountProps): CountProps {
    const interviewBuckets = {}
    Object.keys(interviewCounts).forEach((countNumber: string): void => {
      const bucketName = InterviewHistogram.getOptionFromInterviewCount(countNumber)
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
  }

  public render(): React.ReactNode {
    const {interviewCounts, style, totalInterviewCount, userYou} = this.props
    const userInterviewBucket = InterviewHistogram.getOptionFromInterviewCount(
      totalInterviewCount.toString())
    return <Histogram
      xLabel={InterviewHistogram.USER_INTERVIEW_COUNT_OPTIONS}
      userYou={userYou}
      userInterviewsBucket={userInterviewBucket || ''}
      counts={InterviewHistogram.computeInterviewBuckets(interviewCounts)}
      style={style} />
  }

}


interface HistogramBarProps {
  height: string
  isHighlighted: boolean
  style?: React.CSSProperties
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

const transparentBlue = colorToAlpha(colors.BOB_BLUE, .7)


const HistogramBarBase: React.FC<HistogramBarProps> =
(props: HistogramBarProps): React.ReactElement => {
  const {height, isHighlighted, style, title} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isHighlighted ? colors.BOB_BLUE : transparentBlue,
    height,
    position: 'relative',
    ...style,
  }), [height, isHighlighted, style])
  return <div style={containerStyle}>
    <div style={titleStyle}>{title}</div>
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


const DiplomaRequirementsHistogramBase: React.FC<DiplomaRequirementsHistogramProps> =
(props: DiplomaRequirementsHistogramProps): React.ReactElement => {
  const {highestDegree, requirements, style} = props
  let totalRequirement = 0
  const cumSumRequirements = requirements.map(
    (requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => {
      totalRequirement += requirement.percentRequired || 0
      return {
        ...requirement,
        percentRequired: totalRequirement,
      }
    })
  const percentNoRequirement = 100 - totalRequirement
  const accessibleOffers =
    [{name: 'Aucune fomation scolaire'} as bayes.bob.JobRequirement].concat(cumSumRequirements).map(
      (requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => ({
        ...requirement,
        percentRequired: (requirement.percentRequired || 0) + percentNoRequirement,
      }))
  return <div style={style}>
    <div style={barsContainerStyle}>
      {accessibleOffers.map((level: bayes.bob.JobRequirement): React.ReactNode =>
        <HistogramBar
          key={level.name} title={level.name || ''} height={`${level.percentRequired}%`}
          style={barStyle}
          isHighlighted={(level.diploma && level.diploma.level) === highestDegree} />
      )}
    </div>
    <DataSource style={{marginTop: 40}}>
      Offres d'emploi enregistrées par Pôle emploi (2015-2017)
    </DataSource>
  </div>
}
const DiplomaRequirementsHistogram = React.memo(DiplomaRequirementsHistogramBase)


export {CategoriesTrain, DiplomaRequirementsHistogram, FrenchDepartementsMap, InterviewHistogram,
  JobGroupStressBars, StressPictorialChart}
