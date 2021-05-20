import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {Link} from 'react-router-dom'
import VisibilitySensor from 'react-visibility-sensor'

import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {useRadium} from 'components/radium'
import {SmoothTransitions} from 'components/theme'

import {DispatchAllUpskillingActions, showUpskillingSection} from '../store/actions'
import {horizontalPagePadding} from './padding'

import Job from './job'

interface SectionProps extends bayes.upskilling.Section {
  id: string
  isExpanded?: true
  style?: React.CSSProperties
}

const sectionPaddingLeft = 25

const sectionTitleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: isMobileVersion ? 16 : 22,
  fontWeight: 'bold',
  margin: 0,
}
const jobMargin = 6
const maxJobWidth = 330

const seeMoreHighlightedStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: '#000',
}
const seeMoreLinkStyle: RadiumCSSProperties = {
  ':focus': seeMoreHighlightedStyle,
  ':hover': seeMoreHighlightedStyle,
  'alignItems': 'center',
  'border': `solid 1px ${colorToAlpha('#fff', .2)}`,
  'borderRadius': 2,
  'color': 'inherit',
  'display': 'flex',
  'flex': 'none',
  'fontSize': 14,
  'fontWeight': 'bold',
  'padding': '2px 0px 3px 9px',
  'textDecoration': 'none',
  ...SmoothTransitions,
}
const seeMoreLinkMobileStyle: RadiumCSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.GREYISH_BROWN_TWO,
  borderRadius: 5,
  color: 'inherit',
  display: 'flex',
  flex: 'none',
  fontSize: 14,
  fontWeight: 'bold',
  height: 100,
  padding: '0px 50px',
  textDecoration: 'none',
}
const titleContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 18,
}

