import PropTypes from 'prop-types'
import React from 'react'

import Picto from 'images/advices/picto-less-applications.svg'

import {CardProps, MethodSuggestionList} from './base'


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


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {userYou} = this.props
    const tips = userYou(tuTips, vousTips)
    return <MethodSuggestionList
      isNotClickable={true}
      title={`Maximiser l'impact de ${userYou('tes', 'vos')} candidatures`}>
      {tips.map((tip, index): ReactStylableElement => <span key={`tip-${index}`}>{tip}</span>)}
    </MethodSuggestionList>
  }
}


export default {ExpandedAdviceCardContent, Picto}
