
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, editFirstProject, CREATE_PROJECT_SAVE} from 'store/actions'
import {flattenProject} from 'store/project'
import {youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {CircularProgress} from 'components/theme'
import {PageWithNavigationBar} from 'components/navigation'
import {Routes} from 'components/url'
import {getProjectOnboardingStep, gotoNextStep, gotoPreviousStep,
  onboardingStepCount} from './profile/onboarding'


interface PageConnectedProps {
  existingProject: bayes.bob.Project
  isCreatingProject: boolean
  userProfile: bayes.bob.UserProfile
}


interface PageProps extends PageConnectedProps, RouteComponentProps<{stepName?: string}> {
  dispatch: DispatchAllActions
}


interface PageState {
  newProject?: bayes.bob.Project
}


class NewProjectPageBase extends React.PureComponent<PageProps, PageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    existingProject: PropTypes.object,
    history: ReactRouterPropTypes.history.isRequired,
    isCreatingProject: PropTypes.bool,
    match: ReactRouterPropTypes.match.isRequired,
    userProfile: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }

  public state: PageState = {}

  public static getDerivedStateFromProps({existingProject}): PageState {
    // TODO(cyrille): Replace with memoization.
    return {newProject: flattenProject(existingProject || {})}
  }

  public componentDidUpdate(prevProps: PageProps): void {
    if (prevProps.match.params.stepName === this.props.match.params.stepName) {
      return
    }
    this.pageDom.current && this.pageDom.current.scrollTo(0)
  }

  private pageDom: React.RefObject<PageWithNavigationBar> = React.createRef()

  private handleSubmit = (): void => {
    const {dispatch, history, match: {params: {stepName}}} = this.props
    const {type} = getProjectOnboardingStep(stepName)
    dispatch(editFirstProject(this.state.newProject, type))
    gotoNextStep(Routes.NEW_PROJECT_PAGE, stepName, dispatch, history)
  }

  private handleBack = (): void => {
    const {history, match: {params: {stepName}}} = this.props
    // TODO(pascal): Save state when going back as well.
    gotoPreviousStep(Routes.NEW_PROJECT_PAGE, stepName, history)
  }

  public render(): React.ReactNode {
    const {existingProject, isCreatingProject, match, userProfile} = this.props
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
        component: StepComponent,
        stepNumber,
      } = getProjectOnboardingStep(match.params.stepName)
      content = <StepComponent
        onSubmit={this.handleSubmit} profile={userProfile}
        onPreviousButtonClick={isMobileVersion ? null : this.handleBack}
        newProject={this.state.newProject} totalStepCount={onboardingStepCount}
        userYou={youForUser({profile: userProfile})} stepNumber={stepNumber} />
    }
    return <PageWithNavigationBar style={{backgroundColor: '#fff'}}
      onBackClick={isMobileVersion ? this.handleBack : null}
      page="new_project" ref={this.pageDom}>
      <div>{content}</div>
    </PageWithNavigationBar>
  }
}
export default connect(({app, asyncState, user}: RootState): PageConnectedProps => ({
  existingProject: user.projects && user.projects.length && user.projects[0] || null,
  isCreatingProject: asyncState.isFetching[CREATE_PROJECT_SAVE],
  userProfile: user.profile,
  ...app.newProjectProps,
}))(withRouter(NewProjectPageBase))
