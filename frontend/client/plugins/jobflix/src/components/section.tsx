import _uniqueId from 'lodash/uniqueId'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import HeartIcon from 'mdi-react/HeartIcon'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {Link} from 'react-router-dom'

import isMobileVersion from 'store/mobile'

import useOnScreen from 'hooks/on_screen'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {useRadium} from 'components/radium'
import {SmoothTransitions} from 'components/theme'

import ocrLogo from '../images/ocr-logo.svg'
import type {DispatchAllUpskillingActions} from '../store/actions'
import {showUpskillingSection} from '../store/actions'
import {SELECTION_SECTION} from '../store/constants'
import {horizontalPagePadding} from './padding'

import Job from './job'

interface SectionProps extends bayes.upskilling.Section {
  id: string
  isExpanded?: true
  style?: React.CSSProperties
}

const sectionSidePadding = 25

const sectionTitleStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.TEXT,
  display: 'flex',
  fontFamily: config.titleFont ? config.titleFont : 'Lato, Helvetica',
  fontSize: isMobileVersion ? 16 : 22,
  fontWeight: 'bold',
  margin: 0,
}
const jobMargin = 6
const maxJobWidth = 300

const seeMoreHighlightedStyle: React.CSSProperties = {
  backgroundColor: colorToAlpha(colors.SEE_MORE_BUTTON_BACKGROUND_HOVER, config.isDark ? 1 : .05),
  border: `1px solid ${colors.SEE_MORE_BUTTON_BORDER_HOVER}`,
  color: colors.SEE_MORE_BUTTON_COLOR_HOVER,
}
const seeMoreLinkBaseStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BACKGROUND,
  border: `1px solid ${colors.NAVIGATION_MENU_BORDER}`,
  borderRadius: 16,
  color: 'inherit',
  display: 'flex',
  flex: 'none',
  fontSize: 12,
  fontWeight: 'bold',
  height: 30,
  textDecoration: 'none',

}
const seeMoreLinkMobileStyle: RadiumCSSProperties = {
  ...seeMoreLinkBaseStyle,
  margin: '12px 0 0',
  padding: '8px 12px',
  width: 'fit-content',
}
const seeMoreLinkStyle: RadiumCSSProperties = isMobileVersion ? seeMoreLinkMobileStyle : {
  ...seeMoreLinkBaseStyle,
  ':focus': seeMoreHighlightedStyle,
  ':hover': seeMoreHighlightedStyle,
  'margin': 0,
  'padding': 10,
  ...SmoothTransitions,
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
const navArrowWidth = 50
const navigationButtonBaseStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colorToAlpha('#000', .3),
  borderRadius: 0,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'center',
  padding: 0,
  transform: 'none',
  width: navArrowWidth,
  ...isMobileVersion ? {} : {
    height: 150,
    position: 'absolute',
    top: 10,
  },
}
const navigationButtonStyle: RadiumCSSProperties = {
  ':active': navigationButtonSpecialStyle,
  ':hover': navigationButtonSpecialStyle,
  ...navigationButtonBaseStyle,
}
const jobsListContainerStyle: React.CSSProperties = {
  display: 'flex',
}

const disclaimerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.GREYISH_BROWN_TWO,
  borderRadius: 30,
  display: 'flex',
  marginBottom: 10,
  padding: '6px 8px',
  width: 'fit-content',
}
const emojiStyle: React.CSSProperties = {
  marginRight: '.3em',
}
const sectionInstructionsStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'normal',
  margin: '5px 0 0',
  opacity: .8,
}
const strokedStyle: React.CSSProperties = {
  stroke: colorToAlpha('#000', .6),
  strokeLinejoin: 'round',
}
const buttonsContainerStyle: React.CSSProperties = isMobileVersion ? {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
  padding: '0 3px',
} : {}

const CatchyDisclaimerBase = (): React.ReactElement => {
  const {t} = useTranslation()
  return <div style={disclaimerStyle}>
    <span aria-hidden={true} style={emojiStyle}>🔥</span>
    {t('À ne pas manquer\u00A0!')}
  </div>
}
export const CatchyDisclaimer = React.memo(CatchyDisclaimerBase)

