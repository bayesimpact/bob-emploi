import React from 'react'
import {connect} from 'react-redux'

import {stickyProgress} from 'store/action'
import {finishStickyActionStep, stopStickyAction} from 'store/actions'

import {Modal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {Pane} from 'components/pane'
import {Colors, ExternalSiteButton, Icon, Input, LabeledToggle, Markdown,
        RoundButton, SmoothTransitions, Styles} from 'components/theme'


class StickyActionPaneBase extends React.Component {
  static propTypes = {
    action: React.PropTypes.object,
    dispatch: React.PropTypes.func.isRequired,
    onClose: React.PropTypes.func.isRequired,
  }

  state = {
    isStopActionModalShown: false,
  }

  handleStopStickyAction = feedback => {
    const {action, dispatch, onClose} = this.props
    dispatch(stopStickyAction(action, feedback))
    onClose()
  }

  renderDoneNode() {
    return <Congratulations
        submitCaption="Faire une autre action"
        onSubmit={this.props.onClose}>
      Super, vous avez fini cette action.
      On croise les doigts pour vous&nbsp;!
   </Congratulations>
  }

  render() {
    const {action, onClose, ...extraProps} = this.props
    const {isStopActionModalShown} = this.state
    return <Pane {...extraProps} onClose={onClose} style={{width: '50vw'}}>
      <StopStickyActionModal
          isShown={isStopActionModalShown}
          onClose={() => this.setState({isStopActionModalShown: false})}
          onStop={this.handleStopStickyAction} />
      <StickyAction
          action={action}
          onStop={() => this.setState({isStopActionModalShown: true})}
          doneNode={this.renderDoneNode()} />
    </Pane>
  }
}
const StickyActionPane = connect()(StickyActionPaneBase)


class StickyActionPage extends React.Component {
  static propTypes = {
    action: React.PropTypes.object,
    onDone: React.PropTypes.func.isRequired,
    onStop: React.PropTypes.func.isRequired,
  }

  renderDoneNode() {
    return <Congratulations
        submitCaption="Commencer maintenant"
        onSubmit={this.props.onDone}>
      Vous êtes sur la bonne voie pour commencer votre nouveau métier. Nous
      allons maintenant vous accompagner quotidiennement en vous proposant
      <strong> des astuces et des offres</strong> qui vous aideront à retrouver
      un emploi le plus vite possible.
   </Congratulations>
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {action, onDone, onStop, ...extraProps} = this.props
    const pageStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
      margin: '50px auto',
      width: 720,
    }
    return <PageWithNavigationBar {...extraProps} isContentScrollable={true}>
      <div style={pageStyle}>
        <StickyAction action={action} onStop={onStop} doneNode={this.renderDoneNode()} />
      </div>
    </PageWithNavigationBar>
  }
}


class StickyAction extends React.Component {
  static propTypes = {
    action: React.PropTypes.object,
    // Node rendered at the bottom of all steps when the last step is done.
    doneNode: React.PropTypes.node,
    onStop: React.PropTypes.func.isRequired,
  }

  state = {
    expandedStepIndex: -1,
    isConfirmStopModalShown: false,
    isDoneFooterShown: false,
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
      this.setState({isDoneFooterShown: true})
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
        <RoundButton
            onClick={() => this.setState({isConfirmStopModalShown: true})}
            type="discreet">
          Arrêter cette action
        </RoundButton>
      </div>}
    </section>
  }

  renderDoneFooter() {
    if (!this.state.isDoneFooterShown) {
      return null
    }
    return this.props.doneNode
  }

  render() {
    const {action, onStop} = this.props
    const {expandedStepIndex, lastExpandableStepIndex} = this.state
    return <div>
      <ConfirmStopModal
          isShown={this.state.isConfirmStopModalShown}
          onClose={() => this.setState({isConfirmStopModalShown: false})}
          onStop={onStop} actionGoal={action.shortGoal ? ('pour ' + action.shortGoal) : ''} />
      {this.renderHeader()}
      {this.renderProgress()}
      {(action && action.steps || []).map((step, index) => <Step
          key={index} index={index + 1} step={step}
          onExpand={index > lastExpandableStepIndex ? null :
            () => this.setState({expandedStepIndex: index})}
          isExpanded={index === expandedStepIndex} />)}
      {this.renderDoneFooter()}
    </div>
  }
}


class ConfirmStopModal extends React.Component {
  static propTypes = {
    actionGoal: React.PropTypes.string,
    onClose: React.PropTypes.func.isRequired,
    onStop: React.PropTypes.func.isRequired,
  }

  render() {
    const {actionGoal, onClose, onStop, ...extraProps} = this.props
    const style = {
      color: Colors.SLATE,
      fontSize: 14,
      lineHeight: 1.21,
      padding: '0 50px 35px',
      textAlign: 'center',
      width: 480,
    }
    return <Modal
        onClose={onClose} {...extraProps} title="Voulez-vous vraiment arrêter&nbsp;?"
        style={style} titleStyle={{marginBottom: 20}}>
      Si vous vous arrêtez maintenant, les actions que vous avez
      entreprises {actionGoal} seront perdues.
      <div style={{marginTop: 35, textAlign: 'right'}}>
        <RoundButton type="discreet" onClick={onClose} style={{marginRight: 15}}>
          Annuler
        </RoundButton>
        <RoundButton type="deletion" onClick={onStop}>
          Oui, je veux arrêter
        </RoundButton>
      </div>
    </Modal>
  }
}


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
      border: 'solid 1px ' + Colors.MODAL_PROJECT_GREY,
      borderRadius: 1,
      display: 'flex',
    }
    const labelStyle = {
      backgroundColor: '#fff',
      color: Colors.CHARCOAL_GREY,
      flex: 1,
      fontSize: 14,
      marginBottom: null,
      padding: '20px 16px',
    }
    return <div style={style}>
      <LabeledToggle
          isSelected={isDone || isDoneForceChecked} label={caption} type="checkbox"
          onClick={this.toggleDone} style={labelStyle} />
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
      <div style={contentStyle}>
        {this.renderContent()}
        {this.renderFinishForm()}
        {this.renderLink()}
      </div>
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


class Congratulations extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    onSubmit: React.PropTypes.func.isRequired,
    submitCaption: React.PropTypes.string.isRequired,
  }

  render() {
    const {children, onSubmit, submitCaption} = this.props
    const style = {
      backgroundColor: Colors.LIGHT_GREY,
      color: Colors.SLATE,
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: '17px',
      padding: 50,
      textAlign: 'center',
    }
    return <div style={style}>
      <div style={{color: Colors.DARK, fontSize: 25}}>
        Félicitations&nbsp;!
      </div>
      <img src={require('images/congrats-ico.svg')} style={{marginTop: 20}} />
      <div style={{margin: '30px auto', maxWidth: 360}}>
        {children}
      </div>
      <div>
        <RoundButton type="validation" onClick={onSubmit}>
          {submitCaption}
        </RoundButton>
      </div>
    </div>
  }
}


export {StickyActionPane, StickyActionPage}
