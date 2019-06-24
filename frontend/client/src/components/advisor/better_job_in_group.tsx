import _keyBy from 'lodash/keyBy'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, getJobs} from 'store/actions'
import {YouChooser} from 'store/french'
import {genderizeJob, getJobSearchURL} from 'store/job'

import {isMobileVersion} from 'components/mobile'
import {RadiumExternalLink} from 'components/radium'
import {ExternalLink, GrowingNumber, PercentBar} from 'components/theme'
import NewPicto from 'images/advices/picto-better-job-in-group.svg'

import {CardProps, DataSource, MethodSuggestionList, TakeAwayTemplate, WithAdvice} from './base'


interface WeightedJobProps {
  gender?: bayes.bob.Gender
  isBetterThanTarget?: boolean
  isTargetJob?: boolean
  job: bayes.bob.Job
  maxWeight?: number
  onClick: () => void
  style?: React.CSSProperties
  userYou: YouChooser
  weight?: number
}

class WeightedJob extends React.PureComponent<WeightedJobProps> {
  public static propTypes = {
    gender: PropTypes.string,
    isBetterThanTarget: PropTypes.bool,
    isTargetJob: PropTypes.bool,
    job: PropTypes.object,
    maxWeight: PropTypes.number,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
    weight: PropTypes.number,
  }

  public render(): React.ReactNode {
    const {gender, job, weight, style, maxWeight, onClick, isTargetJob, isBetterThanTarget,
      userYou} = this.props
    const containerStyle = {
      color: 'inherit',
      textDecoration: 'none',
      ...style,
    }
    const jobNameStyle: RadiumCSSProperties = {
      ':hover': {
        color: colors.BOB_BLUE,
      },
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
    const rangeStyle: React.CSSProperties = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      borderRadius: 3,
      flex: 'none',
      height: 22,
      position: 'relative',
      width: 200,
    }
    const progressStyle: React.CSSProperties = {
      backgroundColor: isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE,
      borderRadius: 3,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: `${100 * (weight || 0) / maxWeight}%`,
    }
    const barColor = isBetterThanTarget ? colors.GREENISH_TEAL : colors.SLATE
    const percent = 100 * (weight || 0) / maxWeight
    return <RadiumExternalLink
      href={getJobSearchURL(job, gender)} style={containerStyle} onClick={onClick}>
      <span style={jobNameStyle}>
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
    </RadiumExternalLink>
  }
}


interface CardConnectedProps {
  jobGroupInfo: bayes.bob.JobGroup
}


type CardInnerProps = CardProps & CardConnectedProps


interface WeightedJobGroup {
  job: bayes.bob.JobGroup
  weight: number
}

interface CardState {
  areAllJobsShown?: boolean
  jobGroupInfo?: bayes.bob.JobGroup
  weightedJobs?: WeightedJobGroup[]
}


