import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, diagnoseOnboarding, fetchProjectRequirements,
  GET_PROJECT_REQUIREMENTS, setUserProfile} from 'store/actions'
import {PROJECT_EXPERIENCE_OPTIONS, SENIORITY_OPTIONS,
  getTrainingFulfillmentEstimateOptions} from 'store/project'
import {userExample} from 'store/user'

import {FieldSet, RadioGroup, Select} from 'components/pages/connected/form_utils'

import {OnboardingComment, ProjectStepProps, Step} from './step'


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
function isSeniorityRequired(previousJobSimilarity): boolean {
  return previousJobSimilarity !== 'NEVER_DONE'
}


interface StepConnectedProps {
  isFetchingRequirements: boolean
  jobRequirements: bayes.bob.JobRequirements
}


interface StepProps extends StepConnectedProps, ProjectStepProps {
  dispatch: DispatchAllActions
}


interface StepState {
  isValidated?: boolean
  networkCommentRead?: boolean
  trainingFulfillmentEstimate?: bayes.bob.TrainingFulfillmentEstimate
  trainingCommentRead?: boolean
}


const getRequirements = (
  {jobRequirements, newProject: {targetJob}}: StepProps,
  requirementId: 'diplomas' | 'drivingLicenses'): bayes.bob.JobRequirement[] => {
  const {codeOgr = ''} = targetJob || {}
  const {[requirementId]: requirements = []} = jobRequirements[codeOgr] || {}
  return requirements
}

const isTrainingRequired = (props): boolean =>
  getRequirements(props, 'diplomas').length || props.isFetchingRequirements


