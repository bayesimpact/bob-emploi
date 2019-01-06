import React from 'react'
import PropTypes from 'prop-types'

import Picto from 'images/advices/picto-senior.png'

import {AdviceSuggestionList} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    profile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderTip(tip, index) {
    const trainingNameStyle = {
      fontStyle: 'italic',
      fontWeight: 'normal',
      marginRight: 10,
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip}
    </div>
  }

  render() {
    const {profile, userYou} = this.props
    const isFeminine = profile.gender === 'FEMININE'
    const tips = [
      <span key="stable"><strong>Stable</strong>, {userYou('tu en seras', 'vous en serez')} d'autant
        plus fiable.</span>,
      <span key="experiemente">
        <strong>Expérimenté{isFeminine ? 'e' : ''}</strong>,
        {userYou(' tu pourras', ' vous pourrez')} partager avec l'équipe toutes les compétences
        que {userYou('tu as', 'vous avez')} acquises auparavant.
      </span>,
      <span key="operationnel">
        <strong>Opérationnel{isFeminine ? 'le' : ''}</strong>,
        {userYou(' tu seras', ' vous serez')} un plus pour l'équipe tout de suite
        car {userYou('tu sais faire ton', 'vous savez faire votre')} métier.
      </span>,
    ]

    return <div>
      <div>
        Met{userYou('s', 'tez')} en avant les qualités liées à l'âge&nbsp;:
      </div>
      <AdviceSuggestionList style={{marginTop: 15}} isNotClickable={true}>
        {tips.map((tip, index) => this.renderTip(tip, index))}
      </AdviceSuggestionList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
