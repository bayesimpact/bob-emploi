import React from 'react'
import {connect} from 'react-redux'

import {FieldSet, Select} from 'components/theme'
import {Step} from './step'
import {fetchProjectRequirements, GET_PROJECT_REQUIREMENTS} from 'store/actions'


const previousJobSimilarityOptions = [
  {name: "Oui, j'ai déjà fait ce métier", value: 'DONE_THIS'},
  {name: "J'ai fait un métier similaire", value: 'DONE_SIMILAR'},
  {name: 'Non, ce métier est nouveau pour moi', value: 'NEVER_DONE'},
]

const seniorityOptions = [
  {name: 'Stage seulement', value: 'INTERNSHIP'},
  {name: 'Moins de 2 ans', value: 'JUNIOR'},
  {name: '2-5 ans', value: 'INTERMEDIARY'},
  {name: '6-10 ans', value: 'SENIOR'},
  {name: 'Plus de 10 ans', value: 'EXPERT'},
]

const getDiplomaFulfillmentEstimateOptions = gender => {
  const genderE = gender === 'FEMININE' ? 'e' : ''
  return [
    {name: "Oui, j'ai des diplômes suffisants", value: 'FULFILLED'},
    {name: "Non, je n'ai pas les diplômes suffisants", value: 'NOT_FULFILLED'},
    {name: `Je ne suis pas sûr${genderE}`, value: 'FULFILLMENT_NOT_SURE'},
  ]
}

const networkEstimateOptions = [
  {name: "J'ai de très bons contacts", value: '3'},
  {name: "J'ai quelques personnes en tête", value: '2'},
  {name: 'Je ne connais personne', value: '1'},
]

// TODO: Move to store.
function isSeniorityRequired(previousJobSimilarity) {
  return previousJobSimilarity !== 'NEVER_DONE'
}

class NewProjectExperienceStepBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func,
    isFetchingRequirements: React.PropTypes.bool,
    jobRequirements: React.PropTypes.object,
    newProject: React.PropTypes.object,
    onSubmit: React.PropTypes.func.isRequired,
    profile: React.PropTypes.shape({
      gender: React.PropTypes.string,
    }),
  }

  handleSubmit = () => {
    const {networkEstimate, previousJobSimilarity, seniority,
           diplomaFulfillmentEstimate} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      this.props.onSubmit({
        diplomaFulfillmentEstimate,
        networkEstimate,
        previousJobSimilarity,
        seniority,
      })
    }
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

  fastForward = () => {
    const {diplomaFulfillmentEstimate, networkEstimate, previousJobSimilarity,
           seniority} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!previousJobSimilarity) {
      newState.previousJobSimilarity = 'DONE_THIS'
    }
    if (!seniority && isSeniorityRequired(previousJobSimilarity)) {
      newState.seniority = 'EXPERT'
    }
    if (!diplomaFulfillmentEstimate) {
      newState.diplomaFulfillmentEstimate = 'FULFILLED'
    }
    if (!networkEstimate) {
      newState.networkEstimate = 3
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {previousJobSimilarity, networkEstimate, diplomaFulfillmentEstimate,
           seniority} = this.state
    return !!(previousJobSimilarity && diplomaFulfillmentEstimate &&
              (seniority || !isSeniorityRequired(previousJobSimilarity)) &&
              networkEstimate)
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  componentWillReceiveProps(nextProps) {
    const {isFetchingRequirements} = nextProps
    if (!isFetchingRequirements && !this.getRequiredDiplomaNames().length) {
      this.setState({diplomaFulfillmentEstimate: 'NOTHING_REQUIRED'})
    }
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
           diplomaFulfillmentEstimate, networkEstimate} = this.state
    const requiredDiplomaNames = this.getRequiredDiplomaNames()

    const networkLabel = <span>
      Avez-vous un bon réseau&nbsp;?
      Connaissez-vous des gens qui pourraient vous aider à obtenir ce métier&nbsp;?
    </span>
    return <Step {...this.props} fastForward={this.fastForward}
                      onNextButtonClick={this.handleSubmit}>
      <div>
        <FieldSet label="Avez-vous déjà fait ce métier&nbsp;?"
                  isValid={!!previousJobSimilarity} isValidated={isValidated}>
          <Select options={previousJobSimilarityOptions} value={previousJobSimilarity}
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
            isValid={!!diplomaFulfillmentEstimate} isValidated={isValidated}>
            <Select
                options={getDiplomaFulfillmentEstimateOptions(gender)}
                value={diplomaFulfillmentEstimate}
                onChange={this.handleChange('diplomaFulfillmentEstimate')} />
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
