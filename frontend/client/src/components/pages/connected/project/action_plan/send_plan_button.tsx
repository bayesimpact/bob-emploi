import _uniqueId from 'lodash/uniqueId'
import CheckIcon from 'mdi-react/CheckCircleOutlineIcon'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useKeyListener from 'hooks/key_listener'
import type {DispatchAllActions, RootState} from 'store/actions'
import {sendActionPlanEmail, silentlyRegisterUser} from 'store/actions'
import {useAsynceffect, useSafeDispatch} from 'store/promise'
import {validateEmail} from 'store/validations'

import Button from 'components/button'
import Input from 'components/input'
import {Modal, useModal} from 'components/modal'
import {FixedButtonNavigation} from 'components/navigation'
import Trans from 'components/i18n_trans'

import FeedbackModal from './feedback_modal'

const toLocaleLowerCase = (email: string): string => email.toLocaleLowerCase()

const emailModalStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  margin: 20,
  maxWidth: 400,
  minWidth: 250,
  padding: 20,
}
const disabledStyle: React.CSSProperties = {
  borderRadius: 0,
  margin: '25px -20px 0',
  textAlign: 'center',
}
const blueStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
}
const newEmailButtonStyle: React.CSSProperties = {
  ...disabledStyle,
  ...blueStyle,
}
const sentModalStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  margin: 20,
  maxWidth: 400,
  minWidth: 250,
  padding: '40px 20px 30px',
  textAlign: 'center',
}
const modalSpaceStyle: React.CSSProperties = {
  margin: '30px 0',
}
interface Props {
  'aria-hidden'?: boolean
  isFixed?: boolean
  project: bayes.bob.Project & {projectId: string}
  style?: React.CSSProperties
}
const SendPlanButton = (props: Props): React.ReactElement => {
  const {'aria-hidden': ariaHidden, isFixed, project, style} = props
  const {t} = useTranslation()
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const email = useSelector(({user: {profile: {email = ''} = {}}}: RootState) => email)
  const hasEmail = !!email
  const emailLabelId = useMemo(_uniqueId, [])
  const [isSentModalShown, openSentModal, closeSentModal] = useModal(false)
  const [isFeedbackRequested, setIsFeedbackRequested] = useState(false)
  const [isFeedbackModalShown, openFeedbackModal, closeFeedbackModal] = useModal(false)
  // When closing the sent modal, show the feedback modal once it's hidden.
  const handleSentModalClose = useCallback((): void => {
    const hasGivenFeedback = Object.values(project?.feedback || {}).some((feedback) => !!feedback)
    setIsFeedbackRequested(!hasGivenFeedback)
    closeSentModal()
  }, [closeSentModal, project])
  useAsynceffect(async (checkIfCanceled: () => boolean): Promise<void> => {
    if (!isFeedbackRequested) {
      return
    }
    await new Promise(resolve => window.setTimeout(resolve, 1000))
    if (checkIfCanceled()) {
      return
    }
    openFeedbackModal()
  }, [isFeedbackRequested, openFeedbackModal])
  useKeyListener(
    'Escape', isSentModalShown ? handleSentModalClose : undefined, undefined, 'keydown')
  const sendEmail = useCallback(async () => {
    if (await dispatch(sendActionPlanEmail(project))) {
      openSentModal()
    }
  }, [dispatch, openSentModal, project])

  const [newEmail, setEmail] = useState('')
  const isEmailValid = validateEmail(newEmail)
  const [isShown, open, close] = useModal(false)
  // TODO(pascal): Add a checkbox to get the user's choice.
  const isPersistent = false
  const validateAndSend = useCallback(async () => {
    if (!isEmailValid) {
      return
    }
    if (!await dispatch(silentlyRegisterUser(newEmail, isPersistent, t))) {
      return
    }
    close()
    sendEmail()
  }, [close, dispatch, isEmailValid, isPersistent, newEmail, sendEmail, t])
  const MainButton = isFixed ? FixedButtonNavigation : Button
  return <React.Fragment>
    {hasEmail ? <React.Fragment>
      <Modal style={sentModalStyle} isShown={isSentModalShown}>
        <CheckIcon size={60} color={colors.BOB_BLUE} />
        <Trans style={modalSpaceStyle}>
          Vous allez recevoir votre plan d'action à l'adresse mail <strong>{{email}}</strong>.<br />
          Merci pour votre confiance&nbsp;!
        </Trans>
        <Button onClick={handleSentModalClose} style={blueStyle} type="discreet">
          {t("J'ai compris")}
        </Button>
      </Modal>
      <FeedbackModal
        isShown={isFeedbackModalShown} onClose={closeFeedbackModal} project={project} />
    </React.Fragment> : <Modal isShown={isShown} style={emailModalStyle} onClose={close}>
      <h4 style={{fontWeight: 'normal', margin: '0 0 10px'}} id={emailLabelId}>
        {t('Saisissez votre email')}
      </h4>
      <Input
        shouldFocusOnMount={true} type="email" autoComplete="email" name="email"
        placeholder={t('Email\u00A0: adresse@mail.com')} value={newEmail}
        applyFunc={toLocaleLowerCase} onChange={setEmail} aria-labelledby={emailLabelId} />
      <Button
        type="discreet" style={isEmailValid ? newEmailButtonStyle : disabledStyle}
        disabled={!isEmailValid} onClick={validateAndSend}>
        {t("M'envoyer mon plan d'action")}
      </Button>
    </Modal>}
    <MainButton
      style={style} onClick={hasEmail ? sendEmail : open} aria-hidden={ariaHidden}
      tabIndex={ariaHidden ? -1 : undefined}>
      {t("M'envoyer mon plan d'action par email")}
    </MainButton>
  </React.Fragment>
}

export default React.memo(SendPlanButton)
