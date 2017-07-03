import React from 'react'
import PropTypes from 'prop-types'
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


class NewProjectJobsearchStep extends React.Component {
  static propTypes = {
    newProject: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
  }

  componentWillMount() {
    const {jobSearchLengthMonths, weeklyOffersEstimate,
      weeklyApplicationsEstimate, totalInterviewCount} = this.props.newProject
    this.setState({
      jobSearchLengthMonths,
      totalInterviewCount,
      weeklyApplicationsEstimate,
      weeklyOffersEstimate,
    })
  }


  handleSubmit = () => {
    const {jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
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
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!jobSearchLengthMonths) {
      newState.jobSearchLengthMonths = '11'
    }
    if (!totalInterviewCount) {
      newState.totalInterviewCount = Math.floor(Math.random() * 22) || -1
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
    const {jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    return !!(totalInterviewCount && weeklyApplicationsEstimate &&
              weeklyOffersEstimate && jobSearchLengthMonths ||
              (jobSearchLengthMonths === -1))
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  render() {
    const {isValidated, jobSearchLengthMonths, totalInterviewCount,
      weeklyApplicationsEstimate, weeklyOffersEstimate} = this.state
    const interviewsLabel = <span>
      Combien d'entretiens d'embauche avez-vous obtenus
      <strong style={{fontWeight: 'bold'}}> depuis que vous cherchez
      ce métier</strong> ?
    </span>
    return <Step
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.handleSubmit}
      title="Où en êtes-vous dans votre recherche ?">
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
        isValid={!!totalInterviewCount} isValidated={isValidated}
        disabled={jobSearchLengthMonths === -1}>
        <Select
          onChange={value => this.handleChange('totalInterviewCount')(parseInt(value, 10))}
          value={totalInterviewCount}
          options={[{name: "Aucun pour l'instant", value: -1}].
            concat(new Array(20).fill().map((unused, index) => ({
              name: (index + 1) + '',
              value: index + 1,
            }))).
            concat([{name: 'Plus de 20', value: 21}])} />
      </FieldSet>
    </Step>
  }
}


export {NewProjectJobsearchStep}
