import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import _ from 'underscore'

import {getJobs} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {genderizeJob} from 'store/job'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, Colors, Icon, PaddedOnMobile, Styles} from 'components/theme'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  render() {
    const {advice, profile} = this.props
    const {betterJob} = advice.betterJobInGroupData || {}
    const jobName = job => lowerFirstLetter(genderizeJob(job, profile.gender))
    if (!betterJob) {
      return null
    }
    return <div>
      <div style={{fontSize: 30}}>
        Certains métiers proches embauchent plus en ce moment&nbsp;:
        et si demain vous postuliez comme <strong>{jobName(betterJob)}</strong>&nbsp;?
      </div>
    </div>
  }
}


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    jobGroupInfo: PropTypes.object,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }

  state = {
    areAllJobsShown: false,
    hoveredJob: null,
    weightedJobs: [],
  }

  componentWillMount() {
    const {dispatch, jobGroupInfo, project} = this.props
    if (!jobGroupInfo) {
      dispatch(getJobs(project.targetJob.jobGroup))
    }
    this.updateWeightedJobs({}, this.props)
  }

  componentWillReceiveProps(nextProps) {
    const {advice, jobGroupInfo} = this.props
    this.updateWeightedJobs({advice, jobGroupInfo}, nextProps)
  }

  updateWeightedJobs(prevProps, nextProps) {
    const {advice, jobGroupInfo} = nextProps
    if (jobGroupInfo === prevProps.jobGroupInfo && (jobGroupInfo || advice === prevProps.advice)) {
      return
    }
    if (!jobGroupInfo) {
      this.setState({weightedJobs: []})
      return
    }
    const {jobs, requirements} = jobGroupInfo
    const weights = _.indexBy(requirements.specificJobs || [], 'codeOgr')
    const weightedJobs = (jobs || []).map(job => ({
      job,
      weight: weights[job.codeOgr] && weights[job.codeOgr].percentSuggested / 100 || 0,
    })).sort((jobA, jobB) => jobB.weight - jobA.weight)
    this.setState({weightedJobs})
  }

  openJob(job) {
    const {profile} = this.props
    const searchTerms = encodeURIComponent('métier ' + genderizeJob(job, profile.gender))
    window.open(`https://www.google.fr/search?q=${searchTerms}`, '_blank')
  }

  renderWeightedJob({job, weight}, style, maxWeight, isTargetJob, isBetterThanTarget) {
    const {profile} = this.props
    const {hoveredJob} = this.state
    const isHovered = hoveredJob === job
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      height: 50,
      padding: '0 15px 0 0',
      ...style,
    }
    const jobNameStyle = {
      color: isHovered ? Colors.SKY_BLUE : 'initial',
      cursor: 'pointer',
      fontWeight: isTargetJob ? 'bold' : 'initial',
      paddingLeft: 20,
      paddingRight: 20,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const offersCountStyle = {
      color: isBetterThanTarget ? Colors.GREENISH_TEAL : Colors.COOL_GREY,
      fontWeight: 500,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const rangeStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      height: 22,
      marginLeft: 15,
      position: 'relative',
      width: 200,
    }
    const progressStyle = {
      backgroundColor: isBetterThanTarget ? Colors.GREENISH_TEAL : Colors.SLATE,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: `${100 * (weight || 0) / maxWeight}%`,
    }
    return <div key={job.codeOgr} style={containerStyle} onClick={() => this.openJob(job)}>
      <span
        style={jobNameStyle}
        onMouseEnter={() => this.setState({hoveredJob: job})}
        onMouseLeave={() => this.setState({hoveredJob: hoveredJob === job ? null : hoveredJob})}>
        {genderizeJob(job, profile.gender)}{isTargetJob ? ' (vous)' : ''}
      </span>
      <span style={{flex: 1}} />
      {weight ? <span style={{alignItems: 'center', display: 'flex'}}>
        <div style={offersCountStyle}>
          {Math.round(weight * 100)}% des offres
        </div>

        <div style={rangeStyle}>
          <div style={progressStyle} />
        </div>
      </span> : null}
    </div>
  }

  renderShowMoreButton() {
    const style = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 500,
      height: 50,
      justifyContent: 'center',
      marginTop: -1,
    }
    return <div style={style} onClick={() => this.setState({areAllJobsShown: true})}>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        Voir tous les métiers
      </span>
      <Icon name="chevron-down" style={{fontSize: 20}} />
    </div>
  }

  render() {
    const {project} = this.props
    const {areAllJobsShown, weightedJobs} = this.state
    const {codeOgr, jobGroup} = project.targetJob
    const targetJobIndex = weightedJobs.findIndex(({job}) => job.codeOgr === codeOgr)
    const maxWeight = Math.min((weightedJobs.length && weightedJobs[0].weight || 1) + .1, 1)
    return <div>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15}}>
        Répartition des offres d'emploi pour <strong>{weightedJobs.length} métiers</strong> du
        groupe {jobGroup.name}*
      </PaddedOnMobile>

      <AppearingList maxNumChildren={areAllJobsShown ? undefined : (targetJobIndex + 1) || 10}>
        {weightedJobs.map((job, index) => this.renderWeightedJob(
          job, index ? {marginTop: -1} : null, maxWeight,
          index === targetJobIndex, targetJobIndex >= 0 && index < targetJobIndex))}
      </AppearingList>

      {areAllJobsShown ? null : this.renderShowMoreButton()}

      <PaddedOnMobile style={{color: Colors.COOL_GREY, fontStyle: 'italic', margin: '15px 0'}}>
        *Source&nbsp;: ROME <a
          href={`http://candidat.pole-emploi.fr/marche-du-travail/fichemetierrome?codeRome=${jobGroup.romeId}`}
          style={{color: Colors.COOL_GREY}}
          target="_blank" rel="noopener noreferrer">{jobGroup.romeId}</a> / Pôle emploi
      </PaddedOnMobile>
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, props) => ({
  jobGroupInfo: app.specificJobs[props.project.targetJob.jobGroup.romeId],
}))(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent}
