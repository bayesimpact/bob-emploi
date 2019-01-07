import React from 'react'
import PropTypes from 'prop-types'

import {ExternalLink} from 'components/theme'
import Picto from 'images/advices/picto-vae.png'

import {AdviceSuggestionList} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderTip(tip, index) {
    const {onExplore} = this.props
    const trainingNameStyle = {
      fontStyle: 'italic',
      marginRight: 10,
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip.text} {tip.url ? <span>
        &nbsp;:&nbsp; <ExternalLink
          onClick={() => onExplore('vae tip')}
          href={tip.url} style={{color: colors.BOB_BLUE}}>{tip.url}</ExternalLink>
      </span> : null}
    </div>
  }

  render() {
    const tips = [{
      text: 'Découvrir la VAE',
      url: 'http://www.vae.gouv.fr',
    }, {
      text: 'Trouver une formation en VAE',
      url: 'http://www.iciformation.fr/vae-validation-acquis-experience.html',
    }]

    return <div>
      <div>
        La <strong>VAE</strong> (validation des acquis de l'expérience) permet d'obtenir un diplôme
        correspondant à son expérience professionnelle. Les compétences acquises au fil des années
        sont ainsi valorisées au même titre que
        si {this.props.userYou('tu les avais', 'vous les aviez')} acquises par une formation
        équivalente.
      </div>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {tips.map((tip, index) => this.renderTip(tip, index))}
      </AdviceSuggestionList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
