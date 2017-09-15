import React from 'react'
import PropTypes from 'prop-types'

import {PaddedOnMobile, Styles} from 'components/theme'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  render() {
    return <div style={{fontSize: 30}}>
      Mettez en avant les qualités liées à l'âge pour convaincre les recruteurs : vous
      êtes sûrement <strong>stable, opérationnel et expérimenté.</strong>
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    profile: PropTypes.object.isRequired,
  }

  renderTip(tip, index) {
    const trainingNameStyle = {
      fontStyle: 'italic',
      fontWeight: 'normal',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip}
    </div>
  }

  render() {
    const {profile} = this.props
    const isFeminin = profile.gender === 'FEMININE'
    const tips = [
      <span key="stable"><strong>Stable</strong>, vous en serez d'autant plus fiable.</span>,
      <span key="experiemente"><strong>Expérimenté{isFeminin ? 'e' : ''}</strong>, vous pourrez
        partager avec l'équipe toutes les compétences que vous avez acquises auparavant.
      </span>,
      <span key="operationnel"><strong>Opérationnel{isFeminin ? 'le' : ''}</strong>, vous serez un
        plus pour l'équipe tout de suite car vous savez faire votre métier.
      </span>,
    ]

    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Mettez en avant les qualités liées à l'âge:
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}} isNotClickable={true}>
        {tips.map((tip, index) => this.renderTip(tip, index))}
      </AdviceSuggestionList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
