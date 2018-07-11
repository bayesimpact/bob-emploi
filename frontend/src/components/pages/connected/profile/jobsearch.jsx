import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React from 'react'

import {diagnoseOnboarding} from 'store/actions'

import {FieldSet, Select} from 'components/pages/connected/form_utils'
import {OnboardingComment, Step} from './step'


const jobSearchLengthMonthsOptions = [
  {name: "Je n'ai pas encore commencé", value: -1},
]
_range(1, 19).forEach(monthsAgo => {
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

// TODO(cyrille): Move to store.
const weeklyApplicationOptions = [
  {name: '0 ou 1 candidature par semaine', value: 'LESS_THAN_2'},
  {name: '2 à 5 candidatures par semaine', value: 'SOME'},
  {name: '6 à 15 candidatures par semaine', value: 'DECENT_AMOUNT'},
  {name: 'Plus de 15 candidatures par semaine', value: 'A_LOT'},
]


class NewProjectJobsearchStep extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    newProject: PropTypes.shape({
      jobSearchLengthMonths: PropTypes.number,
      totalInterviewCount: PropTypes.number,
      weeklyApplicationsEstimate: PropTypes.string,
      weeklyOffersEstimate: PropTypes.string,
    }),
    onSubmit: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }


  state = {}

  handleSubmit = () => {
    const {jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.props.newProject || {}
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      this.props.onSubmit({
        jobSearchLengthMonths,
        totalInterviewCount,
        weeklyApplicationsEstimate,
        weeklyOffersEstimate,
      })
    }
  }

  fastForward = () => {
    const {jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.props.newProject || {}
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff = {}
    if (!jobSearchLengthMonths) {
      projectDiff.jobSearchLengthMonths = 11
    }
    if (!totalInterviewCount) {
      projectDiff.totalInterviewCount = Math.floor(Math.random() * 22) || -1
    }
    if (!weeklyApplicationsEstimate) {
      projectDiff.weeklyApplicationsEstimate = 'SOME'
    }
    if (!weeklyOffersEstimate) {
      projectDiff.weeklyOffersEstimate = 'DECENT_AMOUNT'
    }
    this.props.dispatch(diagnoseOnboarding({projects: [projectDiff]}))

    this.setState({applicationCommentRead: true})
  }

  isFormValid = () => {
    const {jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.props.newProject || {}
    return !!(totalInterviewCount && weeklyApplicationsEstimate &&
              weeklyOffersEstimate && jobSearchLengthMonths ||
              (jobSearchLengthMonths === -1))
  }

  handleChange = field => value => {
    if (field === 'weeklyApplicationsEstimate' && this.state.applicationCommentRead) {
      this.setState({applicationCommentRead: false})
    }
    this.props.dispatch(diagnoseOnboarding({projects: [{[field]: value}]}))
  }

  render() {
    const {newProject: {jobSearchLengthMonths, totalInterviewCount, weeklyApplicationsEstimate,
      weeklyOffersEstimate} = {}, userYou} = this.props
    const {applicationCommentRead, isValidated} = this.state
    const interviewsLabel = <span>
      Combien d'entretiens d'embauche {userYou('as-tu', 'avez-vous')} obtenus
      <strong style={{fontWeight: 'bold'}}> depuis que {userYou('tu cherches', 'vous cherchez')} ce
      métier</strong> ?
    </span>
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      jobSearchLengthMonths,
      weeklyOffersEstimate || jobSearchLengthMonths === -1,
      (applicationCommentRead && weeklyApplicationsEstimate) || jobSearchLengthMonths === -1,
      totalInterviewCount || jobSearchLengthMonths === -1,
    ]
    return <Step
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}
      progressInStep={checks.filter(c => c).length / (checks.length + 1)}
      title={`${userYou('Ta', 'Votre')} recherche`}>
      <FieldSet
        label={`Depuis combien de temps a${userYou(
          's-tu', 'vez-vous')} commencé à postuler à des offres pour ce métier\u00A0?`}
        isValid={!!jobSearchLengthMonths} isValidated={isValidated} hasCheck={true}>
        <Select
          options={jobSearchLengthMonthsOptions} value={jobSearchLengthMonths}
          placeholder={`sélectionne${userYou(' la durée de ta', 'z la durée de votre')} recherche`}
          onChange={this.handleChange('jobSearchLengthMonths')} />
      </FieldSet>
      {checks[0] && jobSearchLengthMonths > 0 ? <FieldSet
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
      {checks.slice(0, 2).every(c => c) && jobSearchLengthMonths > 0 ? <React.Fragment>
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
          onDone={() => this.setState({applicationCommentRead: true})} />
      </React.Fragment> : null}
      {checks.slice(0, 3).every(c => c) && jobSearchLengthMonths > 0 ? <FieldSet
        label={interviewsLabel}
        isValid={!!totalInterviewCount} isValidated={isValidated}
        hasCheck={true}>
        <Select
          onChange={value => this.handleChange('totalInterviewCount')(parseInt(value, 10))}
          value={totalInterviewCount}
          placeholder={`sélectionne${userYou('', 'z')} le nombre d'entretiens que ${userYou(
            'tu as', 'vous avez')} obtenus`}
          options={[{name: "Aucun pour l'instant", value: -1}].
            concat(new Array(20).fill().map((unused, index) => ({
              name: (index + 1) + '',
              value: index + 1,
            }))).
            concat([{name: 'Plus de 20', value: 21}])} />
      </FieldSet> : null}
    </Step>
  }
}

export {NewProjectJobsearchStep, weeklyApplicationOptions, weeklyOfferOptions}
