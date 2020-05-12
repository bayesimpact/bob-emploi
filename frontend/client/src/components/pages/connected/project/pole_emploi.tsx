import {connect} from 'react-redux'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {DispatchAllActions, RootState, markChangelogAsSeen,
  sendChangelogFeedback} from 'store/actions'

import editProjectImage from 'images/changelog/edit-project.png'
import mobileImprovedImage from 'images/changelog/mobile-improved.png'
import {useFastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {Button, RadioGroup, SmoothTransitions, Textarea} from 'components/theme'


const DE_FOLLOWING_METHOD_OPTIONS = [
  {name: 'Renforcé', value: 'RENFORCE'},
  {name: 'Guidé', value: 'GUIDE'},
  {name: 'Suivi', value: 'SUIVI'},
] as const

interface AdviceProps {
  children?: never
  onChange: (v: object) => void
  state: {
    adviceFeedback?: string
    mode?: 'RENFORCE' | 'GUIDE' | 'SUIVI'
  }
}


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


const CounselorAdviceBase = (props: AdviceProps): React.ReactElement => {
  const {state: {adviceFeedback, mode}, onChange} = props
  const changeFeedback = useCallback(
    (adviceFeedback: string): void => onChange({adviceFeedback}),
    [onChange])
  const changeMode = useCallback(
    (mode: string): void => onChange({mode}),
    [onChange])
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
      value={adviceFeedback} onChange={changeFeedback} />

    <div style={{fontSize: 14, fontWeight: 500, margin: '20px 20px 0'}}>
      Vous suivez les chercheurs d'emploi en&nbsp;:
    </div>
    <RadioGroup<string>
      style={{fontSize: 15, justifyContent: 'space-around', margin: '0 20px'}}
      value={mode}
      onChange={changeMode}
      options={DE_FOLLOWING_METHOD_OPTIONS} />
  </div>
}
CounselorAdviceBase.propTypes = {
  onChange: PropTypes.func.isRequired,
  state: PropTypes.shape({
    adviceFeedback: PropTypes.string,
    mode: PropTypes.oneOf(['RENFORCE', 'GUIDE', 'SUIVI']),
  }),
}
const CounselorAdvice = React.memo(CounselorAdviceBase)


interface StepBulletProps {
  changeStep: (stepIndex: number) => void
  isSelected: boolean
  stepIndex: number
}


const StepBulletBase = (props: StepBulletProps): React.ReactElement => {
  const {changeStep, isSelected, stepIndex} = props
  const onClick = useCallback((): void => changeStep(stepIndex), [changeStep, stepIndex])
  const bulletStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isSelected ? colors.PINKISH_GREY : '#fff',
    border: `solid 1px ${colors.PINKISH_GREY}`,
    borderRadius: 20,
    cursor: 'pointer',
    display: 'inline-block',
    height: 7,
    margin: 5,
    width: 7,
    ...SmoothTransitions,
  }), [isSelected])
  return <span style={bulletStyle} onClick={onClick} />
}
const StepBullet = React.memo(StepBulletBase)


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
  latestChangelogSeen?: string
}


interface ModalProps
  extends ModalConnectedProps, Omit<ModalConfig, 'onHidden' | 'title' | 'style' | 'children'> {
  children?: never
  dispatch: DispatchAllActions
  onClose: () => void
  projectCreatedAt: string
}


const stepStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  position: 'relative',
  textAlign: 'center',
}
const stepNewStyle: React.CSSProperties = {
  color: colors.GREENISH_TEAL,
  fontSize: 10,
  textTransform: 'uppercase',
}
const containerStyle: React.CSSProperties = {
  alignItems: 'center',
  borderRadius: isMobileVersion ? 15 : 0,
  display: 'flex',
  flexDirection: 'column',
  height: isMobileVersion ? 'initial' : 640,
  width: isMobileVersion ? 'calc(100% - 40px)' : 700,
}


const PoleEmploiChangelogModalBase = (props: ModalProps): React.ReactElement|null => {
  const {dispatch, onClose} = props
  const {latestChangelogSeen, projectCreatedAt, ...extraProps} = props
  const [onHidden, setOnHidden] = useState<(() => void)|undefined>(undefined)
  const [stepIndex, setStepIndex] = useState(0)
  const [stepState, setStepState] = useState({})
  const {t} = useTranslation()

  const latestVersionSeen = (latestChangelogSeen && latestChangelogSeen > projectCreatedAt) ?
    latestChangelogSeen : projectCreatedAt
  const shownSteps = steps.filter(({changelog}): boolean => changelog > latestVersionSeen)
  const isLastStep = stepIndex === (shownSteps?.length || 0) - 1
  const step = shownSteps?.[stepIndex]

  const handleStepStateChange = useCallback(
    (state: object): void => setStepState({...stepState, ...state}),
    [stepState],
  )

  const handleClose = useCallback((): void => {
    setOnHidden((): void => {
      const stateJson = JSON.stringify(stepState)
      if (stateJson !== '{}') {
        dispatch(sendChangelogFeedback({feedback: stateJson}, t))
      }
      setStepIndex(0)
      setStepState({})
      dispatch(markChangelogAsSeen(step.changelog))
    })
    onClose()
  }, [dispatch, onClose, step, stepState, t])

  const handleNextStep = useCallback(
    (): void => setStepIndex(stepIndex + 1),
    [stepIndex],
  )

  const handleNextOrLastStep = isLastStep ? handleClose : handleNextStep
  useFastForward(handleNextOrLastStep)

  const stepRender = useMemo((): React.ReactNode => {
    if (!step) {
      return null
    }
    const {component, image, isNewFeature, caption} = step
    if (component) {
      const StepComponent = component
      return <StepComponent state={stepState} onChange={handleStepStateChange} />
    }
    return <div style={stepStyle}>
      {isNewFeature ? <div style={stepNewStyle}>Nouveau</div> : null}
      <div style={{marginBottom: 15}}>{caption}</div>
      <img
        src={image} alt=""
        style={{maxWidth: isMobileVersion ? 'calc(100% - 40px)' : 'initial'}} />
    </div>
  }, [handleStepStateChange, step, stepState])

  if (!step) {
    return null
  }

  return <Modal
    title={step.title || `Nous avons mis à jour ${config.productName} !`} style={containerStyle}
    onHidden={onHidden} {...extraProps}>
    <div style={{fontSize: 14, lineHeight: 1.8, maxWidth: 450, textAlign: 'center'}}>
      {step.subtitle || `Dans le but d'améliorer notre accompagnement nous
        avons apporté quelques améliorations à ${config.productName} :`}
    </div>
    <div style={{alignItems: 'center', display: 'flex', flex: 1}}>
      {stepRender}
    </div>
    <Button onClick={handleNextOrLastStep}>
      {isLastStep ? 'Terminer' : 'Suivant'}
    </Button>
    <div style={{margin: 15}}>
      {shownSteps.map((unused, index): React.ReactNode => <StepBullet
        isSelected={index === stepIndex} key={`bullet-${index}`}
        changeStep={setStepIndex} stepIndex={stepIndex} />)}
    </div>
  </Modal>
}
PoleEmploiChangelogModalBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  latestChangelogSeen: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  projectCreatedAt: PropTypes.string.isRequired,
}
const PoleEmploiChangelogModal = connect(({user}: RootState): ModalConnectedProps => ({
  latestChangelogSeen: user.latestChangelogSeen,
}))(React.memo(PoleEmploiChangelogModalBase))


export {PoleEmploiChangelogModal}
