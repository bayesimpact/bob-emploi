import React, {useMemo} from 'react'

import {inDepartement} from 'store/french'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-reorient-jobbing.svg'

import type {CardProps} from './base'
import {JobSuggestion, useAdviceData, ReorientSection} from './base'


const emptyArray = [] as const
type JobSuggestionProps = React.ComponentProps<typeof JobSuggestion>


const ReorientJobbing = (props: CardProps): React.ReactElement|null => {
  const {handleExplore, profile, project: {city}, t} = props
  const {data: {reorientJobbingJobs = emptyArray}, loading} =
    useAdviceData<bayes.bob.JobbingReorientJobs>(props)
  const allJobs = useMemo(
    (): readonly React.ReactElement<JobSuggestionProps>[] => reorientJobbingJobs.slice(0, 6).
      map((job, index): React.ReactElement<JobSuggestionProps> => <JobSuggestion
        key={`job-${index}`} job={job} onClick={handleExplore('job')} />),
    [handleExplore, reorientJobbingJobs],
  )
  const items = useMemo(
    (): React.ReactElement<JobSuggestionProps>[] =>
      [<JobSuggestion isCaption={true} key="jobs-caption" />, ...allJobs],
    [allJobs],
  )
  const inYourDepartement = city && inDepartement(city, t) || t('dans votre département')

  const title = <React.Fragment>
    <Trans parent={null} t={t} count={allJobs.length}>
      <GrowingNumber number={allJobs.length} isSteady={true} />&nbsp;métier
      qui recrute beaucoup {{inYourDepartement}}
    </Trans>
    *
  </React.Fragment>
  if (loading) {
    return loading
  }
  return <ReorientSection
    title={title}
    isNotClickable={true}
    items={items} profile={profile} />
}
const ExpandedAdviceCardContent = React.memo(ReorientJobbing)


export default {ExpandedAdviceCardContent, Picto}
