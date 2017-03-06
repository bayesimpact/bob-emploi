import React from 'react'
import {browserHistory} from 'react-router'

import {advisorEngagementActionIsShown} from 'store/actions'
import {getAdviceById} from 'store/project'
import {PageWithNavigationBar} from 'components/navigation'
import {Colors, JobGroupCoverImage} from 'components/theme'
import {Routes} from 'components/url'


const redirectToProject = projectId => {
  browserHistory.replace(`${Routes.PROJECT_PAGE}/${projectId}`)
}


class AdvicePage extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    params: React.PropTypes.shape({
      adviceId: React.PropTypes.string.isRequired,
      projectId: React.PropTypes.string.isRequired,
    }),
    user: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    advice: null,
    project: null,
  }

  componentWillMount() {
    this.updateAdvice(this.props.params, this.props.user)
  }

  componentWillReceiveProps(nextProps) {
    this.updateAdvice(nextProps.params, nextProps.user)
  }

  updateAdvice({adviceId, projectId}, user) {
    const project = (user.projects || []).
      find(project => project.projectId === projectId)
    const advice = project && getAdviceById({adviceId}, project)
    if (!advice || !advice.engagementAction) {
      redirectToProject(projectId)
      return
    }
    if (!this.state.project || !this.state.advice ||
        this.state.project.projectId !== projectId || this.state.advice.adviceId !== adviceId) {
      this.props.dispatch(advisorEngagementActionIsShown(project, advice))
    }
    this.setState({advice, project})
  }

  redirectToProject = () => {
    redirectToProject(this.state.project.projectId)
  }

  render() {
    const {project} = this.state
    return <PageWithNavigationBar style={{zIndex: 0}} isContentScrollable={true}>
      <div style={{height: 180, position: 'absolute', width: '100%', zIndex: -1}}>
        <JobGroupCoverImage
            romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
            coverOpacity={1}
            opaqueCoverGradient={{
              left: Colors.CHARCOAL_GREY,
              middle: Colors.CHARCOAL_GREY,
              right: 'rgba(56, 63, 81, 0.7)'}} />
      </div>
      {/* TODO(pascal): Add daily tip. */}
      Bientôt disponible : une liste d'astuces pour ce conseil…
    </PageWithNavigationBar>
  }
}


export {AdvicePage}
