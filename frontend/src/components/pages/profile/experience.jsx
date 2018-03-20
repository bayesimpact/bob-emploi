import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {fetchProjectRequirements, GET_PROJECT_REQUIREMENTS, setUserProfile} from 'store/actions'
import {PROJECT_EXPERIENCE_OPTIONS, getTrainingFulfillmentEstimateOptions} from 'store/project'

import {FieldSet, RadioGroup, Select} from 'components/theme'
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

const drivingLicenseOptions = [
  {name: 'oui', value: 'TRUE'},
  {name: 'non', value: 'FALSE'},
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
    newProject: PropTypes.shape({
      city: PropTypes.shape({
        transportScore: PropTypes.number,
        urbanScore: PropTypes.number,
      }),
      targetJob: PropTypes.shape({
        codeOgr: PropTypes.string,
      }).isRequired,
    }).isRequired,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
      hasCarDrivingLicense: PropTypes.oneOf(drivingLicenseOptions.map(({value}) => value)),
    }).isRequired,
  }

  state = {
    hasCarDrivingLicense: this.props.profile && this.props.profile.hasCarDrivingLicense,
    ...this.props.newProject,
  }

  componentWillMount() {
    const {jobRequirements, newProject: {targetJob}} = this.props
    if (!jobRequirements[targetJob.codeOgr]) {
      this.props.dispatch(fetchProjectRequirements({targetJob}))
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isFetchingRequirements} = nextProps
    if (!isFetchingRequirements && !this.getRequiredDiplomaNames(nextProps).length) {
      this.setState({trainingFulfillmentEstimate: 'NO_TRAINING_REQUIRED'})
    }
  }

  handleSubmit = () => {
    const {dispatch, onSubmit} = this.props
    const {hasCarDrivingLicense, networkEstimate, previousJobSimilarity, seniority,
      trainingFulfillmentEstimate} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
    // TODO(cyrille): Refacto handling changes from profile and project at the same time.
      dispatch(setUserProfile({hasCarDrivingLicense}, true))
      onSubmit({
        networkEstimate,
        previousJobSimilarity,
        seniority,
        trainingFulfillmentEstimate,
      })
    }
  }

  fastForward = () => {
    const {trainingFulfillmentEstimate, networkEstimate, previousJobSimilarity,
      seniority, hasCarDrivingLicense} = this.state
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
    if (!seniority && isSeniorityRequired(newState.previousJobSimilarity)) {
      newState.seniority = pickRandomFromList(seniorityOptions).value
    }
    if (!trainingFulfillmentEstimate) {
      newState.trainingFulfillmentEstimate = pickRandomFromList(
        getTrainingFulfillmentEstimateOptions()).value
    }
    if (!networkEstimate) {
      newState.networkEstimate = Math.floor(Math.random() * 3) + 1
    }
    if (!hasCarDrivingLicense && this.isDrivingLicenseRequired()) {
      newState.hasCarDrivingLicense = Math.random() < .5 ? 'TRUE' : 'FALSE'
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {hasCarDrivingLicense, previousJobSimilarity, networkEstimate,
      trainingFulfillmentEstimate, seniority} = this.state
    return !!(
      previousJobSimilarity &&
      trainingFulfillmentEstimate &&
      (seniority || !isSeniorityRequired(previousJobSimilarity)) &&
      (hasCarDrivingLicense || !this.isDrivingLicenseRequired()) &&
      networkEstimate
    )
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  getRequirements = (props, requirementId) => {
    const {jobRequirements, newProject: {targetJob: {codeOgr}}} = props
    const requirements = jobRequirements[codeOgr] || {}
    return (requirements[requirementId] || [])
  }

  isDrivingLicenseRequired = () => {
    const {isFetchingRequirements, newProject: {city}} = this.props
    return isFetchingRequirements ||
      this.getRequirements(this.props, 'drivingLicenses').length ||
      // Keep this in sync with frontend/server/modules/driving_license.py _license_helps_mobility.
      (city && city.urbanScore <= 5 || city.publicTransportationScore <= 5)
  }

  getRequiredDiplomaNames = props => this.getRequirements(props, 'diplomas').map(({name}) => name)

  render() {
    const {gender} = this.props.profile
    const {isFetchingRequirements} = this.props
    const {hasCarDrivingLicense, previousJobSimilarity, seniority, isValidated,
      trainingFulfillmentEstimate, networkEstimate} = this.state
    const requiredDiplomaNames = this.getRequiredDiplomaNames(this.props)

    const networkLabel = <span>
      Avez-vous un bon réseau&nbsp;?
      Connaissez-vous des gens qui pourraient vous aider à obtenir ce métier&nbsp;?
    </span>
    // TODO(cyrille): Tutoie everywhere relevant.
    return <Step
      {...this.props} fastForward={this.fastForward}
      title="D'accord. Et si nous parlions de ce que vous avez déjà fait&nbsp;?"
      onNextButtonClick={this.handleSubmit}>
      <div>
        <FieldSet label="Avez-vous déjà fait ce métier&nbsp;?"
          isValid={!!previousJobSimilarity} isValidated={isValidated} hasCheck={true}>
          <Select options={PROJECT_EXPERIENCE_OPTIONS} value={previousJobSimilarity}
            placeholder="choisissez un type d'expérience"
            onChange={this.handleChange('previousJobSimilarity')} />
        </FieldSet>
        <FieldSet label="Quel est votre niveau d'expérience&nbsp;?"
          disabled={!isSeniorityRequired(previousJobSimilarity)}
          isValid={!!seniority} isValidated={isValidated}
          hasCheck={true}>
          <Select options={seniorityOptions} value={seniority}
            placeholder="choisissez un niveau d'expérience"
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
            isValid={!!trainingFulfillmentEstimate} isValidated={isValidated} hasCheck={true}>
            <Select
              options={getTrainingFulfillmentEstimateOptions(gender)}
              placeholder="choisissez une qualification"
              value={trainingFulfillmentEstimate}
              onChange={this.handleChange('trainingFulfillmentEstimate')} />
          </FieldSet>
        ) : null}
        {this.isDrivingLicenseRequired() ? (
          <FieldSet
            label="Avez-vous le permis de conduire&nbsp;?"
            style={{maxWidth: 600}}
            isValid={!!hasCarDrivingLicense}
            isValidated={isValidated} hasCheck={true}>
            <RadioGroup
              style={{justifyContent: 'space-around'}}
              onChange={this.handleChange('hasCarDrivingLicense')}
              options={drivingLicenseOptions}
              value={hasCarDrivingLicense} />
          </FieldSet>
        ) : null}
        <FieldSet label={networkLabel}
          isValid={!!networkEstimate}
          isValidated={isValidated}
          hasCheck={true}>
          <Select
            options={networkEstimateOptions}
            value={networkEstimate && networkEstimate.toString()}
            placeholder="choisissez une estimation de votre réseau"
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
