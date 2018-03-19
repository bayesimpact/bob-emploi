import keyBy from 'lodash/keyBy'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {getJobs} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {genderizeJob, getJobSearchURL} from 'store/job'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, Colors, PaddedOnMobile, Styles} from 'components/theme'
import Picto from 'images/advices/picto-better-job-in-group.png'

import {DataSource} from './base'



class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    fontSize: PropTypes.number.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice, fontSize, profile, userYou} = this.props
    const {betterJob} = advice.betterJobInGroupData || {}
    const jobName = job => lowerFirstLetter(genderizeJob(job, profile.gender))
    if (!betterJob) {
      return null
    }
    return <div>
      <div style={{fontSize: fontSize}}>
        Certains métiers proches embauchent plus en ce moment&nbsp;:
        et si demain {userYou('tu postulais ', 'vous postuliez ')}comme
        <strong> {jobName(betterJob)}</strong>&nbsp;?
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
    userYou: PropTypes.func.isRequired,
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
    const weights = keyBy(requirements.specificJobs || [], 'codeOgr')
    const weightedJobs = (jobs || []).map(job => ({
      job,
      weight: weights[job.codeOgr] && weights[job.codeOgr].percentSuggested / 100 || 0,
    })).sort((jobA, jobB) => jobB.weight - jobA.weight)
    this.setState({weightedJobs})
  }

  openJob(job) {
    const {profile} = this.props
    window.open(getJobSearchURL(job, profile.gender), '_blank')
  }

  renderWeightedJob({job, weight}, style, maxWeight, isTargetJob, isBetterThanTarget) {
    const {profile, userYou} = this.props
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
      color: isHovered ? Colors.BOB_BLUE : 'initial',
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
        {genderizeJob(job, profile.gender)}
        {isTargetJob ? userYou(' (toi)', ' (vous)') : ''}
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
      <ChevronDownIcon style={{fill: Colors.CHARCOAL_GREY, height: 20, width: 20}} />
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

      <DataSource>
        ROME  <a
          href={`http://candidat.pole-emploi.fr/marche-du-travail/fichemetierrome?codeRome=${jobGroup.romeId}`}
          style={{color: Colors.COOL_GREY}}
          target="_blank" rel="noopener noreferrer">{jobGroup.romeId}</a> / Pôle emploi
      </DataSource>

    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, props) => ({
  jobGroupInfo: app.specificJobs[props.project.targetJob.jobGroup.romeId],
}))(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
