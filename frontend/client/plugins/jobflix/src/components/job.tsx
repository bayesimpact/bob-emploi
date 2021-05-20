import AddIcon from 'mdi-react/AddIcon'
import CheckIcon from 'mdi-react/CheckIcon'
import React, {useCallback, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useHistory} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'

import useCachedData from 'hooks/cached_data'
import {useIsTabNavigationUsed} from 'hooks/tab_navigation'
import {RootState, getLaborStats} from 'store/actions'
import {genderizeJob} from 'store/job'
import isMobileVersion from 'store/mobile'

import {colorToAlpha} from 'components/colors'
import {useHover, useHoverAndFocus} from 'components/radium'
import {getJobGroupCoverImageURL} from 'components/job_group_cover_image'
import {SmoothTransitions} from 'components/theme'

import {DispatchAllUpskillingActions, selectUpskillingJob,
  exploreUpskillingJob} from '../store/actions'

interface Props {
  job: ValidUpskillingJob
  sectionId: string
  style?: React.CSSProperties
}

const exploreHiddenStyle: React.CSSProperties = {
  backdropFilter: 'blur(2px)',
  border: '1px solid #fff',
  borderRadius: 2,
  fontSize: 14,
  fontWeight: 'bold',
  opacity: 0,
  padding: '10px 20px',
  textTransform: 'uppercase',
  zIndex: 1,
  ...SmoothTransitions,
}
const exploreShownStyle: React.CSSProperties = {
  ...exploreHiddenStyle,
  opacity: 1,
}
const exploreHighlightedStyle: React.CSSProperties = {
  ...exploreShownStyle,
  backgroundColor: '#fff',
  color: '#000',
}

const addToListHiddentStyle: React.CSSProperties = {
  alignItems: 'center',
  backdropFilter: 'blur(4px)',
  border: 'solid 1px #fff',
  borderRadius: 15,
  display: 'flex',
  height: 30,
  justifyContent: 'center',
  opacity: 0,
  position: 'absolute',
  right: 15,
  top: 15,
  width: 30,
  ...SmoothTransitions,
  zIndex: 1,
}
const addToListShownStyle: React.CSSProperties = {
  ...addToListHiddentStyle,
  opacity: 1,
}
const addToListHighlightedStyle: React.CSSProperties = {
  ...addToListShownStyle,
  backgroundColor: '#fff',
  color: '#000',
}
const trainingStyle: React.CSSProperties = {
  backgroundColor: colors.GREYISH_BROWN_TWO,
  color: '#fff',
  display: 'inline-block',
  fontSize: isMobileVersion ? 11 : 13,
  fontWeight: 'bold',
  marginTop: 10,
  padding: '6px 8px',
}

