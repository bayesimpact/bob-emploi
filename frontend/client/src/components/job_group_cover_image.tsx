import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {genderizeJob} from 'store/job'
import isMobileVersion from 'store/mobile'
import {useGender} from 'store/user'

import {Styles} from 'components/theme'

import noCoverImage from 'images/no-job-cover.png'


interface CoverImageWithTitleAndTextProps {
  children?: React.ReactNode
  cityName?: string
  cityStyle?: React.CSSProperties
  imageStyle?: React.CSSProperties
  jobStyle?: React.CSSProperties
  targetJob?: bayes.bob.Job
  titleElement?: 'p'|'h1'|'h2'
  style?: React.CSSProperties
}

const CoverImageWithTitleAndTextBase = (props: CoverImageWithTitleAndTextProps):
React.ReactElement => {
  const {children, cityName, cityStyle, imageStyle, jobStyle, targetJob,
    titleElement = 'p', targetJob: {jobGroup: {romeId = undefined} = {}} = {}, style} = props
  const {t} = useTranslation('components')
  const gender = useGender()
  const jobName = genderizeJob(targetJob, gender) || t('Trouver un emploi')
  const jobTextStyle: React.CSSProperties = {
    fontSize: 23,
    margin: '0 0 4px',
    textAlign: 'center',
    textTransform: 'uppercase',
    ...jobStyle,
  }
  const cityTextStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 'normal',
    margin: 0,
    textAlign: 'center',
    ...cityStyle,
  }
  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    borderRadius: 15,
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 'bold',
    margin: '0 auto',
    padding: '36px 0',
    position: 'relative',
    textAlign: 'center',
    textShadow: '0 3px 4px rgba(0, 0, 0, 0.5)',
    ...style,
  }
  const JobCoverImageStyle = {
    borderRadius: containerStyle.borderRadius,
    overflow: 'hidden',
    ...imageStyle,
  }
  return <div style={containerStyle}>
    <JobGroupCoverImage romeId={romeId} style={JobCoverImageStyle} />
    {React.createElement(titleElement, {style: jobTextStyle}, jobName)}
    {cityName ? <p style={cityTextStyle}>{cityName}</p> : null}
    {children}
  </div>
}
export const CoverImageWithTitleAndText = React.memo(CoverImageWithTitleAndTextBase)

interface Props {
  blur?: number
  coverOpacity?: number
  grayScale?: number
  opaqueCoverColor?: string
  opaqueCoverGradient?: {
    left: string
    middle?: string
    right: string
  }
  romeId?: string
  style?: React.CSSProperties
}

const coverAll: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export function getJobGroupCoverImageURL(romeId: string): string {
  return (isMobileVersion ? config.jobGroupImageSmallUrl : config.jobGroupImageUrl).
    replace('ROME_ID', romeId)
}

const JobGroupCoverImage: React.FC<Props> = (props: Props): React.ReactElement => {
  const {blur, coverOpacity = .4, grayScale, opaqueCoverColor = '#000',
    opaqueCoverGradient, romeId = '', style} = props
  const coverUrl = romeId ? getJobGroupCoverImageURL(romeId) : noCoverImage
  const filters = useMemo((): readonly string[] => {
    const filters: string[] = []
    if (blur) {
      filters.push(`blur(${blur}px)`)
    }
    if (grayScale) {
      filters.push(`grayscale(${grayScale}%)`)
    }
    return filters
  }, [blur, grayScale])
  const coverImageStyle = useMemo((): React.CSSProperties => ({
    ...coverAll,
    backgroundImage: coverUrl ? `url("${coverUrl}")` : 'inherit',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    zIndex: -2,
    ...(filters.length ? Styles.VENDOR_PREFIXED('filter', filters.join(' ')) : undefined),
  }), [filters, coverUrl])
  const containerStyle = useMemo((): React.CSSProperties => ({
    ...coverAll,
    ...style,
    ...(blur ? {overflow: 'hidden'} : undefined),
  }), [blur, style])
  const opaqueCoverStyle = useMemo((): React.CSSProperties => {
    const additionalStyle: React.CSSProperties = {}
    if (opaqueCoverGradient) {
      const gradientParts = ['104deg', opaqueCoverGradient.left]
      if (opaqueCoverGradient.middle) {
        gradientParts.push(opaqueCoverGradient.middle)
      }
      gradientParts.push(opaqueCoverGradient.right)
      additionalStyle.background = `linear-gradient(${gradientParts.join(', ')})`
    }
    return {
      ...coverAll,
      backgroundColor: opaqueCoverColor,
      opacity: coverOpacity,
      zIndex: -1,
      ...additionalStyle,
    }
  }, [coverOpacity, opaqueCoverColor, opaqueCoverGradient])
  return <div style={containerStyle}>
    {coverUrl ? <div style={coverImageStyle} /> : null}
    <div style={opaqueCoverStyle} />
  </div>
}


export default React.memo(JobGroupCoverImage)
