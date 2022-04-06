import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useImperativeHandle, useRef, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import type {DispatchAllActions} from 'store/actions'
import {dropOutProjectFeedbackAction, projectFeedbackRequested,
  sendProjectFeedback} from 'store/actions'
import {localizeOptions, prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {useSafeDispatch} from 'store/promise'
import {useGender} from 'store/user'

import type {Focusable} from 'hooks/focus'

import Button from 'components/button'
import LikertScale from 'components/likert_scale'
import {Modal} from 'components/modal'
import Textarea from 'components/textarea'
import starIcon from 'images/star.svg'
import greyStarOutlineIcon from 'images/star-outline.svg?stroke=%239596a0'

const prepareTNoExtract = prepareT

type Props = Omit<React.ComponentProps<typeof Modal>, 'children'|'style'|'title'> & {
  isInStarRating?: boolean
  numStars?: number
  project: bayes.bob.Project
}

const somewhatAnswers = [
  {name: prepareT('Pas du tout'), value: 1},
  {name: prepareTNoExtract(''), value: 2},
  {name: prepareT('Assez'), value: 3},
  {name: prepareTNoExtract(''), value: 4},
  {name: prepareT('Beaucoup'), value: 5},
] as const

const modalStyle: React.CSSProperties = {
  maxWidth: 440,
  padding: isMobileVersion ? 20 : 40,
}
const titleStyle: React.CSSProperties = {
  margin: '0 0 20px',
}
const questionContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginBottom: 10,
}
const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  margin: 0,
}
const submitButtonContainerStyle: React.CSSProperties = {
  textAlign: 'center',
}
const textareaStyle: React.CSSProperties = {
  margin: '10px 0',
  minHeight: 100,
}
const errorStyle: React.CSSProperties = {
  color: colors.RED_PINK,
  fontWeight: 'bold',
  margin: 0,
}

const FeedbackModal = (props: Props): React.ReactElement => {
  const {
    isInStarRating, isShown, numStars, onClose, project,
    project: {feedback: projectFeedback}, ...otherProps} = props
  const [feedback, setFeedback] = useState<bayes.bob.ProjectFeedback>(
    {...projectFeedback, score: numStars})
  const [isValidated, setIsValidated] = useState(false)
  const [isInProgress, setIsInProgress] = useState(false)
  const {t} = useTranslation()
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const hasGoodOpinion = (numStars || 0) > 3
  const isDeepFeedbackGiven = !!(
    projectFeedback?.newInfoImproveScore &&
    projectFeedback?.actionPlanHelpsPlanScore &&
    projectFeedback?.motivationScore
  )
  const [isDeepFeedbackRequested, setIsDeepFeedbackRequested] = useState(!isDeepFeedbackGiven)
  useEffect(() => {
    if (!isShown) {
      setIsDeepFeedbackRequested(!isDeepFeedbackGiven)
    }
  }, [isShown, isDeepFeedbackGiven])
  const requiredQuestionsRef = useRef<Focusable>(null)
  const handleSubmit = useCallback(async () => {
    if (isDeepFeedbackRequested && (
      !feedback ||
      !feedback.newInfoImproveScore ||
      !feedback.actionPlanHelpsPlanScore ||
      !feedback.motivationScore)) {
      setIsValidated(true)
      requiredQuestionsRef.current?.focus()
      return
    }
    setIsValidated(false)
    setIsInProgress(true)
    try {
      await dispatch(sendProjectFeedback(project, feedback, t))
    } finally {
      setIsInProgress(false)
    }
    onClose?.()
  }, [dispatch, feedback, isDeepFeedbackRequested, onClose, project, t])
  const handleCancel = useCallback(() => {
    dispatch(dropOutProjectFeedbackAction)
    onClose?.()
  }, [dispatch, onClose])
  useEffect((): void => {
    setFeedback((feedback?: bayes.bob.ProjectFeedback): bayes.bob.ProjectFeedback => ({
      ...feedback,
      score: numStars,
    }))
  }, [numStars])
  useEffect((): void => {
    if (!isShown || project.wasFeedbackRequested || !isDeepFeedbackRequested) {
      return
    }
    dispatch(projectFeedbackRequested(project))
  }, [project, isDeepFeedbackRequested, dispatch, isShown])
  const updatePartialFeedback = useCallback((changes: bayes.bob.ProjectFeedback) => {
    setFeedback((previous?: bayes.bob.ProjectFeedback): bayes.bob.ProjectFeedback => ({
      ...previous,
      ...changes,
    }))
  }, [])
  const updateText = useCallback(
    (text: string) => updatePartialFeedback({text}), [updatePartialFeedback])
  const title = hasGoodOpinion ? t('Wow, merci\u00A0!') :
    t('Comment nous améliorer\u00A0?')
  const subtitle = hasGoodOpinion ?
    t("Qu'avez-vous aimé\u00A0? Nous lisons tous les commentaires\u00A0!") :
    t('Soyez honnête, nous lisons tous les commentaires\u00A0!')

  const titleId = useMemo(_uniqueId, [])

  return <Modal
    {...otherProps}
    title={isInStarRating ? null :
      t('Votre expérience avec {{productName}}', {productName: config.productName})}
    isShown={isShown} style={modalStyle} titleStyle={titleStyle} onClose={handleCancel}
    aria-labelledby={isInStarRating ? titleId : undefined}>
    {isInStarRating ? <GeneralFeedback
      titleId={titleId} score={numStars} title={title} subtitle={subtitle} /> : null}
    {isDeepFeedbackRequested ? <LongFeedbackContent
      feedback={feedback} onChange={updatePartialFeedback} isValidated={isValidated}
      ref={requiredQuestionsRef} /> :
      <ToughFeedbackModal text={feedback?.text || ''} onChangeText={updateText} />}
    <div style={submitButtonContainerStyle}>
      <Button onClick={isInProgress ? undefined : handleSubmit} isProgressShown={isInProgress}>
        {t('Valider mes réponses')}
      </Button>
    </div>
  </Modal>
}

