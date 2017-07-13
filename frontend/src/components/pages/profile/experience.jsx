import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {fetchProjectRequirements, GET_PROJECT_REQUIREMENTS} from 'store/actions'
import {PROJECT_EXPERIENCE_OPTIONS, getTrainingFulfillmentEstimateOptions} from 'store/project'

import {FieldSet, Select} from 'components/theme'
import {Step} from './step'


const seniorityOptions = [
  {name: 'Stage', value: 'INTERNSHIP'},
  {name: 'Moins de 2 ans', value: 'JUNIOR'},
  {name: '2 à 5 ans', value: 'INTERMEDIARY'},
  {name: '6 à 10 ans', value: 'SENIOR'},
  {name: 'Plus de 10 ans', value: 'EXPERT'},
]

const networkEstimateOptions = [
  {name: "J'ai de très bons contacts", value: '3'},
  {name: "J'ai quelques personnes en tête", value: '2'},
  {name: 'Je ne pense pas', value: '1'},
]

// TODO: Move to store.
function isSeniorityRequired(previousJobSimilarity) {
  return previousJobSimilarity !== 'NEVER_DONE'
}

class NewProjectExperienceStepBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func,
    isFetchingRequirements: PropTypes.bool,
    jobRequirements: PropTypes.object,
    newProject: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }),
  }

  componentWillMount() {
    const {jobRequirements, newProject} = this.props
    this.setState({...newProject})
    if (!jobRequirements[newProject.targetJob.codeOgr]) {
      this.props.dispatch(fetchProjectRequirements({
        targetJob: newProject.targetJob,
      }))
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isFetchingRequirements} = nextProps
    if (!isFetchingRequirements && !this.getRequiredDiplomaNames().length) {
      this.setState({trainingFulfillmentEstimate: 'NO_TRAINING_REQUIRED'})
    }
  }

  handleSubmit = () => {
    const {networkEstimate, previousJobSimilarity, seniority,
      trainingFulfillmentEstimate} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      this.props.onSubmit({
        networkEstimate,
        previousJobSimilarity,
        seniority,
        trainingFulfillmentEstimate,
      })
    }
  }

  fastForward = () => {
    const {trainingFulfillmentEstimate, networkEstimate, previousJobSimilarity,
      seniority} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    const pickRandomFromList = list => {
      return list[Math.floor(Math.random() * list.length)]
    }
    if (!previousJobSimilarity) {
      newState.previousJobSimilarity = pickRandomFromList(PROJECT_EXPERIENCE_OPTIONS).value
    }
    if (!seniority && isSeniorityRequired(previousJobSimilarity)) {
      newState.seniority = pickRandomFromList(seniorityOptions).value
    }
    if (!trainingFulfillmentEstimate) {
      newState.trainingFulfillmentEstimate = pickRandomFromList(
        getTrainingFulfillmentEstimateOptions()).value
    }
    if (!networkEstimate) {
      newState.networkEstimate = Math.floor(Math.random() * 3) + 1
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {previousJobSimilarity, networkEstimate, trainingFulfillmentEstimate,
      seniority} = this.state
    return !!(previousJobSimilarity && trainingFulfillmentEstimate &&
              (seniority || !isSeniorityRequired(previousJobSimilarity)) &&
              networkEstimate)
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  getRequiredDiplomaNames = () => {
    const {jobRequirements, newProject} = this.props
    const requirements = jobRequirements[newProject.targetJob.codeOgr] || {}
    return (requirements.diplomas || []).map(diploma => diploma.name)
  }

  render() {
    const {gender} = this.props.profile
    const {isFetchingRequirements} = this.props
    const {previousJobSimilarity, seniority, isValidated,
      trainingFulfillmentEstimate, networkEstimate} = this.state
    const requiredDiplomaNames = this.getRequiredDiplomaNames()

    const networkLabel = <span>
      Avez-vous un bon réseau&nbsp;?
      Connaissez-vous des gens qui pourraient vous aider à obtenir ce métier&nbsp;?
    </span>
    return <Step
      {...this.props} fastForward={this.fastForward}
      title="Comment vous placez-vous sur votre marché ?"
      onNextButtonClick={this.handleSubmit}>
      <div>
        <FieldSet label="Avez-vous déjà fait ce métier&nbsp;?"
          isValid={!!previousJobSimilarity} isValidated={isValidated}>
          <Select options={PROJECT_EXPERIENCE_OPTIONS} value={previousJobSimilarity}
            onChange={this.handleChange('previousJobSimilarity')} />
        </FieldSet>
        <FieldSet label="Quel est votre niveau d'expérience&nbsp;?"
          disabled={!isSeniorityRequired(previousJobSimilarity)}
          isValid={!!seniority} isValidated={isValidated}>
          <Select options={seniorityOptions} value={seniority}
            onChange={this.handleChange('seniority')} />
        </FieldSet>
        {requiredDiplomaNames.length || isFetchingRequirements ? (
          <FieldSet
            label={<span>
              Pensez-vous avoir les diplômes requis pour ce métier&nbsp;?
              {requiredDiplomaNames.length ? <span> Les
                offres demandent souvent un {requiredDiplomaNames.join(', ')} ou équivalent.
              </span> : null}
            </span>}
            style={{maxWidth: 600}}
            isValid={!!trainingFulfillmentEstimate} isValidated={isValidated}>
            <Select
              options={getTrainingFulfillmentEstimateOptions(gender)}
              value={trainingFulfillmentEstimate}
              onChange={this.handleChange('trainingFulfillmentEstimate')} />
          </FieldSet>
        ) : null}
        <FieldSet label={networkLabel} isValid={!!networkEstimate} isValidated={isValidated}>
          <Select
            options={networkEstimateOptions}
            value={networkEstimate && networkEstimate.toString()}
            onChange={this.handleChange('networkEstimate')} />
        </FieldSet>
      </div>
    </Step>
  }
}
const NewProjectExperienceStep = connect(({app, asyncState}) => ({
  isFetchingRequirements: asyncState.isFetching[GET_PROJECT_REQUIREMENTS],
  jobRequirements: app.jobRequirements,
}))(NewProjectExperienceStepBase)


export {NewProjectExperienceStep}
