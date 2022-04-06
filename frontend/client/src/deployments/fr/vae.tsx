import type {TFunction} from 'i18next'
import React from 'react'

import type {Tip} from '../types/vae'

const makeAvrilLink = (romeId: string): string => {
  return `https://avril.pole-emploi.fr/diplomes?rome_code=${romeId}&utm_source=bob`
}

export const getTips = (romeId: string, t: TFunction): readonly Tip[] => {
  return [
    {
      content: t('Découvrir la VAE'),
      intro: t('En savoir plus\u00A0:'),
      name: 'Avril',
      url: makeAvrilLink(romeId),
    },
  ]
}

const VaeHelpContentBase = (): React.ReactElement => <div>
  Trouvez un organisme pour vous accompagner pour valider vos acquis professionnels
</div>

export const VaeHelpContent = React.memo(VaeHelpContentBase)
