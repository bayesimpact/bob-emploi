import React from 'react'
import {useSelector} from 'react-redux'

import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import type {RootState} from 'store/actions'

import type {CardProps} from './base'


const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}
const Jobflix = ({handleExplore, t}: CardProps): React.ReactElement => {
  const userSource = useSelector(({user}: RootState) => user?.origin?.source)
  const departementId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const jobflixBaseUrl = t('https://www.jobflix.app')
  // Keep the jobflixSource sync with server/mail/all_campaigns.py.
  const jobflixSource = `utm_source=${userSource === 'dwp' ? 'dwp' : 'bob'}`
  const departement = departementId ? `departement=${departementId}&` : ''
  const jobflixUrl = `${jobflixBaseUrl}?${jobflixSource}&${departement}utm_campaign=action-plan`
  return <Trans t={t}>
    <ExternalLink href={jobflixUrl} onClick={handleExplore('link')}
      style={linkStyle}>Jobflix</ExternalLink> est un outil d'exploration de l'emploi qui vous
    montre les secteurs qui embauchent et qui paient le mieux dans votre région, et vous aide
    également à voir quels programmes de formation vous aideront à avoir les bonnes
    qualifications pour chaque emploi&nbsp;!
  </Trans>
}

const ExpandedAdviceCardContent = React.memo(Jobflix)


export default {ExpandedAdviceCardContent, pictoName: 'binocularsBlue' as const}
