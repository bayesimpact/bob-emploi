import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import React from 'react'

import config from 'config'

import {markChangelogAsSeen, sendChangelogFeedback} from 'store/actions'

import editProjectImage from 'images/changelog/edit-project.png'
import mobileImprovedImage from 'images/changelog/mobile-improved.png'
import {Modal} from 'components/modal'
import {ShortKey} from 'components/shortkey'
import {Button, Colors, RadioGroup, SmoothTransitions} from 'components/theme'


class CounselorAdvice extends React.Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    state: PropTypes.shape({
      adviceFeedback: PropTypes.string,
      mode: PropTypes.oneOf(['RENFORCE', 'GUIDE', 'SUIVI']),
    }),
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {onChange, state} = this.props
    const {isMobileVersion} = this.context
    const {adviceFeedback, mode} = state
    const quoteStyle = {
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 'bold',
      margin: `0 auto ${isMobileVersion ? '20px' : '40px'}`,
      maxWidth: isMobileVersion ? 'calc(100% - 40px)' : 500,
      textAlign: 'center',
    }
    const textareaStyle = {
      display: 'block',
      fontSize: 14,
      height: 180,
      lineHeight: 1.9,
      margin: 'auto',
      padding: 15,
      width: isMobileVersion ? 'calc(100% - 40px)' : 500,
    }
    return <div>
      <div style={quoteStyle}>
        Dans quelles situations devrions-nous recommander à nos
        utilisateurs de prendre contact avec vous&nbsp;?
      </div>

      <textarea
        style={textareaStyle}
        placeholder={'Exemple : pour faire le point après plusieurs mois de ' +
          "recherche infructueuse, lorsqu'ils envisagent de faire une formation, " +
          "si leur projet n'est pas bien défini, etc."}
        value={adviceFeedback} onChange={event => onChange({adviceFeedback: event.target.value})} />

      <div style={{fontSize: 14, fontWeight: 500, margin: '20px 20px 0'}}>
        Vous suivez les chercheurs d'emploi en&nbsp;:
      </div>
      <RadioGroup
        style={{fontSize: 15, justifyContent: 'space-around', margin: '0 20px'}}
        value={mode}
        onChange={mode => onChange({mode})}
        options={[
          {name: 'Renforcé', value: 'RENFORCE'},
          {name: 'Guidé', value: 'GUIDE'},
          {name: 'Suivi', value: 'SUIVI'},
        ]} />
    </div>
  }
}


// changelog fields in the steps must be sortable (we keep the last one the
// user saw) and comparable to timestamps.
const steps = [
  {
    caption: 'Vous pouvez maintenant modifier votre projet',
    changelog: '2017-06-12',
    image: editProjectImage,
    isNewFeature: true,
  },
  {
    caption: 'Amélioration de la version mobile',
    changelog: '2017-06-17',
    image: mobileImprovedImage,
  },
  {
    changelog: '2017-06-18',
    component: CounselorAdvice,
    subtitle: `Vous êtes conseiller Pôle Emploi ? Nous travaillons sur un
      conseil Bob pour mieux rediriger les chercheurs d'emploi vers leur
      conseiller.`,
    title: 'Aidez-nous en répondant à cette question',
  },
]


class PoleEmploiChangelogModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    latestChangelogSeen: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    projectCreatedAt: PropTypes.string.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    onHidden: null,
    stepIndex: 0,
    stepState: {},
  }

  renderStep({component, image, isNewFeature, caption}) {
    if (component) {
      const StepComponent = component
      return <StepComponent
        state={this.state.stepState}
        onChange={state => this.setState({stepState: {...this.state.stepState, ...state}})} />
    }
    const {isMobileVersion} = this.context
    const style = {
      color: Colors.DARK_TWO,
      fontSize: 14,
      fontWeight: 'bold',
      position: 'relative',
      textAlign: 'center',
    }
    const newStyle = {
      color: Colors.GREENISH_TEAL,
      fontSize: 10,
      textTransform: 'uppercase',
    }
    return <div style={style}>
      {isNewFeature ? <div style={newStyle}>Nouveau</div> : null}
      <div style={{marginBottom: 15}}>{caption}</div>
      <img
        src={image} alt=""
        style={{maxWidth: isMobileVersion ? 'calc(100% - 40px)' : 'initial'}} />
    </div>
  }

  render() {
    const {dispatch, latestChangelogSeen, onClose, projectCreatedAt, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const {onHidden, stepIndex} = this.state
    const latestVersionSeen = (latestChangelogSeen && latestChangelogSeen > projectCreatedAt) ?
      latestChangelogSeen : projectCreatedAt
    const shownSteps = steps.filter(({changelog}) => changelog > latestVersionSeen)
    if (!shownSteps || stepIndex >= shownSteps.length) {
      return null
    }
    const isLastStep = stepIndex === shownSteps.length - 1
    const step = shownSteps[stepIndex]
    const containerStyle = {
      alignItems: 'center',
      borderRadius: isMobileVersion ? 15 : 0,
      color: Colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      height: isMobileVersion ? 'initial' : 640,
      width: isMobileVersion ? 'calc(100% - 40px)' : 700,
    }
    const bulletStyle = isSelected => ({
      backgroundColor: isSelected ? Colors.PINKISH_GREY : '#fff',
      border: `solid 1px ${Colors.PINKISH_GREY}`,
      borderRadius: 20,
      cursor: 'pointer',
      display: 'inline-block',
      height: 7,
      margin: 5,
      width: 7,
      ...SmoothTransitions,
    })
    const close = () => {
      this.setState({onHidden: () => {
        const stateJson = JSON.stringify(this.state.stepState)
        if (stateJson !== '{}') {
          dispatch(sendChangelogFeedback(stateJson))
        }
        this.setState({stepIndex: 0, stepState: {}})
        dispatch(markChangelogAsSeen(step.changelog))
      }})
      onClose()
    }
    const nextStep = () => isLastStep ? close() : this.setState({stepIndex: stepIndex + 1})
    return <Modal
      title={step.title || `Nous avons mis à jour ${config.productName} !`} style={containerStyle}
      onHidden={onHidden} {...extraProps}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={nextStep} />
      <div style={{fontSize: 14, lineHeight: 1.8, maxWidth: 450, textAlign: 'center'}}>
        {step.subtitle || `Dans le but d'améliorer notre accompagnement nous
          avons apporté quelques améliorations à ${config.productName} :`}
      </div>
      <div style={{alignItems: 'center', display: 'flex', flex: 1}}>
        {this.renderStep(step)}
      </div>
      <Button onClick={nextStep}>
        {isLastStep ? 'Terminer' : 'Suivant'}
      </Button>
      <div style={{margin: 15}}>
        {shownSteps.map((unused, index) => <span
          style={bulletStyle(index === stepIndex)}
          key={`bullet-${index}`} onClick={() => this.setState({stepIndex: index})} />)}
      </div>
    </Modal>
  }
}
const PoleEmploiChangelogModal = connect(({user}) => ({
  latestChangelogSeen: user.latestChangelogSeen,
}))(PoleEmploiChangelogModalBase)


export {PoleEmploiChangelogModal}