const sectionVertPadding = 20
const Section = ({id, isExpanded, isOCR: shouldBeOCR, name, jobs, style}: SectionProps):
React.ReactElement => {
  const isOCR = config.hasOCR && shouldBeOCR
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const isSelection = id === SELECTION_SECTION
  const ref = useRef<null|HTMLUListElement>(null)
  const [{jobWidth, nbJobsShown}, setJobWidth] = useState({jobWidth: 0, nbJobsShown: 0})
  const [isScrollAtStart, setIsScrollAtStart] = useState(true)
  const [isScrollAtEnd, setIsScrollAtEnd] = useState(true)
  const [handlers, {isFocused, isHovered}] = useRadium({})
  const jobMarginFinal = isMobileVersion && isExpanded ? 0 : jobMargin
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const sectionWidth = ref.current.clientWidth || window.innerWidth
    const shownJobsWidth = isExpanded ? sectionWidth : sectionWidth - 2 * navArrowWidth
    const maxNbJobsShown = isMobileVersion ? 1 : 4
    const nbJobsShown = Math.min(
      Math.ceil(sectionWidth / (maxJobWidth + jobMarginFinal)), maxNbJobsShown)
    // 2 * navArrowWidth is used to display the arrow over the next / previous card
    setJobWidth({
      jobWidth: (shownJobsWidth + jobMarginFinal) / nbJobsShown - jobMarginFinal,
      nbJobsShown,
    })
  }, [id, isExpanded, jobMarginFinal])
  const updateScrollAtEnd = useCallback((): void => {
    if (!ref.current) {
      return
    }
    const {offsetWidth, scrollLeft, scrollWidth} = ref.current
    setIsScrollAtEnd(scrollLeft + offsetWidth >= scrollWidth)
  }, [])
  const scrollByNJobs = useCallback((deltaJob: number): void => {
    if (!ref.current) {
      return
    }
    const stepWidth = jobWidth + jobMarginFinal
    const {scrollLeft} = ref.current
    const partJobShown = scrollLeft / stepWidth - Math.floor(scrollLeft / stepWidth)
    // Fit the scroll at the beginning of the step but keep in the view jobs that were only
    // partially visible before the scroll.
    const deltaStep = deltaJob - partJobShown + ((deltaJob > 0 || partJobShown < .0001) ? 0 : 1)
    ref.current?.scrollTo({
      behavior: 'smooth',
      left: scrollLeft + stepWidth * deltaStep,
    })
  }, [jobMarginFinal, jobWidth])
  const handleScroll = useCallback((): void => {
    if (!ref.current) {
      return
    }
    const {scrollLeft} = ref.current
    setIsScrollAtStart(scrollLeft <= 0)
    updateScrollAtEnd()
  }, [updateScrollAtEnd])
  const jobStyle = useMemo(() => ({
    marginRight: jobMarginFinal,
    width: jobWidth,
  }), [jobMarginFinal, jobWidth])
  const lastJobStyle = useMemo(() => ({width: jobWidth}), [jobWidth])
  const realJobs = jobs?.filter((job): job is ValidUpskillingJob => !!job?.jobGroup?.romeId) || []
  const nbJobsTotal = realJobs.length
  const domRef = useRef<HTMLElement>(null)
  const hasBeenSeen = useOnScreen(domRef, {isForAppearing: true})
  useEffect(() => {
    if (!nbJobsShown || !hasBeenSeen || isSelection) {
      return
    }
    dispatch(
      showUpskillingSection(id, isExpanded ? nbJobsTotal : Math.min(nbJobsShown, nbJobsTotal)))
  }, [dispatch, hasBeenSeen, id, isExpanded, isSelection, nbJobsShown, nbJobsTotal])
  useEffect(() => {
    if (!isSelection) {
      return
    }
    dispatch(showUpskillingSection(id))
  }, [dispatch, id, isSelection])
  useEffect(() => {
    updateScrollAtEnd()
  }, [isExpanded, jobs, nbJobsShown, updateScrollAtEnd])
  const goForward = useCallback(
    (): void => scrollByNJobs(nbJobsShown),
    [nbJobsShown, scrollByNJobs])
  const goBackward = useCallback(
    (): void => scrollByNJobs(-nbJobsShown),
    [nbJobsShown, scrollByNJobs])
  const sidePadding = isExpanded && isMobileVersion ? 25 : sectionSidePadding + (
    isOCR && !isExpanded ? horizontalPagePadding : 0)
  const sectionStyle: React.CSSProperties = {
    ...isOCR && !isExpanded && {
      backgroundColor: colors.OCR_SECTION_BACKGROUND,
      marginLeft: -horizontalPagePadding,
      marginRight: -horizontalPagePadding,
    },
    paddingBottom: sectionVertPadding,
    paddingLeft: sidePadding,
    paddingRight: sidePadding,
    paddingTop: sectionVertPadding,
    position: 'relative',
  }
  const pagePadding = horizontalPagePadding + sectionSidePadding
  const jobsRightPadding = pagePadding - jobMarginFinal
  const jobListStyle: React.CSSProperties = {
    display: 'flex',
    ...isExpanded ? {flexWrap: 'wrap'} : {},
    flex: 1,
    listStyle: 'none',
    ...isMobileVersion && isExpanded && {justifyContent: 'space-around'},
    margin: 0,
    overflow: 'auto',
    padding: isExpanded ? '0 0 9px 0' : `0 ${jobsRightPadding + 5}px 9px ${pagePadding}px`,
    position: 'relative',
    width: '100%',
  }
  const isBackButtonShown = (isMobileVersion || isFocused || isHovered) &&
    !isExpanded && !isScrollAtStart
  const buttonLeftSpecialStyle: React.CSSProperties = {
    left: 0,
    margin: '-2px 0',
    opacity: isBackButtonShown ? 1 : 0,
    pointerEvents: isBackButtonShown ? 'initial' : 'none',
    ...SmoothTransitions,
  }
  const buttonLeftStyle: RadiumCSSProperties = {
    ...navigationButtonStyle,
    ...buttonLeftSpecialStyle,
  }
  const isForwardButtonShown = (isMobileVersion || isFocused || isHovered)
    && !isExpanded && !isScrollAtEnd
  const buttonRightSpecialStyle: React.CSSProperties = {
    margin: '-2px 0',
    opacity: isForwardButtonShown ? 1 : 0,
    pointerEvents: isForwardButtonShown ? 'initial' : 'none',
    right: 0,
    ...SmoothTransitions,
  }
  const buttonRightStyle: RadiumCSSProperties = {
    ...navigationButtonStyle,
    ...buttonRightSpecialStyle,
  }
  const [seeMoreHandlers] = useRadium({style: seeMoreLinkStyle})
  const jobsContainerStyle: React.CSSProperties = {
    ...isExpanded ? {} : {marginLeft: -pagePadding, marginRight: -pagePadding},
    maxWidth: '100vw',
    overflow: 'hidden',
    position: 'relative',
  }
  const titleId = useMemo(_uniqueId, [])
  const seeMoreLink = isOCR ? <p style={seeMoreLinkStyle} aria-describedby={titleId}>
    <span aria-hidden={true} style={{marginRight: '.5em'}}>
      💸
    </span>
    {t('Formation rémunérée')}
  </p> : <Link {...seeMoreHandlers} to={`/${id}`} aria-describedby={titleId}>
    {isSelection ? t('Voir tout') :
      // i18next-extract-mark-context-next-line ["career", "promising-job"]
      t('Voir tous les métiers', {context: config.goalWordingContext})}
    <ChevronRightIcon size={17} style={{marginLeft: 10}} aria-hidden={true} focusable={false} />
  </Link>
  const hasJobsOverflow = realJobs.length > nbJobsShown
  return <section id={id} ref={domRef} style={style ? {...sectionStyle, ...style} : sectionStyle}>
    {isExpanded ? null : <div style={titleContainerStyle}>
      {isOCR ? isMobileVersion ?
        <div style={{display: 'block'}}>
          <div
            style={{alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between'}}>
            <h2 style={sectionTitleStyle} id={titleId}>{name}</h2>
            <img alt="OpenClassrooms" src={ocrLogo} />
          </div>
          {seeMoreLink}
        </div> :
        <React.Fragment>
          <div style={{alignItems: 'center', display: 'flex'}}>
            <img alt="OpenClassrooms" style={{marginRight: 10}} src={ocrLogo} />
            <h2 style={sectionTitleStyle} id={titleId}>{name}</h2>
          </div>
          {seeMoreLink}
        </React.Fragment>
        : <div>
          <h2 style={sectionTitleStyle} id={titleId}>
            {isSelection ?
              <HeartIcon
                size={24} style={{marginRight: 8}} aria-hidden={true} focusable={false} /> :
              null}{name}
          </h2>
          <p style={sectionInstructionsStyle}>
            {t("Cliquez sur un métier pour avoir plus d'informations")}
          </p>
        </div>}
      {hasJobsOverflow && !isOCR && !isMobileVersion ? seeMoreLink : null}
    </div>}
    <div style={jobsContainerStyle}>
      <div {...handlers} style={jobsListContainerStyle}>
        <ul ref={ref} style={jobListStyle} className="no-scrollbars" onScroll={handleScroll}>
          {realJobs.map((job, index) => <li
            style={isExpanded ? {marginBottom: 10} : {}} key={job.jobGroup.romeId}>
            <Job
              sectionId={id} job={job}
              style={index < realJobs.length - 1 ? jobStyle : lastJobStyle} />
          </li>)}
          {isMobileVersion && !isOCR && !isExpanded && hasJobsOverflow ? <li
            style={{flexShrink: 0}}>
            {seeMoreLink}
          </li> : null}
        </ul>
      </div>
      <div style={buttonsContainerStyle}>
        <Button
          onClick={goBackward} style={buttonLeftStyle} title={t('Métiers précédents')}
          aria-hidden={true} tabIndex={isBackButtonShown ? 0 : -1}>
          <ChevronLeftIcon
            size={60} focusable={false} aria-hidden={true} style={strokedStyle} />
        </Button>
        <Button
          onClick={goForward} style={buttonRightStyle} title={t('Métiers suivants')}
          aria-hidden={true} tabIndex={isForwardButtonShown ? 0 : -1}>
          <ChevronRightIcon
            size={60} focusable={false} aria-hidden={true} style={strokedStyle} />
        </Button>
      </div>
    </div>
  </section>
}
export default React.memo(Section)
