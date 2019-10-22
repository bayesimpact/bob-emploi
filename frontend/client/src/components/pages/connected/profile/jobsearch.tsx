import _memoize from 'lodash/memoize'
import _pick from 'lodash/pick'
import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, diagnoseOnboarding} from 'store/actions'
import {weeklyApplicationOptions} from 'store/job'
import {getJobSearchLengthMonths, userExample} from 'store/user'

import {FieldSet, Select} from 'components/pages/connected/form_utils'
import {OnboardingComment, ProjectStepProps, Step} from './step'


// 2635200000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2635200000

const jobSearchLengthMonthsOptions = [
  {name: "Je n'ai pas encore commencé", value: -1},
]
_range(1, 19).forEach((monthsAgo): void => {
  jobSearchLengthMonthsOptions.push({name: `${monthsAgo} mois`, value: monthsAgo})
})
jobSearchLengthMonthsOptions.push({name: 'Plus de 18 mois', value: 19})


// TODO(cyrille): Move to store.
const weeklyOfferOptions = [
  {name: '0 ou 1 offre intéressante par semaine', value: 'LESS_THAN_2'},
  {name: '2 à 5 offres intéressantes par semaine', value: 'SOME'},
  {name: '6 à 15 offres intéressantes  par semaine', value: 'DECENT_AMOUNT'},
  {name: 'Plus de 15 offres intéressantes par semaine', value: 'A_LOT'},
]


// TODO(cyrille): Drop this function and use the above once we're sure both date and bool fields are
// correct.
const getJobSearch = (project): bayes.bob.Project => {
  const length = getJobSearchLengthMonths(project)
  return {
    jobSearchHasNotStarted: project.jobSearchHasNotStarted || length < 0,
    jobSearchLengthMonths: length,
  }
}

const updateJobSearchLength = (jobSearchLengthMonths): bayes.bob.Project => {
  // TODO(cyrille): Drop length in months once field is removed.
  const projectState: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} =
    {jobSearchLengthMonths}
  if (jobSearchLengthMonths < 0) {
    projectState.jobSearchHasNotStarted = true
  } else {
    projectState.jobSearchStartedAt =
      new Date(new Date().getTime() - MILLIS_IN_MONTH * jobSearchLengthMonths).toISOString()
  }
  return projectState
}


interface StepProps extends ProjectStepProps {
  dispatch: DispatchAllActions
}


interface StepState {
  applicationCommentRead?: boolean
  isValidated?: boolean
}


interface SelectOption {
  name: string
  value: number
}


