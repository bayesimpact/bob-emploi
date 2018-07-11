import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {diagnoseOnboarding, fetchProjectRequirements, GET_PROJECT_REQUIREMENTS,
  setUserProfile} from 'store/actions'
import {PROJECT_EXPERIENCE_OPTIONS, getTrainingFulfillmentEstimateOptions} from 'store/project'

import {FieldSet, RadioGroup, Select} from 'components/pages/connected/form_utils'

import {OnboardingComment, Step} from './step'


const seniorityOptions = [
  {name: 'Stage', value: 'INTERNSHIP'},
  {name: 'Moins de 2 ans', value: 'JUNIOR'},
  {name: '2 à 5 ans', value: 'INTERMEDIARY'},
  {name: '6 à 10 ans', value: 'SENIOR'},
  {name: 'Plus de 10 ans', value: 'EXPERT'},
]

const networkEstimateOptions = [
  {name: "J'ai de très bons contacts", value: 3},
  {name: "J'ai quelques personnes en tête", value: 2},
  {name: 'Je ne pense pas', value: 1},
]

const drivingLicenseOptions = [
  {name: 'oui', value: 'TRUE'},
  {name: 'non', value: 'FALSE'},
]

// TODO: Move to store.
function isSeniorityRequired(previousJobSimilarity) {
  return previousJobSimilarity !== 'NEVER_DONE'
}

const getRequirements = ({jobRequirements, newProject: {targetJob: {codeOgr}}}, requirementId) => {
  const {[requirementId]: requirements = []} = jobRequirements[codeOgr] || {}
  return requirements
}

