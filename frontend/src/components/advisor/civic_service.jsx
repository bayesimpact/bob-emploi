import React from 'react'
import PropTypes from 'prop-types'

import {inDepartement} from 'store/french'

import {AppearingList, ExternalLink, GrowingNumber, PaddedOnMobile} from 'components/theme'
import Picto from 'images/advices/picto-civic-service.png'
import logoServiceCivique from 'images/logo-service-civique.png'

import {connectExpandedCardWithContent,
  Mission, MoreMissionsLink} from './base'

class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      missions: PropTypes.arrayOf(PropTypes.shape({
        associationName: PropTypes.node,
        description: PropTypes.node,
        link: PropTypes.string,
        title: PropTypes.string,
      }).isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {adviceData, onExplore, project: {city}, userYou} = this.props
    const missions = adviceData && adviceData.missions || []
    const missionCount = missions.length
    const location = inDepartement(city) || `près de chez ${userYou('toi', 'vous')}`

    const missionCountStyle = {
      fontSize: 21,
      marginTop: 15,
    }
    return <div>
      <PaddedOnMobile>
        Le service civique c'est un engagement volontaire au service de
        l'intérêt général. Concrètement c'est une mission en <strong>France ou à l'étranger
        </strong> qui peut durer entre <strong>6&nbsp;mois et 1&nbsp;an</strong>. Pendant la mission
        {userYou(' tu reçois', ' vous recevez')} une indemnité de
        <strong> 472,97€/mois</strong>. Les missions ne demandent pas de diplôme ou d'expérience,
        la seule chose qui fait la différence c'est {userYou('ta', 'votre')} motivation.
        {missionCount ? <div style={missionCountStyle}> Nous avons trouvé <strong><GrowingNumber
          number={missionCount} isSteady={true} /> mission{missionCount > 1 ? 's ' : ' '}
        </strong> {location}</div> :
          <ExternalLink href="http://service-civique.gouv.fr">
            <br />{userYou('Va', 'Allez')} sur le site du service civique.
          </ExternalLink>}
      </PaddedOnMobile>
      {missionCount ? <AppearingList style={{marginTop: 15}}>
        {[
          ...missions.map((mission, index) => <Mission
            key={`mission-${index}`} aggregatorName="le portail du Service Civique" {...mission}
            onContentShown={() => onExplore('mission')}
            style={{marginTop: index ? -1 : 0}} />),
          <MoreMissionsLink
            key="more" logo={logoServiceCivique} altLogo="Service civique" style={{marginTop: -1}}
            onClick={() => {
              window.open('http://www.service-civique.gouv.fr/?utm_source=bob-emploi', '_blank')
              onExplore && onExplore('more')
            }}>
              Trouver d'autres missions de service civique
          </MoreMissionsLink>,
        ]}
      </AppearingList> : null}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)

export default {ExpandedAdviceCardContent, Picto}
