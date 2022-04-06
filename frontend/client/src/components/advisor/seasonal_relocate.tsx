import React from 'react'

import {getJobPlacesFromDepartementStats} from 'store/job'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-seasonal-relocate.svg'

import type {CardProps} from './base'
import {MethodSuggestionList, useAdviceData} from './base'


const SeasonalRelocate = (props: CardProps): React.ReactElement => {
  const {t} = props
  const {data: {departementStats = [{
    departementInName: t('dans le Var'),
    jobGroups: [
      {
        name: t('Hôtellerie'),
        romeId: '10293',
      },
    ],
  }]}, loading} = useAdviceData<bayes.bob.MonthlySeasonalJobbingStats>(props)
  const jobPlaces = getJobPlacesFromDepartementStats(departementStats)
  const title = <Trans parent={null} t={t} count={jobPlaces.length}>
    <GrowingNumber isSteady={true} number={jobPlaces.length} /> exemple de secteur saisonnier qui
    recrute en ce moment pour la prochaine saison touristique.
  </Trans>
  if (loading) {
    return loading
  }
  return <MethodSuggestionList title={title} isNotClickable={true}>
    {jobPlaces.map(({inDepartement, jobGroup}, index): ReactStylableElement => <div key={index}>
      <span style={{fontWeight: 'normal'}}>{jobGroup}</span>&nbsp;<strong>{inDepartement}</strong>
    </div>)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(SeasonalRelocate)


export default {ExpandedAdviceCardContent, Picto}
