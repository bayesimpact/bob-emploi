import React from 'react'
import PropTypes from 'prop-types'

import {ofPrefix} from 'store/french'

import {ExternalLink, GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-civic-service.svg'
import logoServiceCivique from 'images/logo-service-civique.png'

import {CardProps, CardWithContentProps, Mission, MethodSuggestionList,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


class ExpandedAdviceCardContentBase
  extends React.Component<CardWithContentProps<bayes.bob.VolunteeringMissions>> {

  public static propTypes = {
    adviceData: PropTypes.shape({
      missions: PropTypes.arrayOf(PropTypes.shape({
        associationName: PropTypes.node,
        description: PropTypes.node,
        link: PropTypes.string,
        title: PropTypes.string,
      }).isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {adviceData, handleExplore, project: {city}, userYou} = this.props
    const missions = adviceData && adviceData.missions || []
    const missionCount = missions.length
    const {modifiedName: cityName, prefix} = ofPrefix(city.name)
    const linkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    const title = <React.Fragment>
      <GrowingNumber
        number={missionCount} isSteady={true} /> mission{missionCount > 1 ? 's ' : ' '}
      cherche{missionCount > 1 ? 'nt' : ''} des jeunes comme {userYou('toi', 'vous')}
    </React.Fragment>
    const subtitle = `Près ${prefix}${cityName}`
    const footer = <React.Fragment>
      <img
        src={logoServiceCivique} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
        alt="logo service civique" />
      Trouve{userYou('', 'z')} d'autres missions sur{' '}
      <ExternalLink
        onClick={handleExplore('more')}
        href="http://service-civique.gouv.fr" style={linkStyle}>
        service-civique.gouv.fr
      </ExternalLink>
    </React.Fragment>

    return <MethodSuggestionList title={title} footer={footer} subtitle={subtitle}>
      {missions.map((mission, index): ReactStylableElement => <Mission
        key={`mission-${index}`} aggregatorName="le portail du Service Civique" {...mission}
        onContentShown={handleExplore('mission')} userYou={userYou} />)}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.VolunteeringMissions, CardProps>()(
    ExpandedAdviceCardContentBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({missions}: bayes.bob.VolunteeringMissions):
  readonly bayes.bob.VolunteeringMission[] => missions,
  'mission', true)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
