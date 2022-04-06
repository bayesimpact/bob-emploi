import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useCachedData from 'hooks/cached_data'
import useDocumentTitle from 'hooks/document_title'
import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import {colorToAlpha} from 'components/colors'
import Trans from 'components/i18n_trans'

import {getUpskillingSections} from '../../store/actions'
import {fullContext} from '../departement'
import {horizontalPagePadding, verticalPagePadding} from '../padding'
import Section from '../section'
import Stars from '../stars'
import type {ValidSection} from './section'

const containerStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 16 : 20,
  fontWeight: 'normal',
  marginBottom: '0 0 50px',
  padding: '0px 25px',
}
const sectionStyle: React.CSSProperties = {
  marginBottom: 30,
  marginTop: 30,
}

const selectionSectionStyle: React.CSSProperties = {
  ...sectionStyle,
  padding: 25,
}

const noPageMarginStyle: React.CSSProperties = {
  margin: `0 -${horizontalPagePadding}px -${verticalPagePadding}px -${horizontalPagePadding}px`,
}

const separatorStyle: React.CSSProperties = {
  border: 0,
  borderTop: `solid 1px ${colorToAlpha('#fff', .2)}`,
  margin: '25px 25px 10px',
}

const NetflixPage = (): React.ReactElement => {
  const {t} = useTranslation()
  const departementId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const sectionsAction = useMemo(() => getUpskillingSections(departementId), [departementId])
  const {data: sections = []} = useCachedData(
    ({app: {upskillingSections}}) => upskillingSections?.[departementId || ''],
    sectionsAction,
  )
  const selectedJobs = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs) || []
  const realSections = sections.filter((section): section is ValidSection => !!section.id)
  // eslint-disable-next-line max-len
  // i18next-extract-mark-context-next-line ["career_fr_DEPARTEMENT", "career_uk_CITY", "promising-job_fr_CITY"]
  const pitch = t('Découvrez les meilleures carrières dans votre département', fullContext)
  useDocumentTitle(`${config.productName} | ${pitch}`)
  return <div style={containerStyle}>
    {/* i18next-extract-mark-context-next-line ["career", "promising-job"] */}
    <Trans style={subtitleStyle} parent="h1" tOptions={{context: config.goalWordingContext}}>
      Voici les <strong>meilleurs métiers</strong> de votre département pour vous donner
      des <strong>idées de carrière</strong>&nbsp;!{' '}
      <span aria-hidden={true}>🙌</span>
    </Trans>
    {selectedJobs?.length ? <Section
      id="selection" jobs={selectedJobs} name={t('Vos métiers favoris')}
      style={selectionSectionStyle} /> : <React.Fragment>
      <hr style={separatorStyle} />
      <div style={{height: 1}} /></React.Fragment>}
    {realSections.map(section => <Section style={sectionStyle} key={section.id} {...section} />)}
    {realSections.length ? <Stars style={noPageMarginStyle} /> : null}
  </div>
}

export default React.memo(NetflixPage)
