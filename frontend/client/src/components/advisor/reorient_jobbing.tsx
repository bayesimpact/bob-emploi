import React from 'react'
import PropTypes from 'prop-types'

import {inDepartement} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-reorient-jobbing.svg'

import {CardProps, CardWithContentProps, DataSource, JobSuggestion, MethodSuggestionList,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


type GetProps<T> = T extends React.ComponentType<infer P> ? P : never

type JobSuggestionProps = GetProps<typeof JobSuggestion>


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.JobbingReorientJobs>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      reorientJobbingJobs: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
      }).isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private computeAllJobs(): React.ReactElement<JobSuggestionProps>[] {
    const {adviceData: {reorientJobbingJobs = []}, handleExplore} = this.props
    const jobList = reorientJobbingJobs.slice(0, 6).
      map((job, index): React.ReactElement<JobSuggestionProps> => <JobSuggestion
        isMethodSuggestion={true} key={`job-${index}`} job={job} onClick={handleExplore('job')} />)
    return jobList
  }

  public render(): React.ReactNode {
    const allJobs = this.computeAllJobs()
    const {project: {city}, userYou} = this.props

    if (!allJobs.length) {
      return null
    }

    const inYourDepartement = inDepartement(city) || `dans ${userYou('ton', 'votre')} département`
    const isPlural = allJobs.length > 1

    const title = <React.Fragment>
      <GrowingNumber number={allJobs.length} isSteady={true} />&nbsp;métier{isPlural ? 's ' : ' '}
      qui recrut{isPlural ? 'ent' : ''} beaucoup {inYourDepartement}*
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
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.JobbingReorientJobs, CardProps>()(
    ExpandedAdviceCardContentBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({reorientJobbingJobs}: bayes.bob.JobbingReorientJobs): bayes.bob.ReorientJob[] =>
    reorientJobbingJobs,
  'métier')


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
