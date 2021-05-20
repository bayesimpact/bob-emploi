import React from 'react'
import {useTranslation} from 'react-i18next'

import {LocalizableString, prepareT} from 'store/i18n'
import {bobSourceText} from 'store/statistics'

import DataSource from 'components/data_source'
import HistogramBar, {barsContainerStyle, barStyle} from 'components/statistics/histogram_bar'

interface Props {
  counts: readonly bayes.bob.PassionLevelCount[]
  passionLevel?: bayes.bob.PassionateLevel
  style?: React.CSSProperties
}

interface PassionLevelOption {
  altText: LocalizableString
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
] as const

const motivationBarsContainerStyle = {
  ...barsContainerStyle,
  height: 100,
} as const

// TODO(sil): Add a legend and find a better title.
const PassionLevelHistogram: React.FC<Props> = (props: Props): React.ReactElement => {
  const {passionLevel, counts, style} = props
  const {t: translate} = useTranslation()
  const totalCounts = counts.reduce((total: number, {count}): number => {
    return total += count || 0
  }, 0)
  const formattedCounts = passionLevelOptions.map((option: PassionLevelOption):
  SearchLenghtMotivationCounts => {
    const categoryCount = counts.find(count => count.passionateLevel === option.value)
    return {
      altText: translate(...option.altText),
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
    <DataSource style={{marginTop: 40}}>{translate(...bobSourceText)}</DataSource>
  </div>
}


export default React.memo(PassionLevelHistogram)
