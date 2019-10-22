import betterIncomeIcon from 'images/advices/skill-for-future/better-income.png'
import breadthOfJobsIcon from 'images/advices/skill-for-future/breadth-of-jobs.png'
import jobSatisfactionIcon from 'images/advices/skill-for-future/job-satisfaction.png'
import noAutomatisationIcon from 'images/advices/skill-for-future/no-automatisation.png'
import timeToMarketIcon from 'images/advices/skill-for-future/time-to-market.png'

import {YouChooser} from './french'

export interface AssetProp {
  readonly description: (userYou: YouChooser) => string
  readonly icon: string
  readonly name: string
}


export const assetProps: {[assetId: string]: AssetProp} = {
  BETTER_INCOME: {
    description: (userYou: YouChooser): string =>
      `Cette compétence ${userYou("t'", 'vous ')}aidera à accéder à un meilleur niveau de salaire`,
    icon: betterIncomeIcon,
    name: 'Rémunératrice',
  },
  BREADTH_OF_JOBS: {
    description: (): string => 'Cette compétence est utile dans de nombreux métiers',
    icon: breadthOfJobsIcon,
    name: 'Transférable',
  },
  JOB_SATISFACTION: {
    description: (userYou: YouChooser): string =>
      `Cette compétence participera à ${userYou('ton', 'votre')} bien-être au travail`,
    icon: jobSatisfactionIcon,
    name: 'Épanouissante',
  },
  NO_AUTOMATISATION: {
    description: (userYou: YouChooser): string =>
      `Cette compétence ${userYou("t'", 'vous ')}aidera à décrocher un emploi durable`,
    icon: noAutomatisationIcon,
    name: 'Peu automatisable',
  },
  TIME_TO_MARKET: {
    description: (userYou: YouChooser): string =>
      `Cette compétence ${userYou("t'", 'vous ')}aidera à trouver un emploi rapidement`,
    icon: timeToMarketIcon,
    name: 'Recherchée',
  },
}