class NewProjectJobsearchStepBase extends React.PureComponent<StepProps, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    newProject: PropTypes.shape({
      jobSearchHasNotStarted: PropTypes.bool,
      jobSearchLengthMonths: PropTypes.number,
      jobSearchStartedAt: PropTypes.string,
      totalInterviewCount: PropTypes.number,
      weeklyApplicationsEstimate: PropTypes.string,
      weeklyOffersEstimate: PropTypes.string,
    }),
    onSubmit: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }


  public state: StepState = {}

  private handleSubmit = (): void => {
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      const {jobSearchHasNotStarted, jobSearchStartedAt, jobSearchLengthMonths,
        totalInterviewCount, weeklyApplicationsEstimate, weeklyOffersEstimate,
      } = this.props.newProject
      this.props.onSubmit({
        jobSearchHasNotStarted,
        // TODO(cyrille): Drop once every user has the two other fields set.
        jobSearchLengthMonths,
        jobSearchStartedAt,
        totalInterviewCount,
        weeklyApplicationsEstimate,
        weeklyOffersEstimate,
      })
    }
  }

  private fastForward = (): void => {
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchLengthMonths = undefined,
      jobSearchStartedAt = undefined,
      totalInterviewCount = undefined,
      weeklyApplicationsEstimate = undefined,
      weeklyOffersEstimate = undefined,
    } = this.props.newProject || {}
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!jobSearchLengthMonths && !jobSearchHasNotStarted && !jobSearchStartedAt) {
      Object.assign(
        projectDiff,
        _pick(userExample.projects[0], ['jobSearchStartedAt', 'jobSearchHasNotStarted']))
    }
    if (!totalInterviewCount) {
      projectDiff.totalInterviewCount = userExample.projects[0].totalInterviewCount
    }
    if (!weeklyApplicationsEstimate) {
      projectDiff.weeklyApplicationsEstimate = userExample.projects[0].weeklyApplicationsEstimate
    }
    if (!weeklyOffersEstimate) {
      projectDiff.weeklyOffersEstimate = userExample.projects[0].weeklyOffersEstimate
    }
    this.props.dispatch(diagnoseOnboarding({projects: [projectDiff]}))

    this.setState({applicationCommentRead: true})
  }

  private isFormValid = (): boolean => {
    // TODO(cyrille): Drop jobSearchLengthMonths once old users have been migrated.
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchLengthMonths = undefined,
      jobSearchStartedAt = undefined,
      totalInterviewCount = undefined,
      weeklyApplicationsEstimate = undefined,
      weeklyOffersEstimate = undefined,
    } = this.props.newProject || {}
    return !!(totalInterviewCount && weeklyApplicationsEstimate &&
              weeklyOffersEstimate &&
              (jobSearchStartedAt || jobSearchLengthMonths && jobSearchLengthMonths >= 0) ||
              (jobSearchHasNotStarted || jobSearchLengthMonths === -1))
  }

  private handleSearchLengthChange = (jobSearchLengthMonths): void => {
    this.props.dispatch(
      diagnoseOnboarding({projects: [updateJobSearchLength(jobSearchLengthMonths)]}))
  }

  private handleChange = _memoize((field): ((value) => void) => (value): void => {
    if (field === 'weeklyApplicationsEstimate' && this.state.applicationCommentRead) {
      this.setState({applicationCommentRead: false})
    }
    this.props.dispatch(diagnoseOnboarding({projects: [{[field]: value}]}))
  })

  // Handle the event marking the comment as read.
  //
  // NOTE: If there ever are any other commented fields,
  // add the field name as a parameter to the function and memoize it.
  private handleCommentRead = (): void => this.setState({applicationCommentRead: true})

  public render(): React.ReactNode {
    const {newProject = {}, userYou} = this.props
    const {totalInterviewCount, weeklyApplicationsEstimate, weeklyOffersEstimate} = newProject
    const {applicationCommentRead, isValidated} = this.state
    const interviewsLabel = <span>
      Combien d'entretiens d'embauche {userYou('as-tu', 'avez-vous')} obtenus
      <strong style={{fontWeight: 'bold'}}> depuis que {userYou('tu cherches', 'vous cherchez')} ce
      métier</strong> ?
    </span>
    const {jobSearchHasNotStarted, jobSearchLengthMonths} = getJobSearch(newProject)
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      jobSearchLengthMonths,
      weeklyOffersEstimate || jobSearchHasNotStarted,
      (applicationCommentRead && weeklyApplicationsEstimate) || jobSearchHasNotStarted,
      totalInterviewCount || jobSearchHasNotStarted,
    ]
    return <Step
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : undefined}
      progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
      title={`${userYou('Ta', 'Votre')} recherche`}>
      <FieldSet
        label={`Depuis combien de temps a${userYou(
          's-tu', 'vez-vous')} commencé à postuler à des offres pour ce métier\u00A0?`}
        isValid={!!jobSearchLengthMonths} isValidated={isValidated}
        hasCheck={true}>
        <Select<number>
          options={jobSearchLengthMonthsOptions} value={jobSearchLengthMonths}
          placeholder={`sélectionne${userYou(' la durée de ta', 'z la durée de votre')} recherche`}
          areUselessChangeEventsMuted={false} onChange={this.handleSearchLengthChange} />
      </FieldSet>
      {checks[0] && !jobSearchHasNotStarted ? <FieldSet
        label={`En moyenne, combien trouve${userYou(
          's-tu', 'z-vous')} de nouvelles offres qui ${userYou(
          'te', 'vous')} conviennent par semaine\u00A0?`}
        isValid={!!weeklyOffersEstimate} isValidated={isValidated}
        hasCheck={true}>
        <Select options={weeklyOfferOptions} value={weeklyOffersEstimate}
          placeholder={`sélectionne${userYou('', 'z')} le nombre d'offres que ${userYou(
            'tu as', 'vous avez')} trouvées`}
          onChange={this.handleChange('weeklyOffersEstimate')} />
      </FieldSet> : null}
      {checks.slice(0, 2).every((c): boolean => !!c) && !jobSearchHasNotStarted ? <React.Fragment>
        <FieldSet
          label={`En moyenne, combien de candidatures fai${userYou(
            's-tu', 'tes-vous')} par semaine\u00A0?`}
          isValid={!!weeklyApplicationsEstimate} isValidated={isValidated}
          hasNoteOrComment={true} hasCheck={true}>
          <Select options={weeklyApplicationOptions} value={weeklyApplicationsEstimate}
            placeholder={`sélectionne${userYou('', 'z')} le nombre de candidatures que ${userYou(
              'tu as', 'vous avez')} faites`}
            onChange={this.handleChange('weeklyApplicationsEstimate')} />
        </FieldSet>
        <OnboardingComment
          field="WEEKLY_APPLICATION_FIELD" shouldShowAfter={!!weeklyApplicationsEstimate}
          key={weeklyApplicationsEstimate}
          onDone={this.handleCommentRead} />
      </React.Fragment> : null}
      {checks.slice(0, 3).every((c): boolean => !!c) && !jobSearchHasNotStarted ? <FieldSet
        label={interviewsLabel}
        isValid={!!totalInterviewCount} isValidated={isValidated}
        hasCheck={true}>
        <Select<number>
          onChange={this.handleChange('totalInterviewCount')}
          value={totalInterviewCount}
          placeholder={`sélectionne${userYou('', 'z')} le nombre d'entretiens que ${userYou(
            'tu as', 'vous avez')} obtenus`}
          options={[{name: "Aucun pour l'instant", value: -1}].
            concat(new Array(20).fill(0).map((unused, index): SelectOption => ({
              name: (index + 1) + '',
              value: index + 1,
            }))).
            concat([{name: 'Plus de 20', value: 21}])} />
      </FieldSet> : null}
    </Step>
  }
}
const NewProjectJobsearchStep = connect()(NewProjectJobsearchStepBase)


export {NewProjectJobsearchStep, weeklyApplicationOptions, weeklyOfferOptions}
