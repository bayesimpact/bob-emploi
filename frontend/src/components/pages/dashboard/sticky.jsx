import React from 'react'
import {connect} from 'react-redux'
import Radium from 'radium'
import ReactHeight from 'react-height'

import {stickyProgress} from 'store/action'
import {finishStickyActionStep, stopStickyAction} from 'store/actions'

import {ShortKey} from 'components/shortkey'
import {Modal} from 'components/modal'
import {Colors, ExternalSiteButton, Icon, Input, LabeledToggle, Markdown,
        RoundButton, SmoothTransitions, Styles} from 'components/theme'


class Pane extends React.Component {
  static propTypes = {
    // Content of the pane.
    children: React.PropTypes.node,
    // Whether the pane is shown.
    isShown: React.PropTypes.bool,
    // Callback when the pane is closed (X button is clicked).
    // X button will only be displayed if this function is provided.
    onClose: React.PropTypes.func,
    // Additional styling for the pane box.
    style: React.PropTypes.object,
    // Duration in milliseconds of the transition to open and close the pane.
    transitionDurationMilliSec: React.PropTypes.number,
  }

  static defaultProps = {
    transitionDurationMilliSec: 400,
  }

  state = {
    children: null,
    isContentShown: false,
    isTransitionOver: false,
  }

  show() {
    this.setState({isContentShown: true})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(
        () => this.setState({isTransitionOver: true}),
        this.props.transitionDurationMilliSec)
  }

  hide() {
    // Keep the current children while disappearing.
    this.setState({children: this.props.children, isTransitionOver: false})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(
        () => this.setState({children: null, isContentShown: false}),
        this.props.transitionDurationMilliSec)
  }

  componentWillMount() {
    if (this.props.isShown) {
      this.show()
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isShown} = nextProps
    if (!!isShown !== !!this.props.isShown) {
      if (isShown) {
        this.show()
      } else {
        this.hide()
      }
    }
  }

  componentWillUnmount() {
    if (this.props.isShown) {
      this.hide()
    }
    clearTimeout(this.timeout)
  }

  render() {
    const {isShown, onClose, style, transitionDurationMilliSec} = this.props
    const {children, isContentShown, isTransitionOver} = this.state
    const pageStyle = {
      display: 'flex',
      height: '100vh',
      justifyContent: 'flex-end',
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      position: 'fixed',
      right: 0,
      top: 0,
      width: isContentShown ? '100vw' : 0,
      zIndex: 1,
    }
    const backgroundStyle = {
      backgroundColor: '#000',
      bottom: 0,
      left: 0,
      opacity: isShown ? .5 : 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: `opacity ${transitionDurationMilliSec}ms`,
      zIndex: 0,
    }
    const paneStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.2)',
      color: Colors.GREYISH_BROWN,
      fontSize: 19,
      lineHeight: 1.7,
      opacity: isShown ? 1 : 0,
      position: 'relative',
      // The transform property creates a new local coordinate system which
      // breaks nested modals or other properties using "fixed" so we get rid
      // of it as soon as the transition is over.
      // https://www.w3.org/TR/css-transforms-1/#transform-rendering
      transform: isTransitionOver ? 'initial' : (
        `translate(${isShown ? '0%' : '100%'}, 0)`),
      transition: `all ${transitionDurationMilliSec}ms`,
      ...style,
    }
    const contentStyle = {
      bottom: 0,
      left: 0,
      overflow: 'auto',
      position: 'absolute',
      right: 0,
      top: 0,
    }
    return <div style={pageStyle}>
      <div style={backgroundStyle} onClick={onClose} />
      <div style={paneStyle}>
        {onClose ? <PaneCloseButton onClose={onClose} /> : null}
        <div style={contentStyle}>
          {isContentShown ? (children || this.props.children) : null}
        </div>
      </div>
    </div>
  }
}


class PaneCloseButtonBase extends React.Component {
  static propTypes = {
    onClose: React.PropTypes.func.isRequired,
  }

