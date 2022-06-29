import _range from 'lodash/range'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {bobSourceText} from 'store/statistics'

import DataSource from 'components/data_source'


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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['WebkitPrintColorAdjust' as any]: 'exact',
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
    <DataSource style={{marginTop: 40}}>{translate(...bobSourceText)}</DataSource>
  </div>
}
const Histogram = React.memo(HistogramBase)


interface Props {
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
  if (Number.parseInt(interviewCount) >
    Number.parseInt(USER_INTERVIEW_COUNT_OPTIONS[lastOptionIndex - 1])) {
    return lastOptionName
  }
}


const InterviewHistogram = (props: Props): React.ReactElement => {
  const {interviewCounts, style, totalInterviewCount} = props
  const interviewCount = totalInterviewCount.toString()

  const userInterviewBucket = getOptionFromInterviewCount(interviewCount)

  const counts = useMemo((): CountProps => {
    const interviewBuckets: {[bucketName: string]: number} = {}
    for (const countNumber of Object.keys(interviewCounts)) {
      const bucketName = getOptionFromInterviewCount(countNumber)
      if (!bucketName) {
        continue
      }
      if (bucketName in interviewBuckets) {
        interviewBuckets[bucketName] += interviewCounts[countNumber]
      } else {
        interviewBuckets[bucketName] = interviewCounts[countNumber]
      }
    }
    return interviewBuckets
  }, [interviewCounts])

  return <Histogram
    xLabel={USER_INTERVIEW_COUNT_OPTIONS}
    userInterviewsBucket={userInterviewBucket || ''}
    counts={counts}
    style={style} />
}

export default React.memo(InterviewHistogram)
