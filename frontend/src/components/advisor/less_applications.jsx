import React from 'react'

import {PaddedOnMobile} from 'components/theme'

import {AdviceSuggestionList, Tip} from './base'


class AdviceCard extends React.Component {
  render() {
    return <div style={{fontSize: 30}}>
      Pas besoin de faire plus de 5 candidatures par semaine,
      postulez mieux en <strong>ciblant vos candidatures</strong>&nbsp;!
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  render() {
    const tips = [
      'Ciblez précisément les bonnes entreprises où postuler',
      'Relancez régulièrement les entreprises où vous avez postulé',
      'Faites des candidatures spontanées en rencontrant le responsable sur place',
      'Cherchez les offres qui vous correspondent vraiment',
      'Faites une candidature originale pour chaque entreprise',
      'Étudiez en détail la culture des entreprises où vous postulez',
      "Essayez de trouver un contact à l'intérieur de l'entreprise"]

    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Pour maximizer l'impact de vos candidatures :
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {tips.map((tip, index) => <Tip tip={tip} key={`tip-${index}`} />)}
      </AdviceSuggestionList>
    </div>
  }
}
export default {AdviceCard, ExpandedAdviceCardContent}
