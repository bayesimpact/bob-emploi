import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import {CircularProgress} from 'components/progress'

import {Colors} from 'components/theme'
import {PageWithNavigationBar} from 'components/navigation'
import {createFirstProject, editFirstProject, CREATE_PROJECT_SAVE,
        } from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user_reducer'
import {Routes} from 'components/url'
import {PROJECT_ONBOARDING_STEPS, onboardingStepCount} from './profile/onboarding'

export const NEW_PROJECT_ID = 'nouveau'

const STEPS = PROJECT_ONBOARDING_STEPS


class NewProjectPageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    existingProject: React.PropTypes.object,
    isCreatingProject: React.PropTypes.bool,
    userProfile: USER_PROFILE_SHAPE,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
  }

  componentWillMount() {
    const {existingProject} = this.props
    this.setState({
      areaType: 'CITY',
      city: null,
      currentStep: 1,
      employmentTypes: ['CDI'],
      isIncomplete: true,
      kind: 'FIND_JOB',
      minSalary: null,
      previousJobSimilarity: 'DONE_THIS',
      targetJob: null,
      workloads: ['FULL_TIME'],
      ...existingProject,
    })
    // Prevent people from manually going back and creating another project.
    if (existingProject && !existingProject.isIncomplete) {
      browserHistory.push(Routes.PROJECT_PAGE + '/' + existingProject.projectId)
      return
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.currentStep !== prevState.currentStep) {
      this.refs.page.scrollTo(0)
    }
  }

  handleSubmit = newProjectUpdates => {
    const {currentStep} = this.state
    const isLastStep = currentStep === STEPS.length
    if (isLastStep) {
      this.setState(newProjectUpdates, () => {
        this.props.dispatch(createFirstProject(this.state))
        browserHistory.push(Routes.PROJECT_PAGE + '/' + NEW_PROJECT_ID)
      })
    } else {
      const currentStepItem = STEPS[currentStep-1]
      this.setState({
        currentStep: currentStep + 1,
        ...newProjectUpdates,
      }, () => {
        this.props.dispatch(editFirstProject(this.state, currentStepItem.type))
      })
    }
  }

  handleBack = () => {
    const {currentStep} = this.state
    if (currentStep > 1) {
      this.setState({currentStep: currentStep - 1})
    }
  }

  render() {
    const {isCreatingProject, userProfile} = this.props
    const {isMobileVersion} = this.context
    const {currentStep} = this.state
    const spinnerBoxStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 20,
    }
    const style = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      paddingBottom: isMobileVersion ? 0 : 70,
      paddingTop: isMobileVersion ? 0 : 70,
    }
    const newProject = {...this.state}
    let content
    if (isCreatingProject) {
      content = <div style={spinnerBoxStyle}><CircularProgress /></div>
    } else {
      const currentStepItem = STEPS[currentStep-1]
      const CurrentStepComponent = currentStepItem && currentStepItem.component
      content = <CurrentStepComponent
          onSubmit={this.handleSubmit} onBack={currentStep > 1 ? this.handleBack : null}
          profile={userProfile} newProject={newProject}
          stepNumber={currentStepItem.stepNumber} totalStepCount={onboardingStepCount} />
    }
    return <PageWithNavigationBar
        style={{backgroundColor: Colors.BACKGROUND_GREY}}
        page="new_project" isContentScrollable={true} ref="page">
      <div style={style}>
        {content}
      </div>
    </PageWithNavigationBar>
  }
}
const NewProjectPage = connect(({app, asyncState, user}) => ({
  existingProject: user.projects && user.projects.length && user.projects[0] || null,
  isCreatingProject: asyncState.isFetching[CREATE_PROJECT_SAVE],
  userProfile: user.profile,
  ...app.newProjectProps,
}))(NewProjectPageBase)


export {NewProjectPage}
