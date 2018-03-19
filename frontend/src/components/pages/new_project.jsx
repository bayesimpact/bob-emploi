import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {CircularProgress} from 'components/theme'
import {PageWithNavigationBar} from 'components/navigation'
import {editFirstProject, CREATE_PROJECT_SAVE} from 'store/actions'
import {Routes} from 'components/url'
import {getOnboardingStep, gotoNextStep, gotoPreviousStep,
  onboardingStepCount} from './profile/onboarding'


class NewProjectPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    existingProject: PropTypes.object,
    isCreatingProject: PropTypes.bool,
    match: PropTypes.shape({
      params: PropTypes.shape({
        stepName: PropTypes.string,
      }).isRequired,
    }).isRequired,
    userProfile: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool.isRequired,
  }

  componentWillMount() {
    const {existingProject} = this.props
    const {mobility, ...overrideState} = existingProject || {}
    this.setState({
      areaType: mobility && mobility.areaType,
      city: mobility && mobility.city || null,
      employmentTypes: ['CDI'],
      isIncomplete: true,
      kind: null,
      minSalary: null,
      passionateLevel: null,
      previousJobSimilarity: null,
      targetJob: null,
      workloads: ['FULL_TIME'],
      ...overrideState,
    })
    // Prevent people from manually going back and creating another project.
    if (existingProject && !existingProject.isIncomplete) {
      this.context.history.push(Routes.PROJECT_PAGE + '/' + existingProject.projectId)
      return
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.match.params.stepName === this.props.match.params.stepName) {
      return
    }
    this.pageDom && this.pageDom.scrollTo(0)
  }

  handleSubmit = newProjectUpdates => {
    const {dispatch, match} = this.props
    const {type} = getOnboardingStep(Routes.NEW_PROJECT_PAGE, match.params.stepName)
    this.setState(newProjectUpdates, () => {
      dispatch(editFirstProject(this.state, type))
      gotoNextStep(Routes.NEW_PROJECT_PAGE, match.params.stepName, dispatch, this.context.history)
    })
  }

  handleBack = () => {
    const {stepName} = this.props.match.params
    // TODO(pascal): Save state when going back as well.
    gotoPreviousStep(Routes.NEW_PROJECT_PAGE, stepName, this.context.history)
  }

  render() {
    const {isCreatingProject, match, userProfile} = this.props
    const {isMobileVersion} = this.context
    const spinnerBoxStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      margin: '20px 0',
    }
    const newProject = {...this.state}
    let content
    if (isCreatingProject) {
      content = <div style={spinnerBoxStyle}><CircularProgress /></div>
    } else {
      const {
        component: CurrentStepComponent,
        stepNumber,
      } = getOnboardingStep(Routes.NEW_PROJECT_PAGE, match.params.stepName)
      content = <CurrentStepComponent
        onSubmit={this.handleSubmit}
        onPreviousButtonClick={isMobileVersion ? null : this.handleBack}
        profile={userProfile} newProject={newProject}
        stepNumber={stepNumber} totalStepCount={onboardingStepCount} />
    }
    return <PageWithNavigationBar style={{backgroundColor: '#fff'}}
      onBackClick={isMobileVersion ? this.handleBack : null}
      page="new_project" isContentScrollable={true} ref={page => {
        this.page = page
      }}>
      <div>{content}</div>
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