  render() {
    const {onClose} = this.props
    const style = {
      ':hover': {
        backgroundColor: Colors.SLATE,
      },
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      borderRadius: '3px 0 0 3px',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 18,
      height: 48,
      justifyContent: 'center',
      position: 'absolute',
      right: '100%',
      top: 20,
      width: 48,
      ...SmoothTransitions,
    }
    return <div style={style} onClick={onClose} ref="close">
      <ShortKey keyCode="Escape" onKeyDown={onClose} />
      <Icon name="close" />
    </div>
  }
}
const PaneCloseButton = Radium(PaneCloseButtonBase)


class StickyActionPaneBase extends React.Component {
  static propTypes = {
    action: React.PropTypes.object,
    dispatch: React.PropTypes.func.isRequired,
    onClose: React.PropTypes.func.isRequired,
  }

  state = {
    expandedStepIndex: -1,
    isFinishActionModalShown: false,
    isStopActionModalShown: false,
    lastExpandableStepIndex: -1,
  }

  componentWillMount() {
    this.updateExpandedStep(this.props.action)
  }

  componentWillReceiveProps(nextProps) {
    const {action} = nextProps
    const prevAction = this.props.action
    if (action !== prevAction) {
      this.updateExpandedStep(action)
    }

    if (!action || !prevAction) {
      return
    }
    if (action.status === 'ACTION_STICKY_DONE' && prevAction.status === 'ACTION_STUCK') {
      this.setState({isFinishActionModalShown: true})
    }
  }

  updateExpandedStep(action) {
    const steps = (action && action.steps || [])
    let lastExpandableStepIndex = steps.findIndex(step => !step.isDone)
    if (lastExpandableStepIndex < 0) {
      lastExpandableStepIndex = steps.length
    }
    this.setState({
      expandedStepIndex: lastExpandableStepIndex,
      lastExpandableStepIndex,
    })
  }

  handleStopStickyAction = feedback => {
    const {action, dispatch, onClose} = this.props
    dispatch(stopStickyAction(action, feedback))
    onClose()
  }

  renderHeader() {
    const action = this.props.action || {}
    const headerStyle = {
      borderBottom: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 25,
      fontWeight: 500,
      padding: '30px 50px',
    }
    const starStyle = {
      color: Colors.SUN_YELLOW,
      fontSize: 27,
      marginTop: '.2em',
    }
    return <header style={headerStyle}>
      <span style={{flex: 1}}>
        {action.goal}
      </span>
      <Icon name="star" style={starStyle} />
    </header>
  }

  renderProgress() {
    const action = this.props.action || {}
    const style = {
      borderBottom: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 15,
      fontWeight: 500,
      height: 75,
    }
    const stopContainerStyle = {
      alignItems: 'center',
      borderLeft: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      display: 'flex',
      padding: 5,
    }
    const leftCellStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 20px 0 50px',
    }
    const progressContainerStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 100,
      height: 10,
      marginTop: 8,
      overflow: 'hidden',
      position: 'relative',
      // This is a CSS stunt to make the hidden overflow + border-radius
      // effective on Mac + Chrome.
      transform: 'scale(1)',
    }
    const progressStyle = {
      ...Styles.PROGRESS_GRADIENT,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
      width: (100 * stickyProgress(action)) + '%',
    }
    return <section style={style}>
      <div style={leftCellStyle}>
        <div>Votre avancement pour cette action</div>
        <div style={progressContainerStyle}>
          <div style={progressStyle} />
        </div>
      </div>
      {/* TODO(pascal): If action is stopped, allow to start it again. */}
      {action.stoppedAt ? null : <div style={stopContainerStyle}>
        <StopStickyActionModal
            isShown={this.state.isStopActionModalShown}
            onClose={() => this.setState({isStopActionModalShown: false})}
            onStop={this.handleStopStickyAction} />
        <RoundButton onClick={() => this.setState({isStopActionModalShown: true})} type="discreet">
          Arrêter cette action
        </RoundButton>
      </div>}
    </section>
  }

  render() {
    const {action, onClose, ...extraProps} = this.props
    const {expandedStepIndex, isFinishActionModalShown, lastExpandableStepIndex} = this.state
    return <Pane {...extraProps} onClose={onClose} style={{width: '50vw'}}>
      <FinishStickyActionModal
          isShown={isFinishActionModalShown}
          onClose={() => {
            this.setState({isFinishActionModalShown: false})
            onClose()
          }} />
      {this.renderHeader()}
      {this.renderProgress()}
      {(action && action.steps || []).map((step, index) => <Step
          key={index} index={index + 1} step={step}
          onExpand={index > lastExpandableStepIndex ? null :
            () => this.setState({expandedStepIndex: index})}
          isExpanded={index === expandedStepIndex} />)}
    </Pane>
  }
}
const StickyActionPane = connect()(StickyActionPaneBase)


class StepBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    index: React.PropTypes.number.isRequired,
    isExpanded: React.PropTypes.bool,
    onExpand: React.PropTypes.func,
    step: React.PropTypes.object.isRequired,
  }

  state = {
    contentHeight: 0,
    isDoneForceChecked: false,
    text: '',
  }

  componentWillMount() {
    const {text} = this.props.step
    this.setState({text})
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  handleValidate = () => {
    const {text} = this.state
    if (!text) {
      return
    }
    this.handleStepDone(text)
  }

  toggleDone = () => {
    const {step} = this.props
    if (step.isDone) {
      // TODO(pascal): Implement.
      alert('Bientôt disponible…')
      return
    }
    this.setState({isDoneForceChecked: true})
    this.timeout = setTimeout(() => this.handleStepDone(), 150)
  }

  handleStepDone(text) {
    const {dispatch, step} = this.props
    dispatch(finishStickyActionStep(step, text))
  }

  renderHeader() {
    const {index, isExpanded, onExpand, step} = this.props
    const style = {
      color: isExpanded ? Colors.DARK_TWO :
        (step.isDone || onExpand) ? Colors.SLATE : Colors.PINKISH_GREY,
      cursor: onExpand ? 'pointer' : 'initial',
      fontSize: (step.isDone && !isExpanded) ? 15 : 17,
      fontWeight: 500,
      padding: isExpanded ? '40px 0 16px' : '13px 0 12px',
      position: 'relative',
      ...SmoothTransitions,
    }
    const iconStyle = {
      color: Colors.GREENISH_TEAL,
      fontSize: 27,
      position: 'absolute',
      right: 0,
      top: isExpanded ? 39 : 12,
      ...SmoothTransitions,
    }
    return <header style={style} onClick={onExpand}>
      {index}. {step.title}
      {step.isDone ? <Icon name="check-circle" style={iconStyle} /> : null}
    </header>
  }

  renderContent() {
    const {content} = this.props.step
    const style = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 14,
    }
    const pictoStyle = {
      margin: 20,
      width: 45,
    }
    return <div style={style}>
      <img src={require('images/check-list-picto.svg')} style={pictoStyle} />
      <div style={{flex: 1}}>
        <Markdown content={content} />
      </div>
    </div>
  }

  renderFinishForm() {
    const {finishCheckboxCaption, finishLongTextCaption, finishTextCaption} = this.props.step
    const style = {
      borderTop: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      margin: '36px 70px 0',
      padding: '30px 0',
    }
    const caption = finishTextCaption || finishLongTextCaption || 'Où en êtes vous ?'
    return <div style={style}>
      <div style={{color: Colors.CHARCOAL_GREY, fontSize: 15, fontWeight: 500, marginBottom: 15}}>
        {caption}
      </div>
      {finishTextCaption ?
        this.renderFinishTextInput() :
        finishLongTextCaption ?
          this.renderFinishTextarea() :
          this.renderFinishCheckbox(finishCheckboxCaption || '')}
    </div>
  }

  renderFinishTextarea() {
    const buttonStyle = {
      marginTop: 15,
    }
    const textareaStyle = {
      ...Styles.INPUT,
      backgroundColor: '#fff',
      display: 'block',
      minHeight: 200,
      width: '100%',
    }
    return <div style={{position: 'relative'}}>
      <textarea
         style={textareaStyle}
          value={this.state.text} onChange={event => this.setState({text: event.target.value})} />
      <div style={{textAlign: 'right'}}>
        <RoundButton style={buttonStyle} onClick={this.handleValidate} disabled={!this.state.text}>
          Valider
        </RoundButton>
      </div>
    </div>
  }

  renderFinishTextInput() {
    const buttonStyle = {
      height: 30,
      padding: '4px 21px 3px',
      position: 'absolute',
      right: 13,
      top: 13,
    }
    return <div style={{position: 'relative'}}>
      <Input
          style={{backgroundColor: '#fff', height: 56, paddingRight: 100}}
          value={this.state.text} onChange={text => this.setState({text})} />
      <RoundButton style={buttonStyle} onClick={this.handleValidate} disabled={!this.state.text}>
        Valider
      </RoundButton>
    </div>
  }

  renderFinishCheckbox(caption) {
    const {isDone} = this.props.step
    const {isDoneForceChecked} = this.state
    const style = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      borderRadius: 1,
      display: 'flex',
      fontSize: 14,
      height: 56,
      padding: '0 16px',
    }
    return <div style={style}>
      <LabeledToggle
          isSelected={isDone || isDoneForceChecked} label={caption} type="checkbox"
          onClick={this.toggleDone} />
    </div>
  }

  renderLink() {
    const {link, linkName} = this.props.step
    if (!link || !linkName) {
      return null
    }
    return <div style={{marginBottom: 35, textAlign: 'center'}}>
      <ExternalSiteButton href={link}>
        {linkName}
      </ExternalSiteButton>
    </div>
  }

  render() {
    const {isExpanded} = this.props
    const {contentHeight} = this.state
    const style = {
      backgroundColor: isExpanded ? Colors.LIGHT_GREY : 'initial',
      borderBottom: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      padding: '0 50px',
    }
    const contentStyle = {
      maxHeight: isExpanded ? (contentHeight || 'initial') : 0,
      opacity: isExpanded ? 1 : 0,
      overflow: 'hidden',
      ...SmoothTransitions,
    }
    return <div style={style}>
      {this.renderHeader()}
      <ReactHeight
          onHeightReady={contentHeight => this.setState({contentHeight})}
          hidden={!contentHeight && !isExpanded}
          style={contentStyle}>
        {this.renderContent()}
        {this.renderFinishForm()}
        {this.renderLink()}
      </ReactHeight>
    </div>
  }
}
const Step = connect()(StepBase)


