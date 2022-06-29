import React from 'react'

import {closeToCity} from 'store/french'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import logoTousBenevoles from 'images/logo-tous-benevoles.png'

import type {CardProps} from './base'
import {MethodSuggestionList, Mission, useAdviceData} from './base'

const noMarginStyle: React.CSSProperties = {
  margin: 0,
}


const VolunteerMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, project: {city: {name = ''} = {}}, t} = props
  const {data: adviceData, loading} = useAdviceData<bayes.bob.VolunteeringMissions>(props)
  if (loading) {
    return loading
  }
  const associationMap: Set<string> = new Set()
  const missions = (adviceData.missions || []).filter(({associationName}): boolean => {
    if (!associationName || associationMap.has(associationName)) {
      return false
    }
    associationMap.add(associationName)
    return true
  })
  const missionCount = missions.length
  const title = <Trans parent={null} t={t} count={missionCount}>
    <GrowingNumber number={missionCount} isSteady={true} /> mission cherche des bénévoles comme vous
  </Trans>
  const subtitle = closeToCity(name, t)
  const footer = <Trans parent="p" t={t} style={noMarginStyle}>
    <img
      src={logoTousBenevoles} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
      alt={t('logo Tous Bénévoles')} />
    Trouver d'autres missions de bénévolat
    sur <ExternalLink
      style={{color: colors.BOB_BLUE, textDecoration: 'none'}}
      onClick={handleExplore('more missions')}
      href="http://www.tousbenevoles.org/?utm_source=bob-emploi">
      TousBénévoles.com
    </ExternalLink>
  </Trans>
  return <MethodSuggestionList title={title} footer={footer} subtitle={subtitle}>
    {missions.map((mission, index): ReactStylableElement => <Mission
      key={`mission-${index}`} aggregatorName="Tous Bénévoles" {...mission}
      onContentShown={handleExplore('mission')} />)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(VolunteerMethod)


export default {ExpandedAdviceCardContent, pictoName: 'hearts' as const}