class ExpandedAdviceCardContentBase extends React.PureComponent<CardInnerProps, CardState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    handleExplore: PropTypes.func.isRequired,
    jobGroupInfo: PropTypes.object,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    areAllJobsShown: false,
    jobGroupInfo: null,
    weightedJobs: [],
  }

  public static getDerivedStateFromProps(
    nextProps: CardInnerProps, prevState: CardState): CardState {
    const {jobGroupInfo} = nextProps
    if (jobGroupInfo === prevState.jobGroupInfo) {
      return null
    }
    if (!jobGroupInfo) {
      return {weightedJobs: []}
    }
    const {jobs, requirements} = jobGroupInfo
    const weights = _keyBy(requirements.specificJobs || [], 'codeOgr')
    const weightedJobs = (jobs || []).map((job): WeightedJobGroup => ({
      job,
      weight: weights[job.codeOgr] && weights[job.codeOgr].percentSuggested / 100 || 0,
    })).sort((jobA, jobB): number => jobB.weight - jobA.weight)
    return {weightedJobs}
  }

  public componentDidMount(): void {
    const {dispatch, jobGroupInfo, project: {targetJob: {jobGroup = {}} = {}} = {}} = this.props
    if (!jobGroupInfo) {
      dispatch(getJobs(jobGroup))
    }
  }

  private showAllJobs = (): void => this.setState({areAllJobsShown: true})

  private renderShowMoreButton(): ReactStylableElement {
    if (this.state.areAllJobsShown) {
      return null
    }
    const style = {
      fontWeight: 500,
      justifyContent: 'center',
    }
    return <div key="show-more" style={style} onClick={this.showAllJobs}>
      <span style={{fontSize: 13}}>
        Voir tous les métiers
      </span>
      <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </div>
  }

  public render(): React.ReactNode {
    const {handleExplore, profile: {gender},
      project: {targetJob: {codeOgr = '', jobGroup = {}} = {}} = {}, userYou} = this.props
    const {areAllJobsShown, weightedJobs} = this.state
    const targetJobIndex = weightedJobs.findIndex(({job}): boolean => job.codeOgr === codeOgr)
    const maxWeight = Math.min((weightedJobs.length && weightedJobs[0].weight || 1) + .1, 1)
    const title = <React.Fragment>
      <GrowingNumber number={targetJobIndex} /> métier{targetJobIndex > 1 ? 's' : ''} avec plus
      d'offres d'emploi
    </React.Fragment>
    const subtitle = `Répartition des offres d'emploi pour ${weightedJobs.length} métiers du
      groupe ${jobGroup.name}*`
    const footer = <DataSource style={{margin: 0}}>
      ROME <ExternalLink
        href={`http://candidat.pole-emploi.fr/marche-du-travail/fichemetierrome?codeRome=${jobGroup.romeId}`}
        style={{color: colors.COOL_GREY}}>{jobGroup.romeId}</ExternalLink> / Pôle emploi
    </DataSource>
    const shownJobs = areAllJobsShown ? weightedJobs :
      weightedJobs.slice(0, (targetJobIndex + 1) || 10)
    return <MethodSuggestionList title={title} subtitle={subtitle} footer={footer}>
      {shownJobs.map(({job, weight}, index): ReactStylableElement =>
        <WeightedJob
          isTargetJob={index === targetJobIndex}
          isBetterThanTarget={index < targetJobIndex} key={job.codeOgr}
          onClick={handleExplore('job')}
          {...{gender, job, maxWeight, userYou, weight}} />).concat([this.renderShowMoreButton()])}
    </MethodSuggestionList>
  }
}
const ExpandedAdviceCardContent = connect(
  (
    {app}: RootState,
    {project: {targetJob: {jobGroup: {romeId = undefined} = {}} = {}} = {}}: CardProps,
  ): CardConnectedProps => ({
    jobGroupInfo: app.specificJobs[romeId],
  })
)(ExpandedAdviceCardContentBase)


interface TakeAwayProps extends CardConnectedProps, WithAdvice {
  dispatch: DispatchAllActions
}

class TakeAwayBase extends React.PureComponent<TakeAwayProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    jobGroupInfo: PropTypes.object,
    project: PropTypes.shape({
      targetJob: PropTypes.shape({
        codeOgr: PropTypes.string.isRequired,
      }).isRequired,
    }).isRequired,
  }

  public componentDidMount(): void {
    const {dispatch, jobGroupInfo, project: {targetJob: {jobGroup = {}} = {}} = {}} = this.props
    if (!jobGroupInfo) {
      dispatch(getJobs(jobGroup))
    }
  }

  private getBetterJobs= (): bayes.bob.JobRequirement[] => {
    const {
      jobGroupInfo: {requirements: {specificJobs = []} = {}} = {},
      project: {targetJob: {codeOgr: ownCodeOgr = ''} = {}} = {}} = this.props
    const {percentSuggested: weight = 0} =
      specificJobs.find(({codeOgr}): boolean => codeOgr === ownCodeOgr) || {}
    return specificJobs.filter(({percentSuggested}): boolean => percentSuggested > weight)
  }

  public render(): React.ReactNode {
    return <TakeAwayTemplate found="métier" list={this.getBetterJobs()} />
  }
}
const TakeAway = connect(
  (
    {app}: RootState,
    {project: {targetJob: {jobGroup: {romeId = ''} = {}} = {}} = {}}: WithAdvice,
  ): CardConnectedProps =>
    ({jobGroupInfo: app.specificJobs[romeId]})
)(TakeAwayBase)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
