import _uniqueId from 'lodash/uniqueId'
import HeartOutlineIcon from 'mdi-react/HeartOutlineIcon'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import {prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import EvalButtons from 'components/eval_buttons'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import {Routes} from 'components/url'

import type {DispatchAllUpskillingActions} from '../store/actions'
import {closeSelectModalAction, selectUpskillingJob} from '../store/actions'
import Modal from './modal'

const interestScale = [
  {emoji: '👎', evaluation: 'NO', evaluationText: prepareT('Pas du tout')},
  {emoji: '🙂', evaluation: 'SOME', evaluationText: prepareT('Un peu')},
  {emoji: '😁', evaluation: 'YES', evaluationText: prepareT('Beaucoup')},
] as const
const trainingWillScale = [
  {emoji: '👎', evaluation: 'NO', evaluationText: prepareT('Pas du tout')},
  {emoji: '🤔', evaluation: 'MAYBE', evaluationText: prepareT('Peut-être')},
  {emoji: '😁', evaluation: 'YES', evaluationText: prepareT('Oui')},
] as const

const modalStyle: React.CSSProperties = {
  marginTop: 40,
  maxWidth: '83vw',
  padding: 25,
}
const saveButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.EVALUATION_VALIDATE_BACKGROUND_BUTTON,
  border: `1px solid ${colors.EVALUATION_BUTTON_BORDER}`,
  boxShadow: 'none',
  color: colors.EVALUATION_BUTTON_TEXT,
  display: 'flex',
  fontSize: 14,
  fontWeight: 'bold',
  margin: 'auto',
  padding: 11,
  // TODO(émilie): Find a larger resolution to remove the text shadows if needed.
  textShadow: 'none',
  ...config.hasRoundEdges ? {borderRadius: 100} : {},
}
const evalButtonStyle: React.CSSProperties = {
  background: colorToAlpha(colors.EVALUATION_BACKGROUND_BUTTON, .1),
  borderColor: colors.EVALUATION_BUTTON_BORDER,
  color: colors.TEXT,
  minWidth: isMobileVersion ? 85 : 133,
}
const evalButtonSelectedStyle: React.CSSProperties = {
  ...evalButtonStyle,
  background: colors.EVALUATION_SELECTED_BACKGROUND_BUTTON,
  color: colors.EVALUATION_SELECTED_BUTTON_COLOR,
}
const cookiesMessageStyle: React.CSSProperties = {
  margin: '10px 0 0',
  opacity: .75,
  textAlign: 'center',
}
const discreetLinkStyle: React.CSSProperties = {
  color: 'inherit',
  fontWeight: 'bold',
}

interface SectionProps {
  children: React.ReactNode
  title: string
  titleId?: string
}

const EvalSection = ({children, title, titleId}: SectionProps) =>
  <section style={{marginBottom: isMobileVersion ? 30 : 20}}>
    <p style={{margin: '1em 0'}} id={titleId}>{title}</p>
    {children}
  </section>
const Section = React.memo(EvalSection)


export interface Submitable {
  submit: () => void
}

interface EvalProps {
  job?: ValidUpskillingJob
  sectionId?: string
  visualElement: 'netflix' | 'explorer' | 'coaching'
}
const JobEvalButtonsBase = ({job, sectionId, visualElement}: EvalProps, ref: React.Ref<Submitable>):
React.ReactElement => {
  const dispatch = useDispatch()
  const {t} = useTranslation()
  const [interest, setInterest] = useState('')
  const [trainingWill, setTrainingWill] = useState('')
  const jobGroupId = job?.jobGroup.romeId
  useEffect(() => {
    if (!jobGroupId) {
      return
    }
    setInterest('')
    setTrainingWill('')
  }, [jobGroupId])
  const saveJob = useCallback(() => {
    if (!job || !sectionId) {
      return
    }
    dispatch(selectUpskillingJob(
      visualElement, job, sectionId, {
        ...interest && {interest},
        ...trainingWill && {trainingWill},
      }))
  }, [dispatch, job, interest, sectionId, visualElement, trainingWill])
  const interestQuestionId = useMemo(_uniqueId, [])
  const trainingWillQuestionId = useMemo(_uniqueId, [])
  useImperativeHandle(ref, (): Submitable => ({submit: saveJob}))
  return <React.Fragment>
    <Section title={t('Ce métier vous intéresse\u00A0?')} titleId={interestQuestionId}>
      <EvalButtons
        evaluation={interest} onScoreChange={setInterest} scale={interestScale}
        buttonStyle={evalButtonStyle} buttonSelectedStyle={evalButtonSelectedStyle}
        aria-labelledby={interestQuestionId} />
    </Section>
    <Section
      title={t('Seriez-vous prêt·e à vous former pour ce métier\u00A0?')}
      titleId={trainingWillQuestionId}>
      <EvalButtons
        evaluation={trainingWill} onScoreChange={setTrainingWill} scale={trainingWillScale}
        buttonStyle={evalButtonStyle} buttonSelectedStyle={evalButtonSelectedStyle}
        aria-labelledby={trainingWillQuestionId} />
    </Section>
  </React.Fragment>
}
const JobEvalButtons = React.forwardRef(JobEvalButtonsBase)


const maxWidth = isMobileVersion ? 255 : 400
const titleStyle = {
  fontSize: '1em',
  margin: 0,
  maxWidth,
}

const JobEvaluationModal = (): React.ReactElement|null => {
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const [job, sectionId] = useSelector(
    ({app: {upskillingEvaluatingJob}}: RootState) => upskillingEvaluatingJob,
    (job, otherJob) => job?.[0].jobGroup.romeId === otherJob?.[0].jobGroup.romeId,
  ) || []
  const visualElement: 'netflix' | 'explorer' = useSelector(
    ({app: {upskillingJobExplored}}: RootState) => upskillingJobExplored ? 'explorer' : 'netflix')

  const {jobGroup: {samples: [{name: jobName = ''} = {}] = []} = {}} = job || {}
  const ref = useRef<Submitable>(null)
  const closeModal = useCallback(() => dispatch(closeSelectModalAction), [dispatch])
  const onSubmit = useCallback(() => {
    ref.current?.submit()
    closeModal()
  }, [closeModal])
  const titleId = useMemo(_uniqueId, [])
  return <Modal isShown={!!job} style={modalStyle} onClose={closeModal} aria-labelledby={titleId}>
    <h3 id={titleId} style={titleStyle}>{config.isSelectedFavoriteWording ?
      t('Ajouter "{{jobName}}" aux favoris', {jobName}) :
      t('Ajouter "{{jobName}}" à ma sélection', {jobName})}</h3>
    <form onSubmit={onSubmit} style={{fontSize: 16, maxWidth}}>
      <JobEvalButtons ref={ref} {...{job, sectionId, visualElement}} />
      <Button
        onClick={onSubmit} style={saveButtonStyle} type="navigation" aria-describedby={titleId}>
        <HeartOutlineIcon size={16} style={{marginRight: 8}} aria-hidden={true} focusable={false} />
        {config.isSelectedFavoriteWording ? t('Ajouter aux favoris') : t('Ajouter à ma sélection')}
      </Button>
      <Trans style={cookiesMessageStyle} parent="p">
        Cette fonctionnalité utilise les <ExternalLink
          href={Routes.COOKIES_PAGE} style={discreetLinkStyle}>
          cookies
        </ExternalLink> de cet appareil.
      </Trans>
    </form>
  </Modal>
}

export {Section as EvalSection, JobEvalButtons}
export default React.memo(JobEvaluationModal)
