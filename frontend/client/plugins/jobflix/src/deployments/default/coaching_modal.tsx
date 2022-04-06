import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import type {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useSafeDispatch} from 'store/promise'
import {validateEmail} from 'store/validations'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import Input from 'components/input'
import type {ModalConfig} from 'components/modal'
import Textarea from 'components/textarea'

import type {DispatchAllUpskillingActions} from '../../store/actions'
import {closeCoachingModalAction, registerCoachingUpskillingAction,
  saveUpskillingUserAction, typeCoachingEmailUpskillingAction} from '../../store/actions'
import Modal from '../../components/modal'
import type {Submitable} from '../../components/job_evaluation'
import {EvalSection, JobEvalButtons} from '../../components/job_evaluation'


const modalStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_BACKGROUND,
  color: colors.TEXT,
  fontSize: 15,
  margin: isMobileVersion ? 20 : 10,
  padding: 40,
}
const OKModalStyle: React.CSSProperties = {
  ...modalStyle,
  fontSize: 21,
  fontWeight: 'bold',
  maxWidth: 480,
}
const whoDivStyle: React.CSSProperties = {
  color: colors.JOB_DESCRIPTION_TEXT,
  fontSize: 12,
  fontStyle: 'italic',
  marginTop: 20,
  textAlign: 'center',
}
const discreetLinkStyle: React.CSSProperties = {
  color: 'inherit',
}
const inputStyle: React.CSSProperties = {
  backgroundColor: colorToAlpha(colors.WARM_GREY, .1),
  borderRadius: 4,
  color: 'inherit',
  fontFamily: 'inherit',
}
const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: colors.ERROR_RED,
}
const errorMessageStyle: React.CSSProperties = {
  color: colors.ERROR_RED,
  marginTop: 8,
}
const textAreaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  padding: 10,
  width: '100%',
}
const titleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: 21,
  marginBottom: 32,
  marginTop: 0,
}
type Props = Omit<ModalConfig, 'isShown' | 'onClose' | 'children' | 'style'>
const CoachingModal = (props: Props): React.ReactElement|null => {
  const {...modalProps} = props
  const {t} = useTranslation()
  const [job, sectionId, visualElement] = useSelector(
    ({app: {upskillingJobForCoaching}}: RootState) => upskillingJobForCoaching,
    (job1, job2) => job1?.[0].jobGroup?.romeId === job2?.[0].jobGroup?.romeId,
  ) || []
  const [isValidated, setIsValidated] = useState(false)
  const hasEval = useSelector(({app: {upskillingEvaluatedJobs}}: RootState): boolean =>
    !upskillingEvaluatedJobs?.some(({jobGroup: {romeId}}) => romeId === job?.jobGroup.romeId))
  const isShown = !!job
  const dispatch = useSafeDispatch<DispatchAllUpskillingActions>()
  const title = visualElement === 'after-save' ?
    t('Nous proposons un coaching gratuit par email pour réaliser votre projet\u00A0!') :
    t('Avant de démarrer, dites-nous en plus sur votre situation')
  const userEmail = useSelector(({user: {profile: {email = ''} = {}}}: RootState): string => email)
  const [expectation, setExpectation] = useState('')
  const [email, setEmail] = useState(userEmail)
  const isValidEmail = validateEmail(email)
  const isFormValid = !!job && isValidEmail
  const handleEmailChange = useCallback((email: string) => {
    setEmail(email.toLocaleLowerCase())
  }, [setEmail])
  const handleDelayedEmailChange = useCallback(() => {
    if (sectionId) {
      dispatch(typeCoachingEmailUpskillingAction(sectionId, job))
    }
  }, [dispatch, job, sectionId])
  useEffect(() => {
    if (!isShown) {
      setIsValidated(false)
    }
  }, [isShown])
  const [isOKShown, setOKShown] = useState(false)
  const hideOK = useCallback(() => setOKShown(false), [])
  const onSubmit = useCallback(async (): Promise<void> => {
    if (!job) {
      return
    }
    setIsValidated(true)
    if (!isFormValid) {
      return
    }
    ref.current?.submit()
    // TODO(cyrille): Save expectation.
    const savingPromise = dispatch(saveUpskillingUserAction(email, job, expectation))
    dispatch(registerCoachingUpskillingAction())
    dispatch(closeCoachingModalAction)
    await savingPromise
    setOKShown(true)
  }, [dispatch, email, expectation, isFormValid, job])
  const ref = useRef<Submitable>(null)
  const onClose = useCallback(() => void dispatch(closeCoachingModalAction), [dispatch])
  const expectationLabelId = useMemo(_uniqueId, [])
  const emailLabelId = useMemo(_uniqueId, [])
  return <React.Fragment>
    <Modal isShown={isOKShown} onClose={hideOK} style={OKModalStyle}>
      <Trans parent="p">
      Merci, un de nos coachs prendra contact avec vous par email sous deux jours, vous êtes entre
      de bonnes mains&nbsp;!
      </Trans>
      <p aria-hidden={true}>💪</p>
      <Trans style={whoDivStyle}>
        Créé avec <span aria-label={t('amour')} role="img">
        ❤️</span> par l'ONG <ExternalLink href="https://www.bayesimpact.org" style={discreetLinkStyle}>
        Bayes Impact</ExternalLink>.
      </Trans>
    </Modal>
    <Modal {...modalProps} {...{isShown, onClose}} style={modalStyle}>
      <div style={{maxWidth: isMobileVersion ? 255 : 500}}>
        <h2 style={titleStyle}>{title}</h2>
        <form onSubmit={onSubmit}>
          {hasEval ? <JobEvalButtons visualElement="coaching" {...{job, ref, sectionId}} /> : null}
          <EvalSection
            title={t('Comment pouvons-nous vous aider\u00A0?')} titleId={expectationLabelId}>
            <Textarea
              aria-labelledby={expectationLabelId} style={textAreaStyle} value={expectation}
              onChange={setExpectation} />
          </EvalSection>
          <EvalSection
            title={t('Sur quel email pouvons-nous commencer à vous coacher\u00A0?')}
            titleId={emailLabelId}>
            <Input
              type="email" placeholder={t('Saisissez votre adresse email')}
              aria-labelledby={emailLabelId}
              name="email" style={isValidated && !isValidEmail ? inputErrorStyle : inputStyle}
              value={email} onEdit={handleEmailChange}
              onChangeDelayMillisecs={2000} onChange={handleDelayedEmailChange} />
            {isValidated && !isValidEmail ? <div role="alert" style={errorMessageStyle}>
              {email ? t("Erreur\u00A0: la valeur ci-dessus n'est pas une adresse email valide.") :
                t('Erreur\u00A0: une adresse email est requise pour démarrer le coaching.')}
            </div> : null}
            <div style={{fontStyle: 'italic', marginTop: 15}}>
              {t('Nos coachs sont disponibles par email du lundi au vendredi.')}
            </div>
          </EvalSection>
          <div style={{margin: '10px 0', textAlign: 'center'}}>
            <Button onClick={onSubmit} type="navigation">
              {t('Recevoir mon coaching gratuit')}
            </Button>
          </div>
        </form>
        <Trans style={whoDivStyle}>
          Créé avec <span aria-label={t('amour')} role="img">
          ❤️</span> par l'ONG <ExternalLink href="https://www.bayesimpact.org" style={discreetLinkStyle}>
          Bayes Impact</ExternalLink>.
        </Trans>
      </div>
    </Modal>
  </React.Fragment>
}

export default React.memo(CoachingModal)
