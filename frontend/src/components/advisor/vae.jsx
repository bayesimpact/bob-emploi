import React from 'react'
import PropTypes from 'prop-types'

import {Colors, PaddedOnMobile, Styles} from 'components/theme'
import Picto from 'images/advices/picto-vae.png'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {fontSize, userYou} = this.props
    return <div style={{fontSize: fontSize}}>
      {userYou('Tu nous as', 'Vous nous avez')} dit ne pas avoir le niveau de diplôme requis mais
      avoir beaucoup d'expérience, {userYou('as-tu', 'avez-vous')} déjà pensé
      à <strong>faire une VAE</strong>&nbsp;?
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  renderTip(tip, index) {
    const trainingNameStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip.text} {tip.url ? <span>
        &nbsp;:&nbsp; <a
          href={tip.url} style={{color: Colors.BOB_BLUE}}
          target="_blank" rel="noopener noreferer">{tip.url}</a>
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
      <PaddedOnMobile style={{fontSize: 21}}>
        La <strong>VAE</strong> (validation des acquis de l'expérience) permet d'obtenir un diplôme
        correspondant à son expérience professionnelle. Les compétences acquises au fil des années
        sont ainsi valorisées au même titre que
        si {this.props.userYou('tu les avais', 'vous les aviez')} acquises par une formation
        équivalente.
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {tips.map((tip, index) => this.renderTip(tip, index))}
      </AdviceSuggestionList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
