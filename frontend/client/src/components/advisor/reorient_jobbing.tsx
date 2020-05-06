import React, {useMemo} from 'react'
import PropTypes from 'prop-types'

import {inDepartement} from 'store/french'

import {Trans} from 'components/i18n'
import {DataSource, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-reorient-jobbing.svg'

import {CardProps, JobSuggestion, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const
type JobSuggestionProps = GetProps<typeof JobSuggestion>


const ReorientJobbing = (props: CardProps): React.ReactElement|null => {
  const {handleExplore, project: {city}, t} = props
  const {reorientJobbingJobs = emptyArray} = useAdviceData<bayes.bob.JobbingReorientJobs>(props)
  const allJobs = useMemo(
    (): readonly React.ReactElement<JobSuggestionProps>[] => reorientJobbingJobs.slice(0, 6).
      map((job, index): React.ReactElement<JobSuggestionProps> => <JobSuggestion
        isMethodSuggestion={true} key={`job-${index}`} job={job} onClick={handleExplore('job')} />),
    [handleExplore, reorientJobbingJobs],
  )

  const inYourDepartement = city && inDepartement(city) || t('dans votre département')

  const title = <React.Fragment>
    <Trans parent={null} t={t} count={allJobs.length}>
      <GrowingNumber number={allJobs.length} isSteady={true} />&nbsp;métier
      qui recrute beaucoup {{inYourDepartement}}
    </Trans>
    *
  </React.Fragment>
  const footer = <DataSource style={{margin: 0}}>IMT 2017 / Pôle emploi</DataSource>
  return <MethodSuggestionList title={title} footer={footer}>
    {[<JobSuggestion
      isNotClickable={true}
      isMethodSuggestion={true}
      isCaption={true}
      key="jobs-caption" />].concat(allJobs)}
  </MethodSuggestionList>
}
ReorientJobbing.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ReorientJobbing)


export default {ExpandedAdviceCardContent, Picto}
