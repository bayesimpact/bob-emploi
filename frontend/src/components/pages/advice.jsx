import React from 'react'
import {browserHistory} from 'react-router'

import {advisorEngagementActionIsShown, stopAdviceEngagement} from 'store/actions'
import {getAdviceById} from 'store/project'
import {PageWithNavigationBar} from 'components/navigation'
import {Congratulations, StickyAction} from 'components/sticky'
import {Colors, Icon, JobGroupCoverImage, RoundButton} from 'components/theme'
import {Routes} from 'components/url'


class AdvicePage extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    params: React.PropTypes.shape({
      adviceId: React.PropTypes.string.isRequired,
      projectId: React.PropTypes.string.isRequired,
    }),
    user: React.PropTypes.object.isRequired,
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
      this.redirectToProject(projectId)
      return
    }
    if (!this.state.project || !this.state.advice ||
        this.state.project.projectId !== projectId || this.state.advice.adviceId !== adviceId) {
      this.props.dispatch(advisorEngagementActionIsShown(project, advice))
    }
    this.setState({advice, project})
  }

  redirectToProject(projectId) {
    browserHistory.replace(`${Routes.PROJECT_PAGE}/${projectId}`)
  }

  handleStop = feedback => {
    const {advice, project} = this.state
    this.props.dispatch(stopAdviceEngagement(project, advice, feedback))
    this.redirectToProject(project.projectId)
  }

  render() {
    const {advice, project} = this.state
    const canStop = advice.status === 'ADVICE_ACCEPTED'
    return <StickyActionPage
        action={advice.engagementAction} project={project}
        onDone={() => this.redirectToProject(project.projectId)}
        onStop={canStop ? this.handleStop : null} />
  }
}


class StickyActionPage extends React.Component {
  static propTypes = {
    action: React.PropTypes.object,
    onDone: React.PropTypes.func.isRequired,
    onStop: React.PropTypes.func,
    project: React.PropTypes.object.isRequired,
  }

  handleBackClick = () => {
    browserHistory.push(Routes.PROJECT_PAGE + '/' + this.props.project.projectId)
  }

  renderDoneNode() {
    return <Congratulations
        submitCaption="Voir les autres solutions"
        onSubmit={this.props.onDone}>
      Vous avez complété tous les conseils pour travailler sur cette solution.
      Vous pouvez <strong>consulter les autres solutions</strong> proposées ou
      vous lancer et postuler en utilisant les conseils et astuces que vous
      avez découverts.
   </Congratulations>
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {action, onDone, onStop, project, ...extraProps} = this.props
    const pageStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
      margin: '0 auto 50px',
      maxWidth: 720,
    }
    const buttonContainerStyle = {
      margin: '20px auto',
      width: pageStyle.width,
    }
    const chevronStyle = {
      fontSize: 20,
      verticalAlign: 'middle',
    }
    return <PageWithNavigationBar {...extraProps} style={{zIndex: 0}} isContentScrollable={true}>
      <div style={{height: 180, position: 'absolute', width: '100%', zIndex: -1}}>
        <JobGroupCoverImage
            romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
            coverOpacity={1}
            opaqueCoverGradient={{
              left: Colors.CHARCOAL_GREY,
              middle: Colors.CHARCOAL_GREY,
              right: 'rgba(56, 63, 81, 0.7)'}} />
      </div>
      <div style={buttonContainerStyle}>
        <RoundButton
            onClick={this.handleBackClick} type="navigationOnImage"
            style={{padding: '8px 21px 6px 16px'}}>
          <Icon name="chevron-left" style={chevronStyle} /> Retour aux solutions
        </RoundButton>
      </div>
      <div style={pageStyle}>
        <StickyAction action={action} onStop={onStop} doneNode={this.renderDoneNode()} />
      </div>
    </PageWithNavigationBar>
  }
}


export {AdvicePage}
