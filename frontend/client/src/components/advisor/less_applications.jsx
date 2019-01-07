import PropTypes from 'prop-types'
import React from 'react'

import Picto from 'images/advices/picto-less-applications.png'

import {AdviceSuggestionList} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {userYou} = this.props
    const tuTips = [
      'Cible précisément les bonnes entreprises où postuler',
      'Relance régulièrement les entreprises où tu as postulé',
      'Fais des candidatures spontanées en rencontrant le responsable sur place',
      'Cherche les offres qui te correspondent vraiment',
      'Fais une candidature originale pour chaque entreprise',
      'Étudie en détail la culture des entreprises où tu postules',
      "Essaye de trouver un contact à l'intérieur de l'entreprise"]
    const vousTips = [
      'Ciblez précisément les bonnes entreprises où postuler',
      'Relancez régulièrement les entreprises où vous avez postulé',
      'Faites des candidatures spontanées en rencontrant le responsable sur place',
      'Cherchez les offres qui vous correspondent vraiment',
      'Faites une candidature originale pour chaque entreprise',
      'Étudiez en détail la culture des entreprises où vous postulez',
      "Essayez de trouver un contact à l'intérieur de l'entreprise"]
    const tips = userYou(tuTips, vousTips)
    return <div>
      <div>
        Pour maximiser l'impact de {userYou('tes', 'vos')} candidatures&nbsp;:
      </div>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {tips.map((tip, index) => <span
          style={{cursor: 'initial', fontWeight: 'normal'}} key={`tip-${index}`}>{tip}</span>)}
      </AdviceSuggestionList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
