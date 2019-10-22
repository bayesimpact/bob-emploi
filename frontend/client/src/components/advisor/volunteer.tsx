import PropTypes from 'prop-types'
import React from 'react'

import {ofPrefix} from 'store/french'

import {ExternalLink, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-volunteer.svg'
import logoTousBenevoles from 'images/logo-tous-benevoles.png'

import {CardProps, CardWithContentProps, MethodSuggestionList, Mission,
  connectExpandedCardWithContent} from './base'


const ExpandedAdviceCardContentBase:
React.FC<CardWithContentProps<bayes.bob.VolunteeringMissions>> =
  (props: CardWithContentProps<bayes.bob.VolunteeringMissions>): React.ReactElement => {
    const {adviceData, handleExplore, project: {city = {}}, userYou} = props
    const associationMap = {}
    const missions = (adviceData.missions || []).filter(({associationName}): boolean => {
      if (!associationName || associationMap[associationName]) {
        return false
      }
      associationMap[associationName] = true
      return true
    })
    const missionCount = missions.length
    const {modifiedName: cityName, prefix} = ofPrefix(city.name || '')
    const title = <React.Fragment>
      <GrowingNumber
        number={missionCount} isSteady={true} /> mission{missionCount > 1 ? 's ' : ' '}
      cherche{missionCount > 1 ? 'nt' : ''} des bénévoles comme {userYou('toi', 'vous')}
    </React.Fragment>
    const subtitle = `Près ${prefix}${cityName}`
    const footer = <React.Fragment>
      <img
        src={logoTousBenevoles} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
        alt="logo service civique" />
      Trouver d'autres missions de bénévolat
      sur <ExternalLink
        style={{color: colors.BOB_BLUE, textDecoration: 'none'}}
        onClick={handleExplore('more missions')}
        href="http://www.tousbenevoles.org/?utm_source=bob-emploi">
        TousBénévoles.com
      </ExternalLink>
    </React.Fragment>
    return <MethodSuggestionList title={title} footer={footer} subtitle={subtitle}>
      {missions.map((mission, index): ReactStylableElement => <Mission
        key={`mission-${index}`} aggregatorName="Tous Bénévoles" {...mission}
        onContentShown={handleExplore('mission')} userYou={userYou} />)}
    </MethodSuggestionList>
  }
ExpandedAdviceCardContentBase.propTypes = {
  adviceData: PropTypes.shape({
    missions: PropTypes.array,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.VolunteeringMissions, CardProps>(
    React.memo(ExpandedAdviceCardContentBase))


export default {ExpandedAdviceCardContent, Picto}
