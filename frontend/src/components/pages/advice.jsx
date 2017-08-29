import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import Radium from 'radium'

import {advicePageIsShown, moveUserDatesBackOneDay, selectAdvice} from 'store/actions'
import {getAdviceById} from 'store/project'

import {ExpandedAdviceCardContent} from 'components/advisor'
import {PageWithNavigationBar} from 'components/navigation'
import {ShortKey} from 'components/shortkey'
import {Colors, Icon, JobGroupCoverImage, Button, SmoothTransitions} from 'components/theme'
import {TipsList} from 'components/tips'
import {Routes} from 'components/url'

import adviceModuleProperties from 'components/advisor/data/advice_modules.json'

const RadiumIcon = Radium(Icon)

const redirectToProject = projectId => {
  browserHistory.replace(`${Routes.PROJECT_PAGE}/${projectId}`)
}


class AdvicePage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    params: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      projectId: PropTypes.string.isRequired,
    }),
    user: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    advice: null,
    canSideBarBeHidden: false,
    isSideBarShown: false,
    project: null,
  }

  componentWillMount() {
    this.updateAdvice(this.props.params, this.props.user)
    if (window.innerWidth < 1300) {
      this.setState({canSideBarBeHidden: true})
    }
  }

  componentWillReceiveProps(nextProps) {
    this.updateAdvice(nextProps.params, nextProps.user)
    if (nextProps.params.adviceId !== this.props.params.adviceId) {
      this.setState({isSideBarShown: false})
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  moveToTomorrow = () => {
    this.props.dispatch(moveUserDatesBackOneDay())
  }

  updateAdvice({adviceId, projectId}, user) {
    const {dispatch} = this.props
    const project = (user.projects || []).
      find(project => project.projectId === projectId)
    const advice = project && getAdviceById({adviceId}, project)
    if (!advice) {
      redirectToProject(projectId)
      return
    }
    if (!this.state.project || !this.state.advice ||
        this.state.project.projectId !== projectId || this.state.advice.adviceId !== adviceId) {
      dispatch(advicePageIsShown(project, advice))
    }
    this.setState({advice, project})
  }

  redirectToProject = () => {
    redirectToProject(this.state.project.projectId)
  }

  renderBackground() {
    const {advice, project} = this.state
    const {isMobileVersion} = this.context
    if (isMobileVersion || !project) {
      // No background on mobile.
      return null
    }
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      display: 'flex',
      fontSize: 25,
      fontWeight: 500,
      justifyContent: 'center',
      minHeight: 140,
      padding: '20px 0',
      position: 'relative',
      textAlign: 'center',
      width: '100%',
      zIndex: 0,
    }
    return <div style={style}>
      <JobGroupCoverImage
        romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
        coverOpacity={1}
        opaqueCoverGradient={{
          left: Colors.CHARCOAL_GREY,
          middle: Colors.CHARCOAL_GREY,
          right: 'rgba(56, 63, 81, 0.7)'}} />
      <div style={{fontSize: 30, fontStyle: 'italic'}}>
        {adviceModuleProperties[advice.adviceId].title || ''}
      </div>
    </div>
  }

  renderContent() {
    const {advice, project} = this.state
    const {user} = this.props
    if (!project || !advice) {
      return null
    }
    const style = {
      color: Colors.DARK_TWO,
      fontSize: 15,
      lineHeight: 1.53,
      marginTop: 40,
      position: 'relative',
    }

    return <div style={style}>
      <ExpandedAdviceCardContent
        project={project} advice={advice} profile={user.profile}
        style={{margin: 'auto', maxWidth: 700}} />
    </div>
  }

  renderSideBar() {
    const {adviceId} = this.props.params
    const {canSideBarBeHidden, isSideBarShown, project} = this.state
    if (!project) {
      return null
    }
    const sideBarStyle = {
      width: 260,
    }
    if (canSideBarBeHidden) {
      Object.assign(sideBarStyle, {
        height: '100%',
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        transform: `translateX(${isSideBarShown ? '0' : '-100%'})`,
        zIndex: 1,
        ...SmoothTransitions,
      })
    }
    return <SideBar
      project={project} selectedAdviceId={adviceId}
      onBack={this.redirectToProject} style={sideBarStyle}
      onClose={canSideBarBeHidden ? (() => this.setState({isSideBarShown: false})) : null} />
  }

  renderNavigationButtons() {
    const {canSideBarBeHidden} = this.state
    const {isMobileVersion} = this.context
    const buttonsStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 25,
      left: 20,
      position: 'absolute',
      top: 20,
      zIndex: 1,
    }
    const menuStyle = {
      ':hover': {
        color: '#fff',
      },
      color: Colors.PINKISH_GREY,
      cursor: 'pointer',
      ...SmoothTransitions,
    }

    if (!canSideBarBeHidden || isMobileVersion) {
      return null
    }
    return <div style={buttonsStyle}>
      <RadiumIcon
        name="menu" onClick={() => this.setState({isSideBarShown: true})}
        style={menuStyle} />
      <BackButton onClick={this.redirectToProject} style={{marginLeft: 20}} />
    </div>
  }

  render() {
    const {advice, canSideBarBeHidden, project} = this.state
    const {isMobileVersion} = this.context
    const isSideBarFixed = !canSideBarBeHidden && !isMobileVersion
    const sideBarContainerStyle = isSideBarFixed ? {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    } : {}
    const contentStyle = {
      flex: 1,
      minWidth: 0,
      overflow: isSideBarFixed ? 'auto' : 'intial',
      position: 'relative',
    }
    return <PageWithNavigationBar
      style={{zIndex: 0}} isContentScrollable={true} onNavigateBack={this.redirectToProject}>
      <ShortKey
        keyCode="KeyY" hasCtrlModifier={true} hasShiftModifier={true}
        onKeyPress={this.moveToTomorrow} />
      {this.renderNavigationButtons()}
      <div style={{display: 'flex', position: 'relative', ...sideBarContainerStyle}}>
        {this.renderSideBar()}
        <div style={contentStyle}>
          {this.renderBackground()}
          <div style={{margin: 'auto', maxWidth: 950}}>
            {this.renderContent()}
            <TipsList advice={advice} project={project} style={{margin: '60px 0'}} />
          </div>
        </div>
      </div>
    </PageWithNavigationBar>
  }
}


class SideBarBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    onClose: PropTypes.func,
    project: PropTypes.object.isRequired,
    selectedAdviceId: PropTypes.string,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  goToOtherAdvice = advice => {
    const {dispatch, project} = this.props
    dispatch(selectAdvice(project, advice, 'side-bar'))
  }

  render() {
    const {style} = this.props
    const {isMobileVersion} = this.context
    if (isMobileVersion) {
      return null
    }
    const {onBack, onClose, project, selectedAdviceId} = this.props
    const containerStyle = {
      backgroundColor: Colors.SLATE,
      boxShadow: '2px 0 0 0 rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const backButtonStyle = {
      left: 20,
      position: 'absolute',
      top: 20,
    }
    const closeButtonStyle = {
      ':hover': {color: '#fff'},
      color: Colors.PINKISH_GREY,
      cursor: 'pointer',
      fontSize: 20,
      padding: 5,
      position: 'absolute',
      right: 20,
      top: 20,
      ...SmoothTransitions,
    }
    return <nav style={containerStyle}>
      <header style={{borderBottom: 'solid 1px rgba(43, 51, 73, 0.4)', height: 70}}>
        {onClose ?
          <RadiumIcon name="close" onClick={onClose} style={closeButtonStyle} /> :
          <BackButton onClick={onBack} style={backButtonStyle} />}
      </header>
      <div style={{flex: 1, overflow: 'auto'}}>
        {(project.advices || []).map(advice => <SideBarLink
          key={advice.adviceId} advice={advice}
          isSelected={selectedAdviceId === advice.adviceId}
          onClick={() => this.goToOtherAdvice(advice)} />)}
      </div>
    </nav>
  }
}
const SideBar = connect()(SideBarBase)


class BackButton extends React.Component {
  static propTypes = {
    style: PropTypes.object,
  }

  render() {
    const {style, ...extraProps} = this.props
    const backButtonStyle = {
      padding: '8px 21px 5px 15px',
      ...style,
    }
    const chevronStyle = {
      fontSize: 19,
      lineHeight: '14px',
      marginBottom: 3,
      marginRight: 5,
      verticalAlign: 'middle',
    }
    return <Button
      style={backButtonStyle} type="navigationOnImage" isNarrow={true}
      {...extraProps}>
      <Icon name="chevron-left" style={chevronStyle} />
      Retour
    </Button>
  }
}


class SideBarLinkBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    isSelected: PropTypes.bool,
    style: PropTypes.object,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {advice, isSelected, style, ...extraProps} = this.props
    const {isHovered} = this.state
    const containerStyle = {
      ':hover': isSelected ? {} : {
        backgroundColor: Colors.DARK_TWO,
        color: '#fff',
      },
      alignItems: 'center',
      backgroundColor: isSelected ? Colors.SKY_BLUE : 'transparent',
      borderBottom:
        `solid 1px ${(isSelected || isHovered) ? 'transparent' : 'rgba(43, 51, 73, 0.4)'}`,
      color: isSelected ? '#fff' : Colors.PINKISH_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 18,
      fontStyle: 'italic',
      fontWeight: 'bold',
      overflow: 'hidden',
      padding: 20,
      position: 'relative',
      ...SmoothTransitions,
      ...style,
    }
    const {title} = adviceModuleProperties[advice.adviceId] || {}
    return <div
      style={containerStyle} {...extraProps}
      onMouseEnter={() => this.setState({isHovered: true})}
      onMouseLeave={() => this.setState({isHovered: false})}>
      <div style={{flex: 1}}>{title}</div>
      {isSelected ? null : <Icon name="chevron-right" />}
    </div>
  }
}
const SideBarLink = Radium(SideBarLinkBase)


export {AdvicePage}