const isTrainingRequired = props =>
  getRequirements(props, 'diplomas').length || props.isFetchingRequirements


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
      networkEstimate: PropTypes.number,
      previousJobSimilarity: PropTypes.string,
      seniority: PropTypes.string,
      targetJob: PropTypes.shape({
        codeOgr: PropTypes.string,
      }).isRequired,
      trainingFulfillmentEstimate: PropTypes.string,
    }).isRequired,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
      hasCarDrivingLicense: PropTypes.oneOf(drivingLicenseOptions.map(({value}) => value)),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  static getDerivedStateFromProps(nextProps, {trainingFulfillmentEstimate: oldValue}) {
    const {trainingFulfillmentEstimate} = nextProps.newProject || {}
    const newValue = trainingFulfillmentEstimate ||
      (!isTrainingRequired(nextProps) && 'NO_TRAINING_REQUIRED') || ''
    if (oldValue === newValue) {
      return null
    }
    return {trainingFulfillmentEstimate: newValue}
  }

  componentDidMount() {
    const {jobRequirements, newProject: {targetJob}} = this.props
    if (!jobRequirements[targetJob.codeOgr]) {
      this.props.dispatch(fetchProjectRequirements({targetJob}))
    }
  }

  handleSubmit = () => {
    const {dispatch, newProject: {networkEstimate, previousJobSimilarity, seniority},
      profile: {hasCarDrivingLicense}, onSubmit} = this.props
    const {trainingFulfillmentEstimate} = this.state
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
    const {newProject: {networkEstimate, previousJobSimilarity, seniority},
      profile: {hasCarDrivingLicense}} = this.props
    const {trainingFulfillmentEstimate} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff = {}
    const pickRandomFromList = list => {
      return list[Math.floor(Math.random() * list.length)]
    }
    if (!previousJobSimilarity) {
      projectDiff.previousJobSimilarity = pickRandomFromList(PROJECT_EXPERIENCE_OPTIONS).value
    }
    if (!seniority && isSeniorityRequired(projectDiff.previousJobSimilarity)) {
      projectDiff.seniority = pickRandomFromList(seniorityOptions).value
    }
    if (!trainingFulfillmentEstimate) {
      projectDiff.trainingFulfillmentEstimate = pickRandomFromList(
        getTrainingFulfillmentEstimateOptions()).value
    }
    if (!networkEstimate) {
      projectDiff.networkEstimate = Math.floor(Math.random() * 3) + 1
    }

    const userDiff = {}
    if (!hasCarDrivingLicense && this.isDrivingLicenseRequired()) {
      userDiff.profile = {hasCarDrivingLicense: Math.random() < .5 ? 'TRUE' : 'FALSE'}
    }
    if (Object.keys(projectDiff).length) {
      userDiff.projects = [projectDiff]
    }
    this.props.dispatch(diagnoseOnboarding(userDiff))

    this.setState({
      networkCommentRead: true,
      trainingCommentRead: true,
    })
  }

  isFormValid = () => {
    const {
      newProject: {previousJobSimilarity, networkEstimate, seniority},
      profile: {hasCarDrivingLicense},
    } = this.props
    const {trainingFulfillmentEstimate} = this.state
    return !!(
      previousJobSimilarity &&
      trainingFulfillmentEstimate &&
      (seniority || !isSeniorityRequired(previousJobSimilarity)) &&
      (hasCarDrivingLicense || !this.isDrivingLicenseRequired()) &&
      networkEstimate
    )
  }

  handleChange = field => value => {
    const userUpdate = field === 'hasCarDrivingLicense' ?
      {profile: {[field]: value}} : {projects: [{[field]: value}]}
    this.props.dispatch(diagnoseOnboarding(userUpdate))

    const stateUpdate = {[field]: value}
    if (field === 'trainingFulfillmentEstimate') {
      stateUpdate.trainingCommentRead = false
    }
    if (field === 'networkEstimate') {
      stateUpdate.networkCommentRead = false
    }
    this.setState(stateUpdate)
  }

  isDrivingLicenseRequired = () => {
    const {isFetchingRequirements, newProject: {city}} = this.props
    return isFetchingRequirements ||
      getRequirements(this.props, 'drivingLicenses').length ||
      // Keep this in sync with frontend/server/modules/driving_license.py _license_helps_mobility.
      (city && city.urbanScore <= 5 || city.publicTransportationScore <= 5)
  }

  render() {
    const {newProject: {previousJobSimilarity, seniority, networkEstimate}, profile: {gender,
      hasCarDrivingLicense}, userYou} = this.props
    const {isValidated, trainingCommentRead, trainingFulfillmentEstimate,
      networkCommentRead} = this.state
    const needSeniority = isSeniorityRequired(previousJobSimilarity)
    const needTraining = isTrainingRequired(this.props)
    const needLicense = this.isDrivingLicenseRequired()

    const networkLabel = <span>
      Avez-vous un bon réseau&nbsp;?
      Connaissez-vous des gens qui pourraient vous aider&nbsp;?
    </span>
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      previousJobSimilarity,
      seniority || !needSeniority,
      (trainingFulfillmentEstimate && trainingCommentRead) || !needTraining,
      hasCarDrivingLicense || !needLicense,
      networkEstimate && networkCommentRead,
    ]
    // TODO(cyrille): Tutoie everywhere relevant.
    return <Step
      {...this.props} fastForward={this.fastForward}
      title={`${userYou('Ton', 'Votre')} expérience`}
      progressInStep={checks.filter(c => c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}>
      <div>
        <FieldSet label={`A${userYou('s-tu', 'vez-vous')} déjà fait ce métier\u00A0?`}
          isValid={!!previousJobSimilarity} isValidated={isValidated} hasCheck={true}>
          <Select options={PROJECT_EXPERIENCE_OPTIONS} value={previousJobSimilarity}
            placeholder={`choisis${userYou('', 'sez')} un type d'expérience`}
            onChange={this.handleChange('previousJobSimilarity')} />
        </FieldSet>
        {checks[0] && needSeniority ? <FieldSet
          label={`Quel est ${userYou('ton', 'votre')} niveau d'expérience\u00A0?`}
          isValid={!!seniority} isValidated={isValidated}
          hasCheck={true}>
          <Select options={seniorityOptions} value={seniority}
            placeholder={`choisis${userYou('', 'sez')} un niveau d'expérience`}
            onChange={this.handleChange('seniority')} />
        </FieldSet> : null}
        {checks.slice(0, 2).every(c => c) && needTraining ? <React.Fragment>
          <FieldSet
            label={`Pense${userYou(
              's-tu', 'z-vous')} avoir les diplômes requis pour ce métier\u00A0?`}
            hasNoteOrComment={true}
            style={{maxWidth: 600}}
            isValid={!!trainingFulfillmentEstimate} isValidated={isValidated}
            hasCheck={true}>
            <Select
              options={getTrainingFulfillmentEstimateOptions(gender)}
              placeholder={`choisis${userYou('', 'sez')} une qualification`}
              value={trainingFulfillmentEstimate}
              onChange={this.handleChange('trainingFulfillmentEstimate')} />
          </FieldSet>
          <OnboardingComment
            field="REQUESTED_DIPLOMA_FIELD" key={trainingFulfillmentEstimate}
            onDone={() => this.setState({trainingCommentRead: true})}
            shouldShowAfter={!!trainingFulfillmentEstimate} />
        </React.Fragment> : null}
        {checks.slice(0, 3).every(c => c) && needLicense ? <FieldSet
          label={`A${userYou('s-tu', 'vez-vous')} le permis de conduire\u00A0?`}
          style={{maxWidth: 600}}
          isValid={!!hasCarDrivingLicense}
          isValidated={isValidated} hasCheck={true}>
          <RadioGroup
            style={{justifyContent: 'space-around'}}
            onChange={this.handleChange('hasCarDrivingLicense')}
            options={drivingLicenseOptions}
            value={hasCarDrivingLicense} />
        </FieldSet> : null}
        {checks.slice(0, 4).every(c => c) ? <React.Fragment>
          <FieldSet label={networkLabel}
            isValid={!!networkEstimate}
            isValidated={isValidated}
            hasNoteOrComment={true}
            hasCheck={true}>
            <Select
              options={networkEstimateOptions}
              value={networkEstimate}
              placeholder={`choisis${userYou('', 'sez')} une estimation de ${userYou(
                'ton', 'votre')} réseau`}
              onChange={this.handleChange('networkEstimate')} />
          </FieldSet>
          <OnboardingComment field="NETWORK_FIELD" key={networkEstimate}
            onDone={() => this.setState({networkCommentRead: true})}
            shouldShowAfter={!!networkEstimate} />
        </React.Fragment> : null}
      </div>
    </Step>
  }
}
const NewProjectExperienceStep = connect(({app: {jobRequirements}, asyncState: {isFetching}}) => ({
  isFetchingRequirements: isFetching[GET_PROJECT_REQUIREMENTS],
  jobRequirements,
}))(NewProjectExperienceStepBase)


export {NewProjectExperienceStep}
