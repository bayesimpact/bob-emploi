import PropTypes from 'prop-types'
import React from 'react'

import {ofPrefix} from 'store/french'

import {ExternalLink, GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-volunteer.svg'
import logoTousBenevoles from 'images/logo-tous-benevoles.png'

import {CardProps, CardWithContentProps, MethodSuggestionList, Mission,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


class ExpandedAdviceCardContentBase
  extends React.Component<CardWithContentProps<bayes.bob.VolunteeringMissions>> {

  public static propTypes = {
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

  public render(): React.ReactNode {
    const {adviceData, handleExplore, project: {city = {}}, userYou} = this.props
    const associationMap = {}
    const missions = (adviceData.missions || []).filter(({associationName}): boolean => {
      if (associationMap[associationName]) {
        return false
      }
      associationMap[associationName] = true
      return true
    })
    const missionCount = missions.length
    const {modifiedName: cityName, prefix} = ofPrefix(city.name)
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
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.VolunteeringMissions, CardProps>()(
    ExpandedAdviceCardContentBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({missions}: bayes.bob.VolunteeringMissions):
  readonly bayes.bob.VolunteeringMission[] => missions,
  'mission', true)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
