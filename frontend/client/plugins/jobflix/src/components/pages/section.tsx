import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import React, {useEffect, useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useParams} from 'react-router'
import {Link, Redirect} from 'react-router-dom'

import useCachedData from 'hooks/cached_data'
import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import {horizontalPagePadding, verticalPagePadding} from '../padding'
import type {DispatchAllUpskillingActions} from '../../store/actions'
import {getMoreUpskillingSectionJobs,
  getUpskillingSections} from '../../store/actions'
import {SELECTION_SECTION} from '../../store/constants'
import Section from '../section'
import Stars from '../stars'

export type ValidSection = bayes.upskilling.Section & {id: string}

const linkStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 50,
  color: '#000',
  display: 'flex',
  flex: 'none',
  marginRight: 15,
  padding: 5,
}
const starsStyle: React.CSSProperties = {
  margin: `0 -${horizontalPagePadding}px -${verticalPagePadding}px -${horizontalPagePadding}px`,
}
const h1Style: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: isMobileVersion ? 21 : 30,
  margin: 0,
}
const headerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  margin: '0 25px 20px',
}
const sectionInstructionsStyle: React.CSSProperties = {
  color: colors.TEXT_SUBTITLE_COLOR,
  fontSize: 14,
  fontWeight: 'normal',
  margin: '0 25px 20px',
  opacity: .8,
}

const SectionPage = (): null|React.ReactElement => {
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const {sectionId} = useParams<{sectionId: string}>()
  const departementId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const allJobs = useSelector(({app: {upskillingSectionAllJobs}}: RootState) =>
    upskillingSectionAllJobs?.[departementId || '']?.[sectionId])
  const hasAllJobs = !!allJobs
  const sectionsAction = useMemo(() => getUpskillingSections(departementId), [departementId])
  // TODO(cyrille): Drop once we have a link from Netflix page to this one.
  const {loading} = useCachedData(
    ({app: {upskillingSections}}) => upskillingSections?.[departementId || ''],
    sectionsAction,
  )
  const selection = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs) || []
  const sectionWithId = useSelector(
    ({app: {upskillingSections: {[departementId || '']: sections = []} = {}}}: RootState) =>
      sections?.find((section): section is ValidSection => section.id === sectionId))
  useEffect((): void => {
    if (!departementId || hasAllJobs || !sectionWithId || sectionWithId.isOCR) {
      return
    }
    dispatch(getMoreUpskillingSectionJobs(departementId, sectionWithId))
  }, [departementId, dispatch, hasAllJobs, sectionWithId])
  const section = sectionId === SELECTION_SECTION ? {
    id: SELECTION_SECTION,
    jobs: selection,
    name: t('Vos favoris'),
  } : sectionWithId
  if (!loading && !section) {
    return <Redirect to="/" />
  }
  if (!section) {
    return null
  }
  const {id, jobs, name} = section
  // TODO(cyrille): Allow header to be fixed on scroll.
  return <React.Fragment>
    <header style={headerStyle}>
      {isMobileVersion ? null : <Link style={linkStyle} to="/">
        <ArrowLeftIcon size={25} aria-label={t('Retour')} focusable={false} />
      </Link>}
      <h1 style={h1Style}>{name}</h1>
    </header>
    <p style={sectionInstructionsStyle}>
      {t("Cliquez sur un métier pour avoir plus d'informations")}
    </p>
    <Section isExpanded={true} {...section} jobs={allJobs || jobs} />
    <Stars sectionId={id} style={starsStyle} />
  </React.Fragment>
}

export default React.memo(SectionPage)