class StopStickyActionModal extends React.Component {
  static propTypes = {
    onClose: React.PropTypes.func.isRequired,
    onStop: React.PropTypes.func.isRequired,
  }

  state = {
    feedback: '',
  }

  render() {
    const {onClose, onStop, ...extraProps} = this.props
    const {feedback} = this.state
    const style = {
      color: Colors.SLATE,
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: '17px',
      padding: '0 50px 40px',
      textAlign: 'center',
    }
    const textareaStyle = {
      ...Styles.INPUT,
      backgroundColor: '#fff',
      display: 'block',
      margin: '25px 0 30px',
      minHeight: 110,
      padding: 5,
      width: '100%',
    }
    return <Modal
        {...extraProps} title="Pourquoi arrêter maintenant ?" onClose={onClose}
        style={style}>
      <div style={{maxWidth: 360}}>
        Nous cherchons à nous améliorer sans cesse. Dites nous comment nous
        aurions pu faire mieux pour vous aider.
      </div>
      <textarea
          style={textareaStyle} placeholder="Donnez-nous votre avis" value={feedback}
          onChange={event => this.setState({feedback: event.target.value})}  />
      <div style={{textAlign: 'right'}}>
        <RoundButton type="discreet" onClick={onClose} style={{marginRight: 20}}>
          Annuler
        </RoundButton>
        <RoundButton type="deletion" onClick={() => onStop(feedback)} disabled={!feedback}>
          Arrêter
        </RoundButton>
      </div>
    </Modal>
  }
}


class FinishStickyActionModal extends React.Component {
  static propTypes = {
    onClose: React.PropTypes.func.isRequired,
  }

  render() {
    const {onClose, ...extraProps} = this.props
    const style = {
      color: Colors.SLATE,
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: '17px',
      padding: '0 50px 40px',
      textAlign: 'center',
    }
    return <Modal {...extraProps} style={style} title="Félicitations !">
      <img src={require('images/congrats-ico.svg')} style={{marginTop: 20}} />
      <div style={{margin: '30px 0', maxWidth: 360}}>
        Super, vous avez fini cette action.
        On croise les doigts pour vous&nbsp;!
      </div>
      <div>
        <RoundButton type="validation" onClick={onClose}>
          Faire une nouvelle action
        </RoundButton>
      </div>
    </Modal>
  }
}


export {StickyActionPane}
