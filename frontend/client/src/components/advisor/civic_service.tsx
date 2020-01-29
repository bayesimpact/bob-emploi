import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {ofPrefix} from 'store/french'

import {Trans} from 'components/i18n'
import {ExternalLink, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-civic-service.svg'
import logoServiceCivique from 'images/logo-service-civique.png'

import {CardProps, Mission, MethodSuggestionList, useAdviceData} from './base'


const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const CivicService = (props: CardProps): React.ReactElement => {
  const {handleExplore, project: {city}, t} = props
  const {missions = []} = useAdviceData<bayes.bob.VolunteeringMissions>(props)
  const missionCount = missions.length
  const {modifiedName: cityName, prefix} = ofPrefix(city?.name || '')
  const title = useMemo((): React.ReactNode => <Trans parent={null} t={t} count={missionCount}>
    <GrowingNumber number={missionCount} isSteady={true} /> mission cherche des jeunes comme vous
  </Trans>, [missionCount, t])
  const subtitle = `Près ${prefix}${cityName}`
  const footer = useMemo((): React.ReactNode => <Trans parent={null}>
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

  return <MethodSuggestionList title={title} footer={footer} subtitle={subtitle}>
    {missions.map((mission, index): ReactStylableElement => <Mission
      key={`mission-${index}`} aggregatorName={t('le portail du Service Civique')} {...mission}
      onContentShown={handleExplore('mission')} />)}
  </MethodSuggestionList>
}
CivicService.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(CivicService)

export default {ExpandedAdviceCardContent, Picto}
