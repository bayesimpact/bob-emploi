import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import useCachedData from 'hooks/cached_data'
import {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import {colorToAlpha} from 'components/colors'
import Trans from 'components/i18n_trans'
import {SmoothTransitions} from 'components/theme'

import {getUpskillingSections} from '../../store/actions'
import {horizontalPagePadding, verticalPagePadding} from '../padding'
import Section from '../section'
import Stars from '../stars'
import {ValidSection} from './section'

const titleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 36 : 40,
  fontWeight: 'bold',
  margin: '0 0 15px 0',
  padding: '0px 25px',
}
const subtitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 16 : 20,
  marginBottom: 50,
  padding: '0px 25px',
}
const sectionStyle: React.CSSProperties = {
  margin: '25px 0 10px',
}

const selectionSectionStyle: React.CSSProperties = {
  ...sectionStyle,
  backgroundColor: colors.PURPLISH_BROWN,
  paddingTop: 25,
}

const noPageMarginStyle: React.CSSProperties = {
  margin: `0 0 -${verticalPagePadding}px  -${horizontalPagePadding}px`,
}

const separatorStyle: React.CSSProperties = {
  border: 0,
  borderTop: `solid 1px ${colorToAlpha('#fff', .2)}`,
  margin: '25px 35px 10px 25px',
}

const NetflixPage = () : React.ReactElement => {
  const {t} = useTranslation()
  const departementId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const sectionsAction = useMemo(() => getUpskillingSections(departementId), [departementId])
  const {data: sections = []} = useCachedData(
    ({app: {upskillingSections}}) => upskillingSections?.[departementId || ''],
    sectionsAction,
  )
  const selectedJobs = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs) || []
  const selectedJobsCount = selectedJobs?.length || 0
  const [lastSelectedJobsCount, setSelectedJobsCount] = useState(selectedJobsCount)
  const [isSeeSelectionDisplayed, setIsSeeSelectionDisplayed] = useState(false)
  useEffect((): void => {
    if (selectedJobsCount === lastSelectedJobsCount) {
      return
    }
    if (selectedJobsCount > lastSelectedJobsCount) {
      setIsSeeSelectionDisplayed(true)
    } else if (!selectedJobsCount) {
      setIsSeeSelectionDisplayed(false)
    }
    setSelectedJobsCount(selectedJobsCount)
  }, [selectedJobsCount, lastSelectedJobsCount])
  // TODO(cyrille): Consider focusing on the 'See Selection' button when displayed.
  useEffect(() => {
    if (!isSeeSelectionDisplayed) {
      return () => void 0
    }
    const timeout = window.setTimeout(() => setIsSeeSelectionDisplayed(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [isSeeSelectionDisplayed])
  const handleSelectionShown = useCallback((isVisible) => {
    if (!isSeeSelectionDisplayed || !isVisible) {
      return
    }
    setIsSeeSelectionDisplayed(false)
  }, [isSeeSelectionDisplayed])
  const realSections = sections.filter((section): section is ValidSection => !!section.id)
  const scrollToTop = useCallback(() => {
    document.documentElement.scrollTo({
      behavior: 'smooth',
      top: 0,
    })
  }, [])
  const seeSelectionStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 35,
    bottom: 30,
    color: colors.DARK_TWO,
    display: 'flex',
    fontSize: isMobileVersion ? 15 : 19,
    fontWeight: 'bold',
    height: 70,
    opacity: isSeeSelectionDisplayed ? 1 : 0,
    overflow: 'hidden',
    padding: '0 20px 0 25px',
    pointerEvents: isSeeSelectionDisplayed ? 'inherit' : 'none',
    position: 'fixed',
    right: 30,
    transform: isSeeSelectionDisplayed ? 'none' : 'translate(0, 100px)',
    ...SmoothTransitions,
  }
  const seeSelectionCTAStyle: React.CSSProperties = {
    color: colors.COOL_GREY,
    display: 'block',
    fontSize: isMobileVersion ? 12 : 14,
    padding: 0,
  }
  return <div>
    <Trans style={titleStyle} parent="h1">
      Bonjour&nbsp;!
    </Trans>
    <Trans style={subtitleStyle} parent="p">
      Voici les meilleurs métiers dans votre département pour vous donner des idées de
      carrières&nbsp;! <span role="img" aria-label={t("pouce en l'air")}>👍</span>
    </Trans>
    <hr style={separatorStyle} />
    {selectedJobs?.length ? <VisibilitySensor
      active={isSeeSelectionDisplayed} onChange={handleSelectionShown} intervalDelay={250}>
      <Section
        id="selection" jobs={selectedJobs} name={t('Ma sélection')} style={selectionSectionStyle} />
    </VisibilitySensor> : null}
    {realSections.map(section => <Section style={sectionStyle} key={section.id} {...section} />)}
    {realSections.length ? <Stars style={noPageMarginStyle} /> : null}
    <div aria-live="polite" aria-hidden={!isSeeSelectionDisplayed} style={seeSelectionStyle}>
      <CheckCircleIcon color={colors.GREENISH_TEAL_TWO} />
      <div style={{marginLeft: 10}}>
        {t('Métier ajouté à votre sélection')}
        <button onClick={scrollToTop} style={seeSelectionCTAStyle}>
          {t('Voir ma sélection')}
        </button>
      </div>
    </div>
  </div>
}

export default React.memo(NetflixPage)
