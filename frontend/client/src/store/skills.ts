import betterIncomeIcon from 'images/advices/skill-for-future/better-income.png'
import breadthOfJobsIcon from 'images/advices/skill-for-future/breadth-of-jobs.png'
import jobSatisfactionIcon from 'images/advices/skill-for-future/job-satisfaction.png'
import noAutomatisationIcon from 'images/advices/skill-for-future/no-automatisation.png'
import timeToMarketIcon from 'images/advices/skill-for-future/time-to-market.png'

import {LocalizableString, prepareT} from './i18n'

export interface AssetProp {
  readonly icon: string
  readonly name: LocalizableString
}


export const assetProps: {[assetId: string]: AssetProp} = {
  BETTER_INCOME: {
    icon: betterIncomeIcon,
    name: prepareT('Rémunératrice'),
  },
  BREADTH_OF_JOBS: {
    icon: breadthOfJobsIcon,
    name: prepareT('Transférable'),
  },
  JOB_SATISFACTION: {
    icon: jobSatisfactionIcon,
    name: prepareT('Épanouissante'),
  },
  NO_AUTOMATISATION: {
    icon: noAutomatisationIcon,
    name: prepareT('Peu automatisable'),
  },
  TIME_TO_MARKET: {
    icon: timeToMarketIcon,
    name: prepareT('Recherchée'),
  },
}
