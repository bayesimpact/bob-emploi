import React from 'react'
import PropTypes from 'prop-types'

import {inDepartement, lowerFirstLetter} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {GrowingNumber, PaddedOnMobile, StringJoiner} from 'components/theme'
import Picto from 'images/advices/picto-reorient-jobbing.png'

import {AdviceSuggestionList, connectExpandedCardWithContent,
  DataSource, JobSuggestion} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  computeJobText(jobNames) {
    const jobText = jobNames.map((name, index) => <strong key={`jobname-${index}`}>
      {lowerFirstLetter(name)} </strong>)
    return jobText
  }

  render() {
    const {advice, project: {city}, userYou} = this.props
    const {jobs} = advice.reorientData || {}
    const jobNames = (jobs || []).map(job => job.name)
    const jobText = this.computeJobText(jobNames)
    const location = inDepartement(city) || `dans ${userYou('ton', 'votre')} département`

    return <div style={{fontSize: 30}}>
      Des métiers {jobNames.length ? <span>comme <StringJoiner>
        {jobText}
      </StringJoiner></span> : null} recrutent beaucoup {location} en ce moment.
    </div>
  }
}


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      reorientJobbingJobs: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
      }).isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  computeAllJobs() {
    const {adviceData: {reorientJobbingJobs = []}, onExplore} = this.props
    const jobList = reorientJobbingJobs.slice(0, 6).map((job, index) => <JobSuggestion
      key={`job-${index}`}
      job={job}
      onClick={onExplore('job')}
      style={isMobileVersion ? {paddingRight: 0} : null} />)
    return jobList
  }

  render() {
    const allJobs = this.computeAllJobs()
    const {project: {city}, userYou} = this.props

    if (allJobs.length < 1) {
      return null
    }

    const inYourDepartement = inDepartement(city) || `dans ${userYou('ton', 'votre')} département`

    return <div>
      <PaddedOnMobile style={{fontSize: 16}}>
        Ces <GrowingNumber style={{fontWeight: 'bold'}} number={allJobs.length} isSteady={true} />
        &nbsp;métiers recrutent beaucoup {inYourDepartement}&nbsp;:
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {[<JobSuggestion
          isNotClickable={true}
          isCaption={true}
          key="jobs-caption"
          style={{marginTop: 1}} />].concat(allJobs)}
      </AdviceSuggestionList>
      <DataSource>
        IMT 2017 / Pôle emploi
      </DataSource>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
