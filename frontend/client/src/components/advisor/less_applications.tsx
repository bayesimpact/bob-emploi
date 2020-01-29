import PropTypes from 'prop-types'
import React from 'react'

import {prepareT} from 'store/i18n'

import Picto from 'images/advices/picto-less-applications.svg'

import {CardProps, MethodSuggestionList} from './base'


const tips = [
  prepareT('Ciblez précisément les bonnes entreprises où postuler'),
  prepareT('Relancez régulièrement les entreprises où vous avez postulé'),
  prepareT('Faites des candidatures spontanées en rencontrant le responsable sur place'),
  prepareT('Cherchez les offres qui vous correspondent vraiment'),
  prepareT('Faites une candidature originale pour chaque entreprise'),
  prepareT('Étudiez en détail la culture des entreprises où vous postulez'),
  prepareT("Essayez de trouver un contact à l'intérieur de l'entreprise"),
]


const LessApplicationCard = (props: CardProps): React.ReactElement => {
  const {t, t: translate} = props
  return <MethodSuggestionList
    isNotClickable={true}
    title={t("Maximiser l'impact de vos candidatures")}>
    {tips.map((tip, index): ReactStylableElement => <span key={`tip-${index}`}>
      {translate(tip)}
    </span>)}
  </MethodSuggestionList>
}
LessApplicationCard.propTypes = {
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(LessApplicationCard)


export default {ExpandedAdviceCardContent, Picto}
