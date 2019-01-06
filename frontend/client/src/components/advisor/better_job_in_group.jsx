import _keyBy from 'lodash/keyBy'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {getJobs} from 'store/actions'
import {genderizeJob, getJobSearchURL} from 'store/job'

import {isMobileVersion} from 'components/mobile'
import {AppearingList, ExternalLink, PercentBar} from 'components/theme'
import Picto from 'images/advices/picto-better-job-in-group.png'

import {DataSource} from './base'



class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    jobGroupInfo: PropTypes.object,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    areAllJobsShown: false,
    hoveredJob: null,
    jobGroupInfo: null,
    weightedJobs: [],
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const {jobGroupInfo} = nextProps
    if (jobGroupInfo === prevState.jobGroupInfo) {
      return null
    }
    if (!jobGroupInfo) {
      return {weightedJobs: []}
    }
    const {jobs, requirements} = jobGroupInfo
    const weights = _keyBy(requirements.specificJobs || [], 'codeOgr')
    const weightedJobs = (jobs || []).map(job => ({
      job,
      weight: weights[job.codeOgr] && weights[job.codeOgr].percentSuggested / 100 || 0,
    })).sort((jobA, jobB) => jobB.weight - jobA.weight)
    return {weightedJobs}
  }

  componentDidMount() {
    const {dispatch, jobGroupInfo, project: {targetJob: {jobGroup} = {}} = {}} = this.props
    if (!jobGroupInfo) {
      dispatch(getJobs(jobGroup))
    }
  }

  openJob(job) {
    const {onExplore, profile: {gender}} = this.props
    window.open(getJobSearchURL(job, gender), '_blank')
    onExplore('job')
  }

  renderWeightedJob({job, weight}, style, maxWeight, isTargetJob, isBetterThanTarget) {
    const {profile: {gender}, userYou} = this.props
    const {hoveredJob} = this.state
    const isHovered = hoveredJob === job
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      height: 50,
      padding: '0 15px 0 0',
      ...style,
    }
    const jobNameStyle = {
      color: isHovered ? colors.BOB_BLUE : 'initial',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: isTargetJob ? 'bold' : 'initial',
      paddingLeft: 20,
      paddingRight: 20,
    }
    const offersCountStyle = {
      color: isBetterThanTarget ? colors.GREENISH_TEAL : colors.COOL_GREY,
      fontSize: 13,
      fontWeight: 500,
      marginRight: isMobileVersion ? 10 : 15,
    }
    const rangeStyle = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      height: 22,
      position: 'relative',
      width: 200,
    }
    const progressStyle = {
      backgroundColor: isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: `${100 * (weight || 0) / maxWeight}%`,
    }
    const barColor = isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE
    const percent = 100 * (weight || 0) / maxWeight
    return <div key={job.codeOgr} style={containerStyle} onClick={() => this.openJob(job)}>
      <span
        style={jobNameStyle}
        onMouseEnter={() => this.setState({hoveredJob: job})}
        onMouseLeave={() => this.setState({hoveredJob: hoveredJob === job ? null : hoveredJob})}>
        {genderizeJob(job, gender)}
        {isTargetJob ? userYou(' (toi)', ' (vous)') : ''}
      </span>
      <span style={{flex: 1}} />
      {weight ? <span style={{alignItems: 'center', display: 'flex'}}>
        <div style={offersCountStyle}>
          {Math.round(weight * 100)}% des offres
        </div>

        {isMobileVersion ? <PercentBar
          color={barColor} percent={percent} height={10}
          style={{flexShrink: 0, margin: 'auto 0', width: 47}} isPercentShown={false} /> :
          <div style={rangeStyle}>
            <div style={progressStyle} />
          </div>}
      </span> : null}
    </div>
  }

  renderShowMoreButton() {
    const style = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontWeight: 500,
      height: 50,
      justifyContent: 'center',
      marginTop: -1,
    }
    return <div style={style} onClick={() => this.setState({areAllJobsShown: true})}>
      <span style={{fontSize: 13}}>
        Voir tous les métiers
      </span>
      <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </div>
  }

  render() {
    const {project: {targetJob: {codeOgr, jobGroup} = {}} = {}} = this.props
    const {areAllJobsShown, weightedJobs} = this.state
    const targetJobIndex = weightedJobs.findIndex(({job}) => job.codeOgr === codeOgr)
    const maxWeight = Math.min((weightedJobs.length && weightedJobs[0].weight || 1) + .1, 1)

    return <div>
      <div style={{marginBottom: 15}}>
        Répartition des offres d'emploi pour <strong>{weightedJobs.length} métiers</strong> du
        groupe {jobGroup.name}*
      </div>

      <AppearingList maxNumChildren={areAllJobsShown ? undefined : (targetJobIndex + 1) || 10}>
        {weightedJobs.map((job, index) => this.renderWeightedJob(
          job, index ? {marginTop: -1} : null, maxWeight,
          index === targetJobIndex, targetJobIndex >= 0 && index < targetJobIndex))}
      </AppearingList>

      {areAllJobsShown ? null : this.renderShowMoreButton()}

      <DataSource>
        ROME <ExternalLink
          href={`http://candidat.pole-emploi.fr/marche-du-travail/fichemetierrome?codeRome=${jobGroup.romeId}`}
          style={{color: colors.COOL_GREY}}>{jobGroup.romeId}</ExternalLink> / Pôle emploi
      </DataSource>

    </div>
  }
}
const ExpandedAdviceCardContent = connect(
  ({app}, {project: {targetJob: {jobGroup: {romeId} = {}} = {}} = {}}) => ({
    jobGroupInfo: app.specificJobs[romeId],
  })
)(ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