class NewProjectExperienceStepBase extends React.PureComponent<StepProps, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
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
      }),
      trainingFulfillmentEstimate: PropTypes.string,
    }).isRequired,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
      hasCarDrivingLicense: PropTypes.oneOf(drivingLicenseOptions.map(({value}): string => value)),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state: StepState = {}

  public static getDerivedStateFromProps(
    nextProps: StepProps,
    {trainingFulfillmentEstimate: oldValue}: StepState): StepState {
    const {trainingFulfillmentEstimate = undefined} = nextProps.newProject || {}
    const newValue = trainingFulfillmentEstimate ||
      (!isTrainingRequired(nextProps) && 'NO_TRAINING_REQUIRED') || undefined
    if (oldValue === newValue) {
      return null
    }
    return {trainingFulfillmentEstimate: newValue}
  }

  public componentDidMount(): void {
    const {jobRequirements, newProject: {targetJob}} = this.props
    if (targetJob && jobRequirements && !jobRequirements[targetJob.codeOgr]) {
      this.props.dispatch(fetchProjectRequirements({targetJob}))
    }
  }

  public handleSubmit = (): void => {
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

  public fastForward = (): void => {
    const {
      newProject: {networkEstimate, previousJobSimilarity, seniority},
      profile: {hasCarDrivingLicense},
    } = this.props
    const {trainingFulfillmentEstimate} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!previousJobSimilarity) {
      projectDiff.previousJobSimilarity = userExample.projects[0].previousJobSimilarity
    }
    if (!seniority && isSeniorityRequired(projectDiff.previousJobSimilarity)) {
      projectDiff.seniority = userExample.projects[0].seniority
    }
    if (!trainingFulfillmentEstimate) {
      projectDiff.trainingFulfillmentEstimate = userExample.projects[0].trainingFulfillmentEstimate
    }
    if (!networkEstimate) {
      projectDiff.networkEstimate = userExample.projects[0].networkEstimate
    }

    const userDiff: {-readonly [K in keyof bayes.bob.User]?: bayes.bob.User[K]} = {}
    if (!hasCarDrivingLicense && this.isDrivingLicenseRequired()) {
      userDiff.profile = {hasCarDrivingLicense: userExample.profile.hasCarDrivingLicense}
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

  private isFormValid = (): boolean => {
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

  private handleChange = _memoize((field): ((value) => void) => (value): void => {
    const {dispatch, newProject: {seniority}} = this.props
    const userUpdate = field === 'hasCarDrivingLicense' ?
      {profile: {[field]: value}} : {projects: [{[field]: value}]}
    if (field === 'previousJobSimilarity' && value === 'NEVER_DONE' && seniority) {
      userUpdate['projects'][0]['seniority'] = 'UNKNOWN_PROJECT_SENIORITY'
    }
    dispatch(diagnoseOnboarding(userUpdate))

    const stateUpdate: StepState = {[field]: value}
    if (field === 'trainingFulfillmentEstimate') {
      stateUpdate.trainingCommentRead = false
    }
    if (field === 'networkEstimate') {
      stateUpdate.networkCommentRead = false
    }
    this.setState(stateUpdate)
  })

  private isDrivingLicenseRequired = (): boolean => {
    const {isFetchingRequirements, newProject: {city}} = this.props
    return isFetchingRequirements ||
      !!getRequirements(this.props, 'drivingLicenses').length ||
      // Keep this in sync with frontend/server/modules/driving_license.py _license_helps_mobility.
      !!(city && (city.urbanScore <= 5 || city.publicTransportationScore <= 5))
  }

  private handleCommentRead = _memoize((field: string): (() => void) =>
    (): void => this.setState({[`${field}CommentRead`]: true}))

  public render(): React.ReactNode {
    const {newProject: {previousJobSimilarity, seniority, networkEstimate}, profile: {gender,
      hasCarDrivingLicense}, userYou} = this.props
    const {isValidated, trainingCommentRead, trainingFulfillmentEstimate,
      networkCommentRead} = this.state
    const needSeniority = isSeniorityRequired(previousJobSimilarity)
    const needTraining = isTrainingRequired(this.props)
    const needLicense = this.isDrivingLicenseRequired()

    const networkLabel = <span>
      {userYou('As-tu', 'Avez-vous')} un bon réseau&nbsp;?
      Connais{userYou('-tu', 'sez-vous')} des gens qui
      pourraient {userYou("t'", 'vous ')}aider à trouver un poste&nbsp;?
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
      progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}>
      <div>
        <FieldSet label={`A${userYou('s-tu', 'vez-vous')} déjà fait ce métier\u00A0?`}
          isValid={!!previousJobSimilarity} isValidated={isValidated} hasCheck={true}>
          <Select
            options={PROJECT_EXPERIENCE_OPTIONS} value={previousJobSimilarity}
            placeholder={`choisis${userYou('', 'sez')} un type d'expérience`}
            onChange={this.handleChange('previousJobSimilarity')} />
        </FieldSet>
        {checks[0] && needSeniority ? <FieldSet
          label={`Quel est ${userYou('ton', 'votre')} niveau d'expérience dans ce métier\u00A0?`}
          isValid={!!seniority} isValidated={isValidated}
          hasCheck={true}>
          <Select options={SENIORITY_OPTIONS} value={seniority}
            placeholder={`choisis${userYou('', 'sez')} un niveau d'expérience`}
            onChange={this.handleChange('seniority')} />
        </FieldSet> : null}
        {checks.slice(0, 2).every((c): boolean => !!c) && needTraining ? <React.Fragment>
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
            onDone={this.handleCommentRead('training')}
            shouldShowAfter={!!trainingFulfillmentEstimate} />
        </React.Fragment> : null}
        {checks.slice(0, 3).every((c): boolean => !!c) && needLicense ? <FieldSet
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
        {checks.slice(0, 4).every((c): boolean => !!c) ? <React.Fragment>
          <FieldSet label={networkLabel}
            isValid={!!networkEstimate}
            isValidated={isValidated}
            hasNoteOrComment={true}
            hasCheck={true}>
            <Select<number>
              options={networkEstimateOptions}
              value={networkEstimate}
              placeholder={`choisis${userYou('', 'sez')} une estimation de ${userYou(
                'ton', 'votre')} réseau`}
              onChange={this.handleChange('networkEstimate')} />
          </FieldSet>
          <OnboardingComment field="NETWORK_FIELD" key={networkEstimate}
            onDone={this.handleCommentRead('network')}
            shouldShowAfter={!!networkEstimate} />
        </React.Fragment> : null}
      </div>
    </Step>
  }
}
const NewProjectExperienceStep = connect(
  ({app: {jobRequirements}, asyncState: {isFetching}}: RootState): StepConnectedProps => ({
    isFetchingRequirements: isFetching[GET_PROJECT_REQUIREMENTS],
    jobRequirements,
  }))(NewProjectExperienceStepBase)


export {NewProjectExperienceStep}
