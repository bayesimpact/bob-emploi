import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'

import {editFirstProject, CREATE_PROJECT_SAVE} from 'store/actions'
import {flattenProject} from 'store/project'
import {youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {CircularProgress} from 'components/theme'
import {PageWithNavigationBar} from 'components/navigation'
import {Routes} from 'components/url'
import {getOnboardingStep, gotoNextStep, gotoPreviousStep,
  onboardingStepCount} from './profile/onboarding'


class NewProjectPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    existingProject: PropTypes.object,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
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

  state = {}

  static getDerivedStateFromProps({existingProject}) {
    // TODO(cyrille): Replace with memoization.
    return {newProject: flattenProject(existingProject || {})}
  }

  componentDidUpdate(prevProps) {
    if (prevProps.match.params.stepName === this.props.match.params.stepName) {
      return
    }
    this.pageDom && this.pageDom.scrollTo(0)
  }

  handleSubmit = () => {
    const {dispatch, history, match: {params: {stepName}}} = this.props
    const {type} = getOnboardingStep(Routes.NEW_PROJECT_PAGE, stepName)
    dispatch(editFirstProject(this.state.newProject, type))
    gotoNextStep(Routes.NEW_PROJECT_PAGE, stepName, dispatch, history)
  }

  handleBack = () => {
    const {history, match: {params: {stepName}}} = this.props
    // TODO(pascal): Save state when going back as well.
    gotoPreviousStep(Routes.NEW_PROJECT_PAGE, stepName, history)
  }

  render() {
    const {dispatch, existingProject, isCreatingProject, match, userProfile} = this.props
    // Prevent people from manually going back and creating another project.
    if (existingProject && !existingProject.isIncomplete) {
      return <Redirect to={`${Routes.PROJECT_PAGE}/{existingProject.projectId}`} />
    }
    const spinnerBoxStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      margin: '20px 0',
    }
    let content
    if (isCreatingProject) {
      content = <div style={spinnerBoxStyle}><CircularProgress /></div>
    } else {
      const {
        component: CurrentStepComponent,
        stepNumber,
      } = getOnboardingStep(Routes.NEW_PROJECT_PAGE, match.params.stepName)
      content = <CurrentStepComponent
        onSubmit={this.handleSubmit} dispatch={dispatch} profile={userProfile}
        onPreviousButtonClick={isMobileVersion ? null : this.handleBack}
        newProject={this.state.newProject} totalStepCount={onboardingStepCount}
        userYou={youForUser({profile: userProfile})} stepNumber={stepNumber} />
    }
    return <PageWithNavigationBar style={{backgroundColor: '#fff'}}
      onBackClick={isMobileVersion ? this.handleBack : null}
      page="new_project" ref={page => {
        this.page = page
      }}>
      <div>{content}</div>
    </PageWithNavigationBar>
  }
}
export default connect(({app, asyncState, user}) => ({
  existingProject: user.projects && user.projects.length && user.projects[0] || null,
  isCreatingProject: asyncState.isFetching[CREATE_PROJECT_SAVE],
  userProfile: user.profile,
  ...app.newProjectProps,
}))(withRouter(NewProjectPageBase))
