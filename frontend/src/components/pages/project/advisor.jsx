import React from 'react'
import {connect} from 'react-redux'
import Radium from 'radium'

import {advisorRecommendationIsShown, displayToasterMessage} from 'store/actions'
import {upperFirstLetter} from 'store/french'
import {PageWithNavigationBar} from 'components/navigation'
import {Colors, JobGroupCoverImage, RoundButton, SmoothTransitions, Styles} from 'components/theme'

import Organization from './advisor/organization'
import LongCDD from './advisor/long_cdd'
import NetworkApplication from './advisor/network'
import Reorientation from './advisor/reorientation'
import SpontaneousApplication from './advisor/spontaneous'


// Map of advice recommendation modules keyed by advice module IDs.
const ADVICE_MODULES = {
  'long-cdd': LongCDD,
  'network-application': NetworkApplication,
  organization: Organization,
  reorientation: Reorientation,
  'spontaneous-application': SpontaneousApplication,
}


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    isRecommended: React.PropTypes.bool,
    onSelect: React.PropTypes.func,
    style: React.PropTypes.object,
  }

  render() {
    const {advice, isRecommended, onSelect} = this.props
    const title = advice.engagementAction && advice.engagementAction.title ||
      upperFirstLetter(advice.adviceId)
    const steps = advice.engagementAction && advice.engagementAction.steps || []
    const module = ADVICE_MODULES[advice.adviceId] || null
    const {color, picto} = module && module.AdviceCard || {}
    const numDoneSteps = steps.filter(step => step.isDone).length
    const style = {
      ':hover': {
        boxShadow: '0 2px 23px 0 rgba(0, 0, 0, 0.1)',
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      height: 300,
      maxWidth: 460,
      position: 'relative',
      textAlign: 'center',
      ...SmoothTransitions,
      ...this.props.style,
    }
    const titleStyle = {
      color: Colors.DARK,
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 30,
      padding: '0 35px',
    }
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: isRecommended && color || Colors.MODAL_PROJECT_GREY,
      borderRadius: '4px 4px 0 0',
      display: 'flex',
      height: 80,
      justifyContent: 'center',
      width: '100%',
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.MODAL_PROJECT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.COOL_GREY,
      marginBottom: 45,
    }
    const maybeS = (steps.length > 1) ? 's' : ''
    const progressContainerStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 100,
      height: 4,
      overflow: 'hidden',
      position: 'relative',
      // This is a CSS stunt to make the hidden overflow + border-radius
      // effective on Mac + Chrome.
      transform: 'scale(1)',
      width: 220,
    }
    const progressStyle = {
      ...Styles.PROGRESS_GRADIENT,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: (100 * numDoneSteps / steps.length) + '%',
    }
    const styledPicto = isRecommended ? picto : picto && React.cloneElement(
        picto, {style: {filter: 'saturate(0)', opacity: .5}})
    return <div style={style}>
      <header style={headerStyle}>
        {styledPicto || null}
      </header>
      <div style={titleStyle}>
        {title}
      </div>
      {steps.length ? <div style={{color: Colors.COOL_GREY, marginTop: 10}}>
        {steps.length} conseil{maybeS}
      </div> : null}

      <div style={{alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'center'}}>
        {numDoneSteps ? <div style={progressContainerStyle}>
          <div style={progressStyle} />
        </div> : null}
      </div>

      <RoundButton onClick={onSelect} style={buttonStyle}>
        Voir le{maybeS} conseil{maybeS}
      </RoundButton>
    </div>
  }
}
const AdviceCard = Radium(AdviceCardBase)


class AdvisorPageBase extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    isMobileVersion: React.PropTypes.bool,
    project: React.PropTypes.object.isRequired,
  }

  state = {
    RecommendComponent: undefined,
  }

  componentWillMount() {
    const {advice, dispatch, project} = this.props
    dispatch(advisorRecommendationIsShown(project, advice))
    this.setComponentFromProps(this.props)
  }

  componentWillReceiveProps(nextProps) {
    this.setComponentFromProps(nextProps)
    if (nextProps.advice.adviceId !== this.props.advice.adviceId) {
      this.refs.page && this.refs.page.scrollTo(0)
    }
  }

  setComponentFromProps(props) {
    const {advice, dispatch} = props
    const module = ADVICE_MODULES[advice.adviceId] || null
    const RecommendComponent = module && module.RecommendPage || null
    if (RecommendComponent === this.state.RecommendComponent) {
      return
    }
    if (!RecommendComponent) {
      dispatch(displayToasterMessage(`Erreur: Advice Module inconnu "${advice.adviceId}"`))
      return
    }
    this.setState({RecommendComponent})
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {advice, dispatch, isMobileVersion, project, ...extraProps} = this.props
    const {RecommendComponent} = this.state
    if (!RecommendComponent) {
      return null
    }
    return <PageWithNavigationBar
        page="project" style={{zIndex: 0}} isContentScrollable={true} ref="page">
      {isMobileVersion ? null : <div
          style={{height: 180, position: 'absolute', width: '100%', zIndex: -1}}>
        <JobGroupCoverImage
            romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
            coverOpacity={1}
            opaqueCoverGradient={{
              left: Colors.CHARCOAL_GREY,
              middle: Colors.CHARCOAL_GREY,
              right: 'rgba(56, 63, 81, 0.7)'}} />
      </div>}
      <div style={{padding: isMobileVersion ? 0 : 30}}>
        <RecommendComponent
            {...extraProps} project={project} isMobileVersion={isMobileVersion}
            style={{margin: 'auto', maxWidth: 700}} />
      </div>
    </PageWithNavigationBar>
  }
}
const AdvisorPage = connect(({app}) => ({isMobileVersion: app.isMobileVersion}))(AdvisorPageBase)


export {AdviceCard, AdvisorPage}