interface LongFeedbackContentProps {
  feedback?: bayes.bob.ProjectFeedback
  isValidated: boolean
  onChange: (changes: bayes.bob.ProjectFeedback) => void
}


const LongFeedbackContentBase = (
  props: LongFeedbackContentProps, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {feedback, isValidated, onChange} = props
  const gender = useGender()
  const {t} = useTranslation()
  const errorMessage = t('Choisissez une option ci-dessus.')
  const updateFeedbackText = useCallback((text: string) => onChange({text}), [onChange])
  const updateHelpsPlanScore = useCallback(
    (actionPlanHelpsPlanScore) => onChange({actionPlanHelpsPlanScore}),
    [onChange])
  const updateNewInfoScore = useCallback(
    (newInfoImproveScore: number) => onChange({newInfoImproveScore}),
    [onChange])
  const updateMotivationScore = useCallback(
    (motivationScore) => onChange({motivationScore}),
    [onChange])
  const actionPlanHelpsPlanId = useMemo(_uniqueId, [])
  const errorHelpsPlanId = useMemo(_uniqueId, [])
  const helpsPlanQuestionRef = useRef<Focusable>(null)
  const newInfoId = useMemo(_uniqueId, [])
  const errorNewInfoId = useMemo(_uniqueId, [])
  const newInfoQuestionRef = useRef<Focusable>(null)
  const motivationId = useMemo(_uniqueId, [])
  const errorMotivationId = useMemo(_uniqueId, [])
  const motivationQuestionRef = useRef<Focusable>(null)
  const textareaId = useMemo(_uniqueId, [])
  const translatedSomewhatAnswers = useMemo(() => localizeOptions(t, somewhatAnswers), [t])
  // Focus on first question with an error.
  useImperativeHandle(ref, (): Focusable => ({focus: () => {
    if (!feedback?.actionPlanHelpsPlanScore) {
      helpsPlanQuestionRef.current?.focus()
      return
    }
    if (!feedback?.newInfoImproveScore) {
      newInfoQuestionRef.current?.focus()
      return
    }
    if (!feedback.motivationScore) {
      motivationQuestionRef.current?.focus()
      return
    }
  }}))
  return <React.Fragment>
    <p>{t('* Champs obligatoires')}</p>
    <div style={questionContainerStyle}>
      <label htmlFor={actionPlanHelpsPlanId} style={labelStyle}>{t(
        "Vous sentez-vous plus capable de planifier votre recherche d'emploi après avoir " +
        'utilisé {{productName}}\u00A0?',
        {productName: config.productName},
      )}&nbsp;*</label>
      <LikertScale
        onChange={updateHelpsPlanScore} value={feedback?.actionPlanHelpsPlanScore}
        scale={translatedSomewhatAnswers} id={actionPlanHelpsPlanId}
        ref={helpsPlanQuestionRef} aria-required={true}
        aria-invalid={isValidated && !feedback?.actionPlanHelpsPlanScore}
        aria-describedby={isValidated && !feedback?.actionPlanHelpsPlanScore ?
          errorHelpsPlanId : undefined} />
      {isValidated && !feedback?.actionPlanHelpsPlanScore ?
        <p style={errorStyle} id={errorHelpsPlanId}>{errorMessage}</p> : null}
    </div>
    <div style={questionContainerStyle}>
      <label style={labelStyle} htmlFor={newInfoId}>{t(
        'Avez-vous appris de nouvelles informations sur la façon dont vous pouvez améliorer ' +
        "votre recherche d'emploi\u00A0?",
      )}&nbsp;*</label>
      <LikertScale
        onChange={updateNewInfoScore} value={feedback?.newInfoImproveScore}
        scale={translatedSomewhatAnswers} id={newInfoId}
        ref={newInfoQuestionRef} aria-required={true}
        aria-invalid={isValidated && !feedback?.newInfoImproveScore}
        aria-describedby={isValidated && !feedback?.newInfoImproveScore ?
          errorNewInfoId : undefined} />
      {isValidated && !feedback?.newInfoImproveScore ?
        <p style={errorStyle} id={errorNewInfoId}>{errorMessage}</p> : null}
    </div>
    <div style={questionContainerStyle}>
      <label htmlFor={motivationId} style={labelStyle}>{t(
        "Vous sentez-vous plus motivé·e pour avancer dans votre recherche d'emploi après avoir " +
        'utilisé {{productName}}\u00A0?',
        {context: gender, productName: config.productName},
      )}&nbsp;*</label>
      <LikertScale
        onChange={updateMotivationScore}
        value={feedback?.motivationScore}
        scale={translatedSomewhatAnswers}
        id={motivationId} aria-required={true}
        ref={motivationQuestionRef}
        aria-invalid={isValidated && !feedback?.motivationScore}
        aria-describedby={isValidated && !feedback?.motivationScore ?
          errorMotivationId : undefined} />
      {isValidated && !feedback?.motivationScore ?
        <p style={errorStyle} id={errorMotivationId}>{errorMessage}</p> : null}
    </div>
    <div style={questionContainerStyle}>
      <label htmlFor={textareaId} style={labelStyle}>{t(
        'Voudriez-vous nous en dire plus sur votre expérience avec {{productName}}\u00A0?',
        {productName: config.productName},
      )}</label>
      <Textarea
        value={feedback?.text || ''} onChange={updateFeedbackText} style={textareaStyle}
        id={textareaId} />
    </div>
  </React.Fragment>
}
const LongFeedbackContent = React.memo(React.forwardRef(LongFeedbackContentBase))

