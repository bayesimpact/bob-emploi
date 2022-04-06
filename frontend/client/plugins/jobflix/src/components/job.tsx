import InformationOutlineIcon from 'mdi-react/InformationOutlineIcon'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useHistory} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'

import useCachedData from 'hooks/cached_data'
import type {RootState} from 'store/actions'
import {genderizeJob} from 'store/job'
import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import {InertButton} from 'components/button'
import Emoji from 'components/emoji'
import {useHoverAndFocus} from 'components/radium'
import {getJobGroupCoverImageURL} from 'components/job_group_cover_image'

import type {DispatchAllUpskillingActions} from '../store/actions'
import {exploreUpskillingJob, getLaborStats} from '../store/actions'
import {SELECTION_SECTION} from '../store/constants'

interface Props {
  job: ValidUpskillingJob
  sectionId: string
  style?: React.CSSProperties
}

interface PerkProps {
  isHovered: boolean
  perk: bayes.upskilling.JobPerk
}

interface JobPerkVisual {
  emoji: string
  text: LocalizableString
}

const PERKS: Record<bayes.upskilling.JobPerk, undefined|JobPerkVisual> = {
  GOOD_SALARY: {emoji: '💰', text: prepareT('Salaire intéressant')},
  NOW_HIRING: {emoji: '🔥', text: prepareT('Recrute')},
  PAID_TRAINING: {emoji: '💰', text: prepareT('Formation rémunérée')},
  UNKNOWN_PERK: undefined,
}

const PerkBase = ({isHovered = false, perk}: PerkProps) => {
  const {emoji, text} = PERKS[perk] || {}
  const {t: translate} = useTranslation()
  if (!text || !emoji) {
    return null
  }
  const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    border: `1px solid ${isHovered ? colors.JOB_PERK_HOVERED_BORDER : colors.JOB_PERK_BORDER}`,
    borderRadius: 15,
    display: 'inline-flex',
    fontSize: 14,
    marginRight: 4,
    padding: '4px 8px',
  }
  return <span style={containerStyle}>
    <Emoji size={18} aria-hidden={true}>{emoji}</Emoji>{translate(...text)}
  </span>
}
const Perk = React.memo(PerkBase)

const exploreCtaStyle: React.CSSProperties = {
  alignItems: 'center',
  alignSelf: 'flex-end',
  display: 'flex',
  fontWeight: 'bold',
  justifyContent: 'center',
  marginTop: 15,
  textShadow: 'none',
  width: '100%',
  ...config.isJobRounded ? {borderRadius: 100} : {},
}
const specialExploreCtaStyle: React.CSSProperties = {
  ...exploreCtaStyle,
  backgroundColor: colors.WHITE,
  color: colors.DARK_TWO,
}

const jobNameStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 14 : 17,
  fontWeight: 'bold', // TODO(émilie): no bold on Transition Pro
  marginTop: 10,
}

const Job = (props: Props): null|React.ReactElement => {
  const {job, job: {jobGroup: {romeId}, perks = []}, sectionId, style} = props
  const isOCR = config.hasOCR && romeId.startsWith('OCR')
  const isSelected = sectionId === SELECTION_SECTION
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const gender = useSelector(
    ({user: {profile: {gender = undefined} = {}} = {}}: RootState) => gender)
  const areaId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const fetchJobGroupAction = useMemo(() => getLaborStats(romeId, areaId), [romeId, areaId])
  const {data: {samples: [sampleJob = {}] = []} = {}} = useCachedData(
    ({app: {jobGroupInfos: {[romeId]: jobGroupInfo} = {}}}) => jobGroupInfo,
    fetchJobGroupAction,
    ({jobGroupInfo}) => jobGroupInfo,
  )
  const name = genderizeJob(sampleJob, gender)
  const {t} = useTranslation()
  const history = useHistory()
  const exploreJob = useCallback(() => {
    dispatch(exploreUpskillingJob(job, sectionId))
    if (isMobileVersion) {
      history.push(`/${sectionId}/${romeId}`)
    }
  }, [dispatch, history, job, romeId, sectionId])
  const {isHovered, isFocused, ...handlers} = useHoverAndFocus()
  const containerStyle: React.CSSProperties = {
    backgroundColor: isSelected ? colors.JOB_BACKGROUND_SELECTED :
      isHovered || isFocused || isOCR ? colors.JOB_BACKGROUND_HOVER : colors.JOB_BACKGROUND,
    borderRadius: config.isJobRounded ? 20 : 6,
    boxShadow: isHovered || isFocused || isOCR ? '0px 3px 5px rgba(0, 0, 0, 0.35)' :
      '0px 3px 5px rgba(0, 0, 0, 0.05)',
    color: isSelected ? colors.JOB_TEXT_SELECTED :
      isHovered || isFocused || isOCR ? colors.JOB_TEXT_HOVER : colors.TEXT,
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    height: '100%',
    padding: config.isJobRounded ? 10 : 8,
    ...style,
  }
  const thumbnailStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundImage: `url(${getJobGroupCoverImageURL(romeId)})`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    borderRadius: config.isJobRounded ? 13 : 5,
    display: 'flex',
    flex: 'none',
    height: isMobileVersion ? 100 : 150,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    zIndex: 0,
  }

  const exploreCta = isSelected ? t('Trouver une formation') : t('En savoir plus')
  const exploreButtonStyle = isOCR || isSelected ? specialExploreCtaStyle : exploreCtaStyle
  return <button
    type="button" {...isMobileVersion || handlers} onClick={exploreJob} style={containerStyle}>
    <span style={thumbnailStyle} />
    <span style={jobNameStyle}>{name}</span>
    <span style={{flex: 1}} />
    <span style={{marginTop: 10}}>
      {perks.map(perk => <Perk isHovered={isHovered} key={perk} perk={perk} />)}</span>
    {isSelected || isOCR ? <InertButton style={exploreButtonStyle}>
      <InformationOutlineIcon aria-hidden={true} focusable={false} />
      <span style={{marginLeft: '.5em'}}>{exploreCta}</span>
    </InertButton> : null}
  </button>
}

export default React.memo(Job)
