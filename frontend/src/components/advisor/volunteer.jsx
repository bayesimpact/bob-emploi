import PropTypes from 'prop-types'
import React from 'react'

import {ofPrefix} from 'store/french'

import {AppearingList, PaddedOnMobile, StringJoiner} from 'components/theme'
import logoTousBenevoles from 'images/logo-tous-benevoles.png'
import Picto from 'images/advices/picto-volunteer.png'

import {connectExpandedCardWithContent, Mission, MoreMissionsLink} from './base'


const getPreviewData = ({advice, project: {city = {}}}) => {
  const {volunteerData} = advice
  const associationNames = volunteerData.associationNames || ['SNC', 'Missions Locales']
  const {modfifiedName: cityName, prefix} = ofPrefix(city.name)
  return {associationNames, cityName, prefix}
}


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    fontSize: PropTypes.number.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice, fontSize, project, userYou} = this.props
    const {associationNames, cityName, prefix} = getPreviewData({advice, project})
    return <div style={{fontSize: fontSize}}>
      Des associations près {prefix}<strong>{cityName}</strong> comme <StringJoiner>
        {associationNames.map((name, index) => <strong key={`association-${index}`}>
          {name}
        </strong>)}
      </StringJoiner> pourraient avoir besoin de {userYou('tes', 'vos')} compétences.
    </div>
  }
}


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      missions: PropTypes.array,
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.shape({
      city: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }),
    }).isRequired,
  }

  render() {
    const {adviceData, onExplore, project: {city = {}}} = this.props
    const associationMap = {}
    const missions = (adviceData.missions || []).filter(({associationName}) => {
      if (associationMap[associationName]) {
        return false
      }
      associationMap[associationName] = true
      return true
    })
    const {modifiedName: cityName, prefix} = ofPrefix(city.name)
    return <div>
      {missions.length ? <PaddedOnMobile style={{marginBottom: 15}}>
        Nous avons trouvé <strong>
          {missions.length} association{missions.length > 1 ? 's' : ''}
        </strong> proposant du bénévolat près {prefix}<strong>{cityName}</strong>.
      </PaddedOnMobile> : null}

      <AppearingList>
        {[
          ...missions.map((mission, index) => <Mission
            aggregatorName="Tous Bénévoles" onContentShown={() => onExplore('mission')}
            {...mission} style={{marginTop: index ? -1 : 0}} key={`mission-${index}`} />),
          <MoreMissionsLink
            style={{marginTop: -1}} key="more" logo={logoTousBenevoles} altLogo="Tous bénévoles"
            onClick={() => {
              onExplore('more missions')
              window.open('http://www.tousbenevoles.org/?utm_source=bob-emploi', '_blank')
            }}>
            Trouver d'autres missions de bénévolat sur Tous Bénévoles
          </MoreMissionsLink>,
        ]}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