const navigationButtonSpecialStyle: React.CSSProperties = {
  transform: 'none',
}
const navigationButtonBaseStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colorToAlpha('#000', .3),
  borderRadius: 0,
  cursor: 'pointer',
  display: 'flex',
  height: 150,
  justifyContent: 'center',
  padding: 0,
  position: 'absolute',
  top: 2,
  transform: 'none',
  width: 60,
}
const navigationButtonStyle: RadiumCSSProperties = {
  ':active': navigationButtonSpecialStyle,
  ':hover': navigationButtonSpecialStyle,
  ...navigationButtonBaseStyle,
}
const jobsListContainerBaseStyle: React.CSSProperties = {
  display: 'flex',
}
const Section = ({id, isExpanded, name, jobs, style}: SectionProps): React.ReactElement => {
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const isSelection = id === 'selection'
  const ref = useRef<null|HTMLUListElement>(null)
  const [{jobWidth, nbJobsShown}, setJobWidth] = useState({jobWidth: 0, nbJobsShown: 0})
  const [lastVisibleJobPosition, setLastVisibleJobPosition] = useState(0)
  const [nextJobShown, setNextJobShown] = useState(0)
  const [handlers, {isFocused, isHovered}] = useRadium({})
  const jobMarginFinal = isMobileVersion && isExpanded ? 0 : jobMargin
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const sectionWidth = ref.current.clientWidth
    const maxNbJobsShown = isMobileVersion ? 2 : 5
    const nbJobsShown = Math.min(
      Math.ceil(sectionWidth / (maxJobWidth + jobMarginFinal)), maxNbJobsShown)
    // 20 is used to display the arrow above the next / previous card
    setJobWidth({jobWidth: sectionWidth / nbJobsShown - jobMarginFinal - 20, nbJobsShown})
    setLastVisibleJobPosition(nbJobsShown)
    setNextJobShown(nbJobsShown)
  }, [jobMarginFinal])
  useEffect(() => {
    ref.current?.scrollTo({
      behavior: 'smooth',
      left: (jobWidth + jobMarginFinal) * (nextJobShown - nbJobsShown),
    })
    setLastVisibleJobPosition(nextJobShown)
  }, [jobMarginFinal, jobWidth, nbJobsShown, nextJobShown])
  const jobStyle = useMemo(() => ({
    marginRight: jobMarginFinal,
    paddingBottom: isMobileVersion ? 20 : 0,
    width: jobWidth,
  }), [jobMarginFinal, jobWidth])
  const realJobs = jobs?.filter((job): job is ValidUpskillingJob => !!job?.jobGroup?.romeId) || []
  const nbJobsTotal = realJobs.length
  const [hasBeenSeen, setSeen] = useState(false)
  useEffect(() => {
    if (!nbJobsShown || !hasBeenSeen) {
      return
    }
    dispatch(
      showUpskillingSection(id, isExpanded ? nbJobsTotal : Math.min(nbJobsShown, nbJobsTotal)))
  }, [dispatch, hasBeenSeen, id, isExpanded, nbJobsShown, nbJobsTotal, setLastVisibleJobPosition])
  const goForward = useCallback((): void => {
    setNextJobShown(lastVisibleJobPosition + nbJobsShown)
  }, [lastVisibleJobPosition, nbJobsShown])
  const goBackward = useCallback((): void => {
    setNextJobShown(lastVisibleJobPosition - nbJobsShown)
  }, [lastVisibleJobPosition, nbJobsShown])
  const sectionStyle: React.CSSProperties = {
    minHeight: isMobileVersion ? 250 : 320,
    paddingLeft: isExpanded && isMobileVersion ? 10 : sectionPaddingLeft,
    paddingRight: isExpanded && isMobileVersion ? 10 : sectionPaddingLeft,
    position: 'relative',
  }
  const jobListStyle: React.CSSProperties = {
    display: 'flex',
    ...isExpanded ? {flexWrap: 'wrap'} : {},
    flex: 1,
    listStyle: 'none',
    ...isMobileVersion && isExpanded && {justifyContent: 'space-around'},
    margin: 0,
    overflow: 'auto',
    padding: 0,
    position: 'relative',
    width: '100%',
  }
  const buttonLeftSpecialStyle: React.CSSProperties = {
    display: (isFocused || isHovered) && !isExpanded && realJobs.length > nbJobsShown &&
      lastVisibleJobPosition > nbJobsShown ? 'inherit' : 'none',
    left: 0,
    margin: '-2px 0',
  }
  const buttonLeftStyle: RadiumCSSProperties = {
    ...navigationButtonStyle,
    ...buttonLeftSpecialStyle,
  }
  const buttonRightSpecialStyle: React.CSSProperties = {
    display: (isFocused || isHovered) && !isExpanded && realJobs.length > nbJobsShown &&
      lastVisibleJobPosition < realJobs.length ? 'inherit' : 'none',
    margin: '-2px 0',
    right: 0,
  }
  const buttonRightStyle: RadiumCSSProperties = {
    ...navigationButtonStyle,
    ...buttonRightSpecialStyle,
  }
  const [seeMoreHandlers] = useRadium({
    style: isMobileVersion ? seeMoreLinkMobileStyle : seeMoreLinkStyle,
  })
  const paddingPage = horizontalPagePadding + sectionPaddingLeft
  const jobsContainerStyle: React.CSSProperties = {
    ...isExpanded ? {} : {marginLeft: -paddingPage, marginRight: -sectionPaddingLeft},
    maxWidth: '100vw',
    minHeight: isMobileVersion ? 230 : 300,
    overflow: 'hidden',
    position: 'relative',
  }
  const jobsListContainerStyle: React.CSSProperties = {
    ...jobsListContainerBaseStyle,
    ...isExpanded ? {} : {
      bottom: -15,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }
  const seeMoreLink = <Link {...seeMoreHandlers} to={`/${id}`}>
    {isSelection ? t('Voir tout') : t('Voir tous les métiers')}
    <ChevronRightIcon style={{marginLeft: 10}} />
  </Link>
  const hasJobsOverflow = realJobs.length > nbJobsShown
  return <VisibilitySensor
    active={!hasBeenSeen} partialVisibility={true} onChange={setSeen} intervalDelay={250}>
    <section id={id} style={style ? {...sectionStyle, ...style} : sectionStyle}>
      {isExpanded ? null : <div style={titleContainerStyle}>
        <h2 style={sectionTitleStyle}>{name}</h2>
        {hasJobsOverflow && !isMobileVersion ? seeMoreLink : null}
      </div>}
      <div style={jobsContainerStyle}>
        <div {...handlers} style={jobsListContainerStyle}>
          <ul ref={ref} style={jobListStyle} className="no-scrollbars">
            {isExpanded ? null : <li style={{minWidth: paddingPage, width: paddingPage}}></li>}
            {realJobs.map(job => <li
              style={{paddingBottom: isMobileVersion ? 0 : 40}} key={job.jobGroup.romeId}>
              <Job sectionId={id} job={job} style={jobStyle} />
            </li>)}
            {isExpanded && isMobileVersion ? <div style={jobStyle} /> : null}
            {isMobileVersion && !isExpanded && hasJobsOverflow ? <React.Fragment>
              {seeMoreLink}
              <div style={{minWidth: 25}} />
            </React.Fragment> : null}
          </ul>
          <Button onClick={goBackward} style={buttonLeftStyle} title={t('Métiers précédents')}>
            <ChevronLeftIcon size={40} />
          </Button>
          <Button onClick={goForward} style={buttonRightStyle} title={t('Métiers suivants')}>
            <ChevronRightIcon size={40} />
          </Button>
        </div>
      </div>
    </section>
  </VisibilitySensor>
}
export default React.memo(Section)
