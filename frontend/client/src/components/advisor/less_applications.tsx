import React from 'react'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

import Picto from 'images/advices/picto-less-applications.svg'

import type {CardProps} from './base'
import {MethodSuggestionList} from './base'


const tips = [
  prepareT('Ciblez précisément les bonnes entreprises où postuler'),
  prepareT('Relancez régulièrement les entreprises où vous avez postulé'),
  prepareT('Faites des candidatures spontanées en rencontrant le responsable sur place'),
  prepareT('Cherchez les offres qui vous correspondent vraiment'),
  prepareT('Faites une candidature originale pour chaque entreprise'),
  prepareT('Étudiez en détail la culture des entreprises où vous postulez'),
  prepareT("Essayez de trouver un contact à l'intérieur de l'entreprise"),
] as const


const LessApplicationCard = (props: CardProps): React.ReactElement => {
  const {t, t: translate} = props
  return <MethodSuggestionList
    isNotClickable={true}
    title={t("Maximiser l'impact de vos candidatures")}>
    {tips.map((tip: LocalizableString, index: number): ReactStylableElement =>
      <span key={`tip-${index}`}>
        {translate(...tip)}
      </span>)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(LessApplicationCard)


export default {ExpandedAdviceCardContent, Picto}
