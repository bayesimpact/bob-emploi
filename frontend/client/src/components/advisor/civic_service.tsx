import React, {useMemo} from 'react'

import {closeToCity} from 'store/french'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import logoServiceCivique from 'images/logo-service-civique.png'

import type {CardProps} from './base'
import {Mission, MethodSuggestionList, useAdviceData} from './base'


const linkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}
const noMarginStyle: React.CSSProperties = {
  margin: 0,
}

const CivicService = (props: CardProps): React.ReactElement => {
  const {handleExplore, project: {city}, t} = props
  const {data: {missions = []}, loading} = useAdviceData<bayes.bob.VolunteeringMissions>(props)
  const missionCount = missions.length
  const title = useMemo((): React.ReactNode => <Trans parent={null} t={t} count={missionCount}>
    <GrowingNumber number={missionCount} isSteady={true} /> mission cherche des jeunes comme vous
  </Trans>, [missionCount, t])
  const subtitle = closeToCity(city?.name || '', t)
  const footer = useMemo((): React.ReactNode => <Trans parent="p" style={noMarginStyle}>
    <img
      src={logoServiceCivique} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
      alt={t('logo service civique')} />
    Trouvez d'autres missions sur{' '}
    <ExternalLink
      onClick={handleExplore('more')}
      href="http://service-civique.gouv.fr" style={linkStyle}>
      service-civique.gouv.fr
    </ExternalLink>
  </Trans>, [handleExplore, t])

  if (loading) {
    return loading
  }

  return <MethodSuggestionList title={title} footer={footer} subtitle={subtitle}>
    {missions.map((mission, index): ReactStylableElement => <Mission
      key={`mission-${index}`} aggregatorName={t('le portail du Service Civique')} {...mission}
      onContentShown={handleExplore('mission')} />)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(CivicService)

export default {ExpandedAdviceCardContent, pictoName: 'raisedHand' as const}
