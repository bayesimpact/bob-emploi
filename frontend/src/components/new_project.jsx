import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import {CircularProgress} from 'components/progress'

import {closeNewProjectModalAction, createNewProject, CREATE_PROJECT_SAVE} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user_reducer'
import {genderizeJob} from 'store/job'
import {Modal} from 'components/modal'
import {Routes} from 'components/url'
import {NewProjectGoalStep} from './new_project/goal'
import {NewProjectCriteriaStep} from './new_project/criteria'
import {NewProjectExperienceStep} from './new_project/experience'
import {NewProjectJobsearchStep} from './new_project/jobsearch'

export const NEW_PROJECT_ID = 'nouveau'

const STEPS = [
  {component: NewProjectGoalStep},
  {component: NewProjectCriteriaStep},
  {component: NewProjectExperienceStep},
  {component: NewProjectJobsearchStep},
]


class NewProjectModalBase extends React.Component {
  static propTypes = {
    city: React.PropTypes.object,
    dispatch: React.PropTypes.func.isRequired,
    isCreatingProject: React.PropTypes.bool,
    isShown: React.PropTypes.bool.isRequired,
    restrictJobGroup: React.PropTypes.object,
    userProfile: USER_PROFILE_SHAPE,
  }

  state = {
    currentStep: 1,
  }

  handleClose = () => {
    this.setState({currentStep: 1, targetJob: null})
    this.props.dispatch(closeNewProjectModalAction)
  }

  handleSubmit = newProjectUpdates => {
    const {restrictJobGroup} = this.props
    const {currentStep} = this.state
    const isLastStep = currentStep === STEPS.length
    if (isLastStep) {
      this.setState(newProjectUpdates, () => {
        this.props.dispatch(createNewProject(this.state, {restrictJobGroup}))
        this.handleClose()
        browserHistory.push(Routes.PROJECT_PAGE + '/' + NEW_PROJECT_ID)
      })
    } else {
      this.setState({
        currentStep: currentStep + 1,
        ...newProjectUpdates,
      })
    }
  }

  handleBack = () => {
    const {currentStep} = this.state
    if (currentStep > 1) {
      this.setState({currentStep: currentStep - 1})
    }
  }

  componentWillReceiveProps(nextProps) {
    const {city, restrictJobGroup, userProfile} = nextProps
    if (restrictJobGroup !== this.props.restrictJobGroup &&
        restrictJobGroup && restrictJobGroup.jobs && restrictJobGroup.jobs.length) {
      // Select the first job in the list of restricted jobs.
      const job = restrictJobGroup.jobs[0]
      this.setState({
        previousJobSimilarity: 'DONE_SIMILAR',
        targetJob: job,
        targetJobName: job && genderizeJob(job, userProfile.gender) || '',
      })
    }
    if (nextProps.userProfile.situation === 'FIRST_TIME') {
      this.setState({previousJobSimilarity: 'NEVER_DONE'})
    }
    if (city !== this.props.city) {
      this.setState({city})
    }
  }

  state = {
    areaType: 'CITY',
    city: null,
    currentStep: 1,
    employmentTypes: ['CDI'],
    jobs: [],
    kind: 'FIND_JOB',
    minSalary: null,
    previousJobSimilarity: 'DONE_THIS',
    targetJob: null,
    workloads: ['FULL_TIME'],
  }

  render () {
    const {isCreatingProject, isShown, restrictJobGroup, userProfile} = this.props
    const {currentStep} = this.state
    const spinnerBoxStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 20,
    }
    const modalStyle = {
      display: 'flex',
      flexDirection: 'column',
      height: 700,
      width: 480,
    }
    const newProject = {...this.state}
    if (!newProject.city) {
      newProject.city = userProfile && userProfile.city
    }
    let content
    if (isCreatingProject) {
      content = <div style={spinnerBoxStyle}><CircularProgress /></div>
    } else if (!isShown) {
      content = null
    } else {
      const currentStepItem = STEPS[currentStep-1]
      const CurrentStepComponent = currentStepItem && currentStepItem.component
      const jobs = restrictJobGroup && restrictJobGroup.jobs || []
      content = <CurrentStepComponent
          onSubmit={this.handleSubmit}
          onPreviousButtonClick={currentStep > 1 ? this.handleBack : null}
          userProfile={userProfile}
          jobs={jobs} newProject={newProject}
          subheader={`Étape ${currentStep}/${STEPS.length}`}
          onClose={this.handleClose}
          style={{flex: 1}} />
    }
    return <Modal
        isShown={isShown} title="Créer un nouveau plan d'action"
        onClose={this.handleClose} style={modalStyle}>
      {content}
    </Modal>
  }
}
const NewProjectModal = connect(({app, asyncState, user}) => ({
  isCreatingProject: asyncState.isFetching[CREATE_PROJECT_SAVE],
  isShown: app.isNewProjectModalOpen,
  userProfile: user.profile,
  ...app.newProjectProps,
}))(NewProjectModalBase)


export {NewProjectModal}
