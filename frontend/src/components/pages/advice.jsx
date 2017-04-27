import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import VisibilitySensor from 'react-visibility-sensor'
import Radium from 'radium'

import {advicePageIsShown, getAdviceTips, moveUserDatesBackOneDay, selectAdvice,
        showAllTips} from 'store/actions'
import {getAdviceById} from 'store/project'

import {Action, ActionDescriptionModal} from 'components/actions'
import {AdvicePageContent, AdviceCard} from 'components/advisor'
import {PageWithNavigationBar} from 'components/navigation'
import {ShortKey} from 'components/shortkey'
import {Colors, Icon, JobGroupCoverImage, Button, PaddedOnMobile,
        SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'

import adviceModuleProperties from 'components/advisor/data/advice_modules.json'

const RadiumIcon = Radium(Icon)

const DEFAULT_TIPS_SHOWN = 5

// Delay between showing two tips in ms.
const DELAY_BETWEEN_TIPS = 150

const redirectToProject = projectId => {
  browserHistory.replace(`${Routes.PROJECT_PAGE}/${projectId}`)
}


class AppearingComponent extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
  }
  state = {
    opacity: 0,
  }

  componentWillMount() {
    this.timeout = setTimeout(() => this.setState({opacity: 1}), 100)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  render() {
    const style = {
      opacity: this.state.opacity,
      transition: 'opacity 300ms ease-in 300ms',
    }
    return <div style={style}>{this.props.children}</div>
  }
}


class AdvicePage extends React.Component {
  static propTypes = {
    app: React.PropTypes.object.isRequired,
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
    canSideBarBeHidden: false,
    isSideBarShown: false,
    numTipsShown: 0,
    openTip: null,
    project: null,
  }

  componentWillMount() {
    this.updateAdvice(this.props.params, this.props.user)
    if (window.innerWidth < 1300) {
      this.setState({canSideBarBeHidden: true})
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  componentWillReceiveProps(nextProps) {
    this.updateAdvice(nextProps.params, nextProps.user)
    if (nextProps.params.adviceId !== this.props.params.adviceId) {
      this.setState({isSideBarShown: false})
    }
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
      dispatch(getAdviceTips(project, advice))
    }
    this.setState({advice, project})
  }

  redirectToProject = () => {
    redirectToProject(this.state.project.projectId)
  }

  showNTips(totalNumberOfTips) {
    const {numTipsShown} = this.state
    if (numTipsShown >= totalNumberOfTips) {
      return
    }
    this.setState({numTipsShown: numTipsShown + 1})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.showNTips(totalNumberOfTips)
    }, DELAY_BETWEEN_TIPS)
  }

  handleShowAllTipsClick = numberTips => () => {
    const {advice, project} = this.state
    const {dispatch} = this.props
    dispatch(showAllTips(project, advice))
    this.showNTips(numberTips)
  }

  renderBackground() {
    const {project} = this.state
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
      position: 'absolute',
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
    </div>
  }

  renderContent() {
    const {advice, project} = this.state
    const {user, ...extraProps} = this.props
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
      <AdviceCard
          {...extraProps} project={project} advice={advice} profile={user.profile}
          isInAdvicePage={true} />
      <AdvicePageContent
          project={project} advice={advice} profile={user.profile}
          style={{margin: 'auto', maxWidth: 700}} />
    </div>
  }

  renderTipListOrText(tips, text) {
    const {numTipsShown} = this.state
    if (!tips.length) {
      const notipsStyle = {
        color: Colors.CHARCOAL_GREY,
        fontSize: 13,
        fontStyle: 'italic',
      }
      return <div style={notipsStyle}>{text}</div>
    }
    const showMoreTipsStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 20,
    }
    const tipsShown = tips.slice(0, numTipsShown)

    return <div>
      <VisibilitySensor
          active={numTipsShown === 0} intervalDelay={250} delayedCall={true}
          onChange={() => this.showNTips(DEFAULT_TIPS_SHOWN)} />
      {tipsShown.map(tip => <AppearingComponent key={tip.actionId}><Action
          action={tip}
          onOpen={() => this.setState({openTip: tip})} /></AppearingComponent>)}
      {(numTipsShown === DEFAULT_TIPS_SHOWN && tips.length > DEFAULT_TIPS_SHOWN) ?
        <div style={showMoreTipsStyle}>
          <Button onClick={this.handleShowAllTipsClick(tips.length)} type="back">
            Afficher d'autres astuces
          </Button>
        </div> : null
      }
    </div>
  }

  // Tells the users when they will get the next tip.
  renderNextTipTime() {
    return <span style={{color: Colors.CHARCOAL_GREY, fontSize: 14}}>Prochaine astuce demain
        à <strong><em>08h00</em></strong></span>
  }

  getTips() {
    const {advice, project} = this.state
    const {adviceTips} = this.props.app
    return (adviceTips[project.projectId] || {})[advice.adviceId] || []
  }

  renderTips(style) {
    const {advice} = this.state
    if (!advice) {
      return null
    }
    const titleStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 16,
      marginBottom: 10,
    }
    const {goal} = adviceModuleProperties[advice.adviceId] || {}
    return <div style={style}>
      <div style={titleStyle}>
        <PaddedOnMobile>Voici quelques astuces pour {goal}&nbsp;:</PaddedOnMobile>
      </div>
      {this.renderTipListOrText(this.getTips(), 'Aucune astuce')}
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
    const {canSideBarBeHidden} = this.state
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
      <ShortKey keyCode="KeyY" ctrlKey={true} shiftKey={true} onKeyPress={this.moveToTomorrow} />
      {this.renderNavigationButtons()}
      <div style={{display: 'flex', position: 'relative', ...sideBarContainerStyle}}>
        {this.renderSideBar()}
        <div style={contentStyle}>
          {this.renderBackground()}
          <ActionDescriptionModal
              action={this.state.openTip}
              onClose={() => this.setState({openTip: null})}
              isShown={!!this.state.openTip} />
          <div style={{margin: 'auto', maxWidth: 950}}>
            {this.renderContent()}
            {this.renderTips({margin: '60px 0'})}
          </div>
        </div>
      </div>
    </PageWithNavigationBar>
  }
}


class SideBarBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    onBack: React.PropTypes.func.isRequired,
    onClose: React.PropTypes.func,
    project: React.PropTypes.object.isRequired,
    selectedAdviceId: React.PropTypes.string,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
      {(project.advices || []).map(advice => <SideBarLink
          key={advice.adviceId} advice={advice}
          isSelected={selectedAdviceId === advice.adviceId}
          onClick={() => this.goToOtherAdvice(advice)} />)}
    </nav>
  }
}
const SideBar = connect()(SideBarBase)


class BackButton extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
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
    advice: React.PropTypes.object.isRequired,
    isSelected: React.PropTypes.bool,
    style: React.PropTypes.object,
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
