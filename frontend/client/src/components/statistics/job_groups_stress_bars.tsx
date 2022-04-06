import _keyBy from 'lodash/keyBy'
import _sortBy from 'lodash/sortBy'
import React, {useRef} from 'react'
import {useTranslation} from 'react-i18next'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import {dataSourceYear as yearForData} from 'store/statistics'

import useOnScreen from 'hooks/on_screen'

import DataSource from 'components/data_source'
import {SmoothTransitions} from 'components/theme'


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
const fixScale = (score: number): number => score > 0 ?
  (.5 + 10 * Math.min(1, Math.log10(score))) / .12 : 0


interface StressBarProps extends bayes.bob.RelatedJobGroup {
  color: string
  isLogScale: boolean
  isMarketScoreShown?: boolean
  isTarget?: boolean
  maxBarWidth: number | string
  style?: React.CSSProperties
  value: number
}


const JobGroupStressBarBase: React.FC<StressBarProps> =
(props: StressBarProps): React.ReactElement|null => {
  const {
    color,
    isLogScale,
    isMarketScoreShown,
    isTarget,
    jobGroup: {name = ''} = {},
    maxBarWidth,
    mobilityType = '',
    style,
    value,
  } = props
  const {t} = useTranslation()
  const domRef = useRef<HTMLDivElement>(null)
  const hasStarted = useOnScreen(domRef, {isForAppearing: true})
  const width = hasStarted ? `${isLogScale ? fixScale(value) : value}%` : 1
  const barStyle: React.CSSProperties = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
    backgroundColor: color,
    flex: 'none',
    height: 5,
    position: 'relative',
    width,
    ...SmoothTransitions,
  }
  const bulletStyle: React.CSSProperties = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
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
  const marketScore = value > 0 ? '' + value : value ? '0' : t('données manquantes')
  const titleStyle: React.CSSProperties = {
    color: value ? 'initial' : colors.COOL_GREY,
    fontWeight: isTarget ? 'bold' : 'normal',
  }
  return <div
    style={containerStyle}
    title={isMarketScoreShown ? marketScore : undefined}>
    <div ref={domRef} style={{flexShrink: 0, width: maxBarWidth}}>
      {value ? <div style={barStyle}>
        <div style={bulletStyle} />
      </div> : null}
    </div>
    <span style={titleStyle}>
      {name}
      {isTarget ? ` (${t('vous')})` : null}
      {/* Cannot have both a mobility type and a missing value. */}
      {mobilityType === 'CLOSE' ? '*' : value ? '' : '**'}
    </span>
  </div>
}
const JobGroupStressBar = React.memo(JobGroupStressBarBase)


const isValidRelatedJobGroup = (g: bayes.bob.RelatedJobGroup):
g is bayes.bob.RelatedJobGroup & {jobGroup: {romeId: string}} =>
  !!(g.jobGroup && g.jobGroup.romeId)


interface Props {
  areValuesShown?: boolean
  context?: string
  getValue?: (jobGroup: bayes.bob.RelatedJobGroup) => number
  getValueColor?: (value: number) => string
  isLogScale?: boolean
  jobGroups: readonly bayes.bob.RelatedJobGroup[]
  maxBarWidth?: number | string
  segments?: readonly {label: LocalizableString; max: number; min: number}[]
  source?: string
  style?: React.CSSProperties
  targetJobGroups: readonly bayes.bob.RelatedJobGroup[]
}


const jobGroupStressBarsCaptionStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 14,
  marginTop: 25,
  paddingTop: 15,
  position: 'relative',
  textAlign: 'right',
}


const getMarketStressValue = (jobGroup: bayes.bob.RelatedJobGroup) =>
  jobGroup.localStats?.imt?.yearlyAvgOffersPer10Candidates || 0

const MARKET_SCORE_SEGMENTS = [
  {label: prepareT('Forte', {context: 'market'}), max: 2, min: 1},
  {label: prepareT('Moyenne', {context: 'market'}), max: 6, min: 2},
  {label: prepareT('Faible', {context: 'market'}), max: 10, min: 6},
] as const

const JobGroupStressBars: React.FC<Props> = (props: Props): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const defaultSource = translate(config.dataSourceLMI, {dataSourceYear: yearForData})
  const {
    areValuesShown,
    getValue = getMarketStressValue,
    getValueColor = colorFromMarketScore,
    isLogScale = true,
    jobGroups,
    maxBarWidth = 330,
    segments = MARKET_SCORE_SEGMENTS,
    source = defaultSource,
    style,
    targetJobGroups = [],
  } = props
  const applyScale = isLogScale ? fixScale : (x: number) => x
  const captionEltStyle = (min: number, max: number): React.CSSProperties => ({
    color: getValueColor((min + max) / 2),
    left: `${(applyScale(min) + applyScale(max)) / 2}%`,
    position: 'absolute',
    transform: 'translateX(-50%)',
  })
  // TODO(cyrille): Maybe do a cleverer merge of related jobs with the same romeId.
  const allJobGroups = _keyBy(
    [...jobGroups, ...targetJobGroups].filter(isValidRelatedJobGroup),
    ({jobGroup: {romeId}}): string => romeId)
  const targetRomeIds = new Set(targetJobGroups.
    filter(isValidRelatedJobGroup).
    map(({jobGroup: {romeId}}) => romeId))
  // TODO(cyrille): Consider sorting with smaller values at top for automation risk.
  const sortedJobGroups = _sortBy(Object.values(allJobGroups), getValue).reverse()
  const hasAnyCloseJob = sortedJobGroups.some(({mobilityType}): boolean => mobilityType === 'CLOSE')
  const hasAnyMissingData = !sortedJobGroups.every(getValue)
  return <figure style={style}>
    {sortedJobGroups.filter(isValidRelatedJobGroup).map((relatedJobGroup, index): React.ReactNode =>
      <JobGroupStressBar
        maxBarWidth={maxBarWidth}
        style={{marginTop: index ? 15 : 0}} key={relatedJobGroup.jobGroup.romeId}
        isMarketScoreShown={areValuesShown} isLogScale={isLogScale}
        value={getValue(relatedJobGroup)} color={getValueColor(getValue(relatedJobGroup))}
        isTarget={targetRomeIds.has(relatedJobGroup.jobGroup.romeId)} {...relatedJobGroup} />)}
    <figcaption style={jobGroupStressBarsCaptionStyle}>
      <div style={{position: 'relative', width: maxBarWidth}}>
        {segments.map(({max, min, label}) => <span key={label[0]} style={captionEltStyle(min, max)}>
          {translate(...label)}
        </span>)}
      </div>
      <div style={{fontStyle: 'italic'}}>
        {hasAnyCloseJob ? <div>* {t('ne nécessite pas de formation')}</div> : null}
        {hasAnyMissingData ? <div>** {t('données manquantes')}</div> : null}
      </div>
    </figcaption>
    <DataSource style={{margin: '15px 0 0'}} isStarShown={false}>
      {source}
    </DataSource>
  </figure>
}


export default React.memo(JobGroupStressBars)
