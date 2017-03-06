import React from 'react'
import _ from 'underscore'

import {FieldSet, Select} from 'components/theme'
import {Step} from './step'


const jobSearchLengthMonthsOptions = [
  {name: "Je n'ai pas encore commencé", value: '-1'},
]
_.range(1, 19).forEach(monthsAgo => {
  jobSearchLengthMonthsOptions.push({name: `${monthsAgo} mois`, value: '' + monthsAgo})
})
jobSearchLengthMonthsOptions.push({name: 'Plus de 18 mois', value: '19'})


const weeklyOfferOptions = [
  {name: '0 ou 1 offre intéressante par semaine', value: 'LESS_THAN_2'},
  {name: '2 à 5 offres intéressantes par semaine', value: 'SOME'},
  {name: '6 à 15 offres intéressantes  par semaine', value: 'DECENT_AMOUNT'},
  {name: 'Plus de 15 offres intéressantes par semaine', value: 'A_LOT'},
]

const weeklyApplicationOptions = [
  {name: '0 ou 1 candidature par semaine', value: 'LESS_THAN_2'},
  {name: '2 à 5 candidatures par semaine', value: 'SOME'},
  {name: '6 à 15 candidatures par semaine', value: 'DECENT_AMOUNT'},
  {name: 'Plus de 15 candidatures par semaine', value: 'A_LOT'},
]

const interviewOptions = [
  {name: 'Aucun entretien', value: 'LESS_THAN_2'},
  {name: '1 entretien', value: 'SOME'},
  {name: '2 à 5 entretiens', value: 'DECENT_AMOUNT'},
  {name: 'Plus de 5 entretiens', value: 'A_LOT'},
]


class NewProjectJobsearchStep extends React.Component {
  static propTypes = {
    isShownDuringEdit: React.PropTypes.bool,
    newProject: React.PropTypes.object,
    onSubmit: React.PropTypes.func.isRequired,
  }

  componentWillMount() {
    const {jobSearchLengthMonths, weeklyOffersEstimate,
           weeklyApplicationsEstimate, totalInterviewsEstimate} = this.props.newProject
    this.setState({
      jobSearchLengthMonths,
      totalInterviewsEstimate,
      weeklyApplicationsEstimate,
      weeklyOffersEstimate,
    })
  }


  handleSubmit = () => {
    const {jobSearchLengthMonths, totalInterviewsEstimate,
           weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      this.props.onSubmit({
        jobSearchLengthMonths,
        totalInterviewsEstimate,
        weeklyApplicationsEstimate,
        weeklyOffersEstimate,
      })
    }
  }

  fastForward = () => {
    const {jobSearchLengthMonths, totalInterviewsEstimate,
           weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!jobSearchLengthMonths) {
      newState.jobSearchLengthMonths = '11'
    }
    if (!totalInterviewsEstimate) {
      newState.totalInterviewsEstimate = 'SOME'
    }
    if (!weeklyApplicationsEstimate) {
      newState.weeklyApplicationsEstimate = 'SOME'
    }
    if (!weeklyOffersEstimate) {
      newState.weeklyOffersEstimate = 'DECENT_AMOUNT'
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {jobSearchLengthMonths, totalInterviewsEstimate,
           weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    return !!(totalInterviewsEstimate && weeklyApplicationsEstimate &&
              weeklyOffersEstimate && jobSearchLengthMonths ||
              (jobSearchLengthMonths === -1))
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  render() {
    const {isValidated, jobSearchLengthMonths, totalInterviewsEstimate,
           weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    const interviewsLabel = <span>
      Combien d'entretiens d'embauche avez-vous obtenus
      <strong style={{fontWeight: 'bold'}}> depuis que vous cherchez
      ce métier</strong> ?
    </span>
    return <Step
        {...this.props} fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}
        nextButtonContent={this.props.isShownDuringEdit ? 'Sauvegarder' : 'Créer'}>
      <FieldSet
          label={`Depuis combien de temps avez-vous commencé à postuler à des offres pour
            ce métier ?`}
          isValid={!!jobSearchLengthMonths} isValidated={isValidated}>
        <Select options={jobSearchLengthMonthsOptions} value={jobSearchLengthMonths}
                onChange={value => this.setState(
                    {jobSearchLengthMonths: parseInt(value, 10) || 0})} />
      </FieldSet>
      <FieldSet
          label={`En moyenne, combien trouvez-vous de nouvelles offres qui vous conviennent
            par semaine ?`}
          isValid={!!weeklyOffersEstimate} isValidated={isValidated}
          disabled={jobSearchLengthMonths === -1}>
        <Select options={weeklyOfferOptions} value={weeklyOffersEstimate}
                onChange={this.handleChange('weeklyOffersEstimate')} />
      </FieldSet>
      <FieldSet
          label="En moyenne, combien de candidatures faites-vous par semaine ?"
          isValid={!!weeklyApplicationsEstimate} isValidated={isValidated}
          disabled={jobSearchLengthMonths === -1}>
        <Select options={weeklyApplicationOptions} value={weeklyApplicationsEstimate}
                onChange={this.handleChange('weeklyApplicationsEstimate')} />
      </FieldSet>
      <FieldSet
          label={interviewsLabel}
          isValid={!!totalInterviewsEstimate} isValidated={isValidated}
          disabled={jobSearchLengthMonths === -1}>
        <Select options={interviewOptions} value={totalInterviewsEstimate}
                onChange={this.handleChange('totalInterviewsEstimate')} />
      </FieldSet>
    </Step>
  }
}


export {NewProjectJobsearchStep}
