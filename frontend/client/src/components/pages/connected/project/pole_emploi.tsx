import _memoize from 'lodash/memoize'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import React from 'react'

import {DispatchAllActions, RootState, markChangelogAsSeen,
  sendChangelogFeedback} from 'store/actions'

import editProjectImage from 'images/changelog/edit-project.png'
import mobileImprovedImage from 'images/changelog/mobile-improved.png'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {Button, RadioGroup, SmoothTransitions, Textarea} from 'components/theme'


interface AdviceProps {
  children?: never
  onChange: (v: object) => void
  state: {
    adviceFeedback?: string
    mode?: 'RENFORCE' | 'GUIDE' | 'SUIVI'
  }
}


class CounselorAdvice extends React.PureComponent<AdviceProps> {
  public static propTypes = {
    onChange: PropTypes.func.isRequired,
    state: PropTypes.shape({
      adviceFeedback: PropTypes.string,
      mode: PropTypes.oneOf(['RENFORCE', 'GUIDE', 'SUIVI']),
    }),
  }

  private handleChange = _memoize((field: string): ((value) => void) =>
    (value): void => this.props.onChange({[field]: value}))

  public render(): React.ReactNode {
    const {state} = this.props
    const {adviceFeedback, mode} = state
    const quoteStyle: React.CSSProperties = {
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 'bold',
      margin: `0 auto ${isMobileVersion ? '20px' : '40px'}`,
      maxWidth: isMobileVersion ? 'calc(100% - 40px)' : 500,
      textAlign: 'center',
    }
    const textareaStyle: React.CSSProperties = {
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

      <Textarea
        style={textareaStyle}
        placeholder={'Exemple : pour faire le point après plusieurs mois de ' +
          "recherche infructueuse, lorsqu'ils envisagent de faire une formation, " +
          "si leur projet n'est pas bien défini, etc."}
        value={adviceFeedback} onChange={this.handleChange('adviceFeedback')} />

      <div style={{fontSize: 14, fontWeight: 500, margin: '20px 20px 0'}}>
        Vous suivez les chercheurs d'emploi en&nbsp;:
      </div>
      <RadioGroup
        style={{fontSize: 15, justifyContent: 'space-around', margin: '0 20px'}}
        value={mode}
        onChange={this.handleChange('mode')}
        options={[
          {name: 'Renforcé', value: 'RENFORCE'},
          {name: 'Guidé', value: 'GUIDE'},
          {name: 'Suivi', value: 'SUIVI'},
        ]} />
    </div>
  }
}


type Step = {
  changelog: string
  isNewFeature?: true
  subtitle?: string
  title?: string
} & (
  {
    caption?: never
    component: React.ComponentType<AdviceProps>
    image?: never
  } | {
    caption: string
    component?: never
    image: string
  }
)


// changelog fields in the steps must be sortable (we keep the last one the
// user saw) and comparable to timestamps.
const steps: readonly Readonly<Step>[] = [
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
    subtitle: `Vous êtes conseiller Pôle emploi ? Nous travaillons sur un
      conseil ${config.productName} pour mieux rediriger les chercheurs d'emploi vers leur
      conseiller.`,
    title: 'Aidez-nous en répondant à cette question',
  },
] as const


interface ModalConnectedProps {
  latestChangelogSeen: string
}


interface ModalProps
  extends ModalConnectedProps, Omit<ModalConfig, 'onHidden' | 'title' | 'style' | 'children'> {
  children?: never
  dispatch: DispatchAllActions
  onClose: () => void
  projectCreatedAt: string
}


interface ModalState {
  onHidden?: (() => void) | null
  stepIndex?: number
  stepState?: object
}