interface GeneralFeedbackProps {
  score?: number
  subtitle: string
  title: string
  titleId?: string
}

const starStyle: React.CSSProperties = {
  height: 20,
}
const darkStarStyle: React.CSSProperties = {
  ...starStyle,
  filter: 'brightness(0)',
}

const GeneralFeedbackBase = (
  {score = 0, subtitle, title, titleId}: GeneralFeedbackProps): React.ReactElement => {
  const {t} = useTranslation()
  return <div style={{display: 'flex', flexDirection: 'column', marginBottom: 30}}>
    <div style={{display: 'flex'}}>
      {Array.from({length: 5}, (unused, index): React.ReactNode => <img
        style={(score > 3 || index >= score) ? starStyle : darkStarStyle}
        alt={index ? '' : t('{{numStars}} étoile', {count: score, numStars: score})}
        src={(index < score) ? starIcon : greyStarOutlineIcon}
        key={index} />)}
    </div>
    <h2 style={{fontSize: 16, fontWeight: 'bold', margin: '6px 0 0'}} id={titleId}>{title}</h2>
    <p style={{fontSize: 14, margin: 0, opacity: '50%', paddingTop: 6}}>
      {subtitle}
    </p>
  </div>
}
const GeneralFeedback = React.memo(GeneralFeedbackBase)


interface ToughFeedbackModalProps {
  onChangeText: (text: string) => void
  text?: string
}

const textAreaStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_BLUE,
  border: 'none',
  borderRadius: 3,
  fontSize: 15,
  marginBottom: 30,
  minHeight: 120,
  padding: 15,
  width: '100%',
}
const ToughFeedbackModalBase = (props: ToughFeedbackModalProps): React.ReactElement|null => {
  const {onChangeText, text} = props
  const {t} = useTranslation()
  return <React.Fragment>
    <Textarea
      style={textAreaStyle} placeholder={t('Saisissez un commentaire ici (Facultatif)')}
      value={text} onChange={onChangeText} />
  </React.Fragment>
}
const ToughFeedbackModal = React.memo(ToughFeedbackModalBase)

export default React.memo(FeedbackModal)
