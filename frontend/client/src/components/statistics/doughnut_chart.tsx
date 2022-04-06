import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import isMobileVersion from 'store/mobile'
import {bobSourceText} from 'store/statistics'

import {colorToAlpha} from 'components/colors'
import DataSource from 'components/data_source'


interface CountProps {
  [label: string]: number
}

interface Label {
  name: string
  value: string
}

interface Props {
  counts: CountProps
  circlePadding?: number
  height?: number
  isSegmentsStartingTop?: boolean
  labels: readonly Label[]
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
  labels: readonly Label[],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ['WebkitPrintColorAdjust' as any]: 'exact',
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

const DoughnutChart: React.FC<Props> = (props: Props): React.ReactElement => {
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
    <DataSource style={{marginTop: 30}}>{translate(...bobSourceText)}</DataSource>
  </figure>
}


export default React.memo(DoughnutChart)
