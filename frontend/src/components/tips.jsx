import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {getAdviceTips, showAllTips} from 'store/actions'

import {Action, ActionDescriptionModal} from 'components/actions'
import {Button, Colors, PaddedOnMobile} from 'components/theme'

import adviceModuleProperties from 'components/advisor/data/advice_modules.json'

const DEFAULT_TIPS_SHOWN = 5

// Delay between showing two tips in ms.
const DELAY_BETWEEN_TIPS = 150


class TipsListBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object,
    style: PropTypes.object,
    tips: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
  }

  state = {
    numTipsShown: 0,
    openTip: null,
  }

  componentWillMount() {
    this.updateAdvice(this.props)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.advice !== this.props.advice || nextProps.project !== this.props.project) {
      this.updateAdvice(nextProps)
    }
  }

  updateAdvice({advice, project}) {
    const {dispatch, tips} = this.props
    if (advice && project && !tips.length) {
      dispatch(getAdviceTips(project, advice))
    }
  }

  handleShowAllTipsClick = numberTips => () => {
    const {advice, dispatch, project} = this.props
    dispatch(showAllTips(project, advice))
    this.showNTips(numberTips)
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

  render() {
    const {advice, style, tips} = this.props
    const {numTipsShown, openTip} = this.state
    if (!advice) {
      return null
    }
    if (!tips.length) {
      return <div style={style} />
    }
    const titleStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 16,
      marginBottom: 10,
    }
    const showMoreTipsStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 20,
    }
    const {goal} = adviceModuleProperties[advice.adviceId] || {}
    const tipsShown = tips.slice(0, numTipsShown)
    return <div style={{marginTop: 30, ...style}}>
      <ActionDescriptionModal
          action={openTip}
          onClose={() => this.setState({openTip: null})}
          isShown={!!this.state.openTip} />
      <div style={titleStyle}>
        <PaddedOnMobile>Voici quelques astuces pour {goal}&nbsp;:</PaddedOnMobile>
      </div>
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
        </div> : null}
    </div>
  }
}
const TipsList = connect(({app}, {advice, project}) => ({
  tips: (app.adviceTips[project && project.projectId] || {})[advice && advice.adviceId] || [],
}))(TipsListBase)


class AppearingComponent extends React.Component {
  static propTypes = {
    children: PropTypes.node,
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


export {TipsList}