class PoleEmploiChangelogModalBase extends React.PureComponent<ModalProps, ModalState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    latestChangelogSeen: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    projectCreatedAt: PropTypes.string.isRequired,
  }

  public state = {
    onHidden: null,
    stepIndex: 0,
    stepState: {},
  }

  private handleStepStateChange = (state): void =>
    this.setState(({stepState}): ModalState => ({stepState: {...stepState, ...state}}))

  private handleClose = _memoize((step): (() => void) => (): void => {
    const {dispatch, onClose} = this.props
    this.setState({onHidden: (): void => {
      const stateJson = JSON.stringify(this.state.stepState)
      if (stateJson !== '{}') {
        dispatch(sendChangelogFeedback({feedback: stateJson}))
      }
      this.setState({stepIndex: 0, stepState: {}})
      dispatch(markChangelogAsSeen(step.changelog))
    }})
    onClose()
  }, ({changelog}): string => changelog)

  private handleNextStep = (): void =>
    this.setState(({stepIndex}): ModalState => ({stepIndex: stepIndex + 1}))

  private handleNextOrLastStep = (step, isLastStep): (() => void) =>
    isLastStep ? this.handleClose(step) : this.handleNextStep

  private handleStepIndexChange = _memoize((stepIndex): (() => void) =>
    (): void => this.setState({stepIndex}))

  private renderStep({component, image, isNewFeature, caption}: Readonly<Step>): React.ReactNode {
    if (component) {
      const StepComponent = component
      return <StepComponent state={this.state.stepState} onChange={this.handleStepStateChange} />
    }
    const style: React.CSSProperties = {
      fontSize: 14,
      fontWeight: 'bold',
      position: 'relative',
      textAlign: 'center',
    }
    const newStyle: React.CSSProperties = {
      color: colors.GREENISH_TEAL,
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

  public render(): React.ReactNode {
    const {latestChangelogSeen, projectCreatedAt, ...extraProps} = this.props
    const {onHidden, stepIndex} = this.state
    const latestVersionSeen = (latestChangelogSeen && latestChangelogSeen > projectCreatedAt) ?
      latestChangelogSeen : projectCreatedAt
    const shownSteps = steps.filter(({changelog}): boolean => changelog > latestVersionSeen)
    if (!shownSteps || stepIndex >= shownSteps.length) {
      return null
    }
    const isLastStep = stepIndex === shownSteps.length - 1
    const step = shownSteps[stepIndex]
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      borderRadius: isMobileVersion ? 15 : 0,
      display: 'flex',
      flexDirection: 'column',
      height: isMobileVersion ? 'initial' : 640,
      width: isMobileVersion ? 'calc(100% - 40px)' : 700,
    }
    const bulletStyle = (isSelected: boolean): React.CSSProperties => ({
      backgroundColor: isSelected ? colors.PINKISH_GREY : '#fff',
      border: `solid 1px ${colors.PINKISH_GREY}`,
      borderRadius: 20,
      cursor: 'pointer',
      display: 'inline-block',
      height: 7,
      margin: 5,
      width: 7,
      ...SmoothTransitions,
    })
    return <Modal
      title={step.title || `Nous avons mis à jour ${config.productName} !`} style={containerStyle}
      onHidden={onHidden} {...extraProps}>
      <FastForward onForward={this.handleNextOrLastStep(step, isLastStep)} />
      <div style={{fontSize: 14, lineHeight: 1.8, maxWidth: 450, textAlign: 'center'}}>
        {step.subtitle || `Dans le but d'améliorer notre accompagnement nous
          avons apporté quelques améliorations à ${config.productName} :`}
      </div>
      <div style={{alignItems: 'center', display: 'flex', flex: 1}}>
        {this.renderStep(step)}
      </div>
      <Button onClick={this.handleNextOrLastStep(step, isLastStep)}>
        {isLastStep ? 'Terminer' : 'Suivant'}
      </Button>
      <div style={{margin: 15}}>
        {shownSteps.map((unused, index): React.ReactNode => <span
          style={bulletStyle(index === stepIndex)}
          key={`bullet-${index}`} onClick={this.handleStepIndexChange(index)} />)}
      </div>
    </Modal>
  }
}
const PoleEmploiChangelogModal = connect(({user}: RootState): ModalConnectedProps => ({
  latestChangelogSeen: user.latestChangelogSeen,
}))(PoleEmploiChangelogModalBase)


export {PoleEmploiChangelogModal}
