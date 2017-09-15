import React from 'react'

import {Colors, PaddedOnMobile, Styles} from 'components/theme'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  render() {
    return <div style={{fontSize: 30}}>
      Vous nous avez dit ne pas avoir le niveau de diplôme requis mais avoir beaucoup d'expérience,
      avez-vous déjà pensé à <strong>faire une VAE</strong> ?
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  renderTip(tip, index) {
    const trainingNameStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip.text} {tip.url ? <span>
        &nbsp;:&nbsp; <a
          href={tip.url} style={{color: Colors.SKY_BLUE}}
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
        sont ainsi valorisées au même titre que si vous les aviez acquises par une formation
        équivalente.
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {tips.map((tip, index) => this.renderTip(tip, index))}
      </AdviceSuggestionList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