const Job = (props: Props): null|React.ReactElement => {
  const {job, job: {jobGroup: {romeId}, shownMetric}, sectionId, style} = props
  const isSelected = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs?.
      some(({jobGroup}) => romeId === jobGroup?.romeId))
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const gender = useSelector(
    ({user: {profile: {gender = undefined} = {}} = {}}: RootState) => gender)
  const areaId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const fetchJobGroupAction = useMemo(() => getLaborStats(romeId, areaId), [romeId, areaId])
  const {data: {samples: [sampleJob = {}] = [], trainingCount: {longTrainings = 0,
    onlineTrainings = 0, openTrainings = 0, shortTrainings = 0, veryShortTrainings = 0} = {}} = {}}
    = useCachedData(
      ({app: {jobGroupInfos: {[romeId]: jobGroupInfo} = {}}}) => jobGroupInfo,
      fetchJobGroupAction,
      ({jobGroupInfo}) => jobGroupInfo,
    )
  const trainings = longTrainings + onlineTrainings + openTrainings + shortTrainings +
    veryShortTrainings
  const name = genderizeJob(sampleJob, gender)
  const {t} = useTranslation()
  const history = useHistory()
  const exploreJob = useCallback(() => {
    dispatch(exploreUpskillingJob(job, sectionId))
    if (isMobileVersion) {
      history.push(`/${sectionId}/${romeId}`)
    }
  }, [dispatch, history, job, romeId, sectionId])
  const {isHovered, ...handlers} = useHover()
  const {isFocused: isExploreFocused, isHovered: isExploreHovered, ...exploreHandlers} =
    useHoverAndFocus()
  const {isFocused: isAddFocused, isHovered: isAddHovered, ...addHandlers} = useHoverAndFocus()
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const selectJob = useCallback(() => {
    if (!job) {
      return
    }
    dispatch(selectUpskillingJob('netflix', job, sectionId))
    if (!isTabNavigationUsed) {
      addButtonRef.current?.blur()
    }
  }, [dispatch, isTabNavigationUsed, job, sectionId])
  const isHighlighted = isHovered || isExploreFocused || isAddFocused
  const isExploreHighlighted = isExploreFocused || isExploreHovered
  const isAddHighlighted = isAddFocused || isAddHovered
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 14,
    height: '100%',
    ...style,
  }
  const exploreStyle = isExploreHighlighted ? exploreHighlightedStyle :
    isHighlighted ? exploreShownStyle : exploreHiddenStyle
  const addToListStyle = isAddHighlighted ? addToListHighlightedStyle :
    isHighlighted ? addToListShownStyle : addToListHiddentStyle
  const thumbnailStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundImage: `url(${getJobGroupCoverImageURL(romeId)})`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    borderRadius: 5,
    display: 'flex',
    flex: 'none',
    height: isMobileVersion ? 100 : 150,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    zIndex: 0,
  }
  const highlightBackgroundStyle: React.CSSProperties = {
    backgroundColor: colorToAlpha(colors.DARK, .7),
    border: 'solid 2px #fff',
    borderRadius: 5,
    bottom: 0,
    left: 0,
    opacity: isHighlighted ? 1 : 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  }
  const addLabelStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: colorToAlpha('#000', .12),
    borderRadius: 15,
    bottom: 0,
    color: '#fff',
    display: 'flex',
    // TODO(cyrille): Try to make this appear from the AddIcon.
    opacity: isAddHighlighted ? 1 : 0,
    padding: '0 40px 0 15px',
    position: 'absolute',
    right: 0,
    top: 0,
    whiteSpace: 'nowrap',
    ...SmoothTransitions,
  }
  const jobNameStyle: React.CSSProperties = {
    fontSize: isMobileVersion ? 14 : 17,
    fontWeight: 'bold',
  }
  const metricStyle: React.CSSProperties = {
    color: colors.GREYISH,
    fontSize: isMobileVersion ? 12 : 14,
  }

  const Icon = isSelected ? CheckIcon : AddIcon
  const containerProps = isMobileVersion ? {onClick: exploreJob, role: 'button'} : handlers
  return <div {...containerProps} style={containerStyle}>
    <div style={thumbnailStyle}>
      <div style={highlightBackgroundStyle} />
      {isMobileVersion ? null : <React.Fragment>
        <button onClick={exploreJob} {...exploreHandlers} style={exploreStyle}>
          {t('Explorer')}
        </button>
        <button ref={addButtonRef} onClick={selectJob} {...addHandlers} style={addToListStyle}>
          <div style={addLabelStyle}>
            {isSelected ? t('Retirer de ma liste') : t('Ajouter à ma liste')}
          </div>
          <Icon size={20} />
        </button>
      </React.Fragment>}
    </div>
    <div style={{flex: 1, marginTop: 10}}>
      <div style={jobNameStyle}>{name}</div>
      <div style={metricStyle}>{shownMetric}</div>
      {trainings > 0 ?
        <div style={trainingStyle}>
          {t('{{count}} formation disponible', {count: trainings})}</div>
        : null}
    </div>
  </div>
}

export default React.memo(Job)
