import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'

import type {DispatchAllActions} from 'store/actions'
import {emailCheck, silentlyRegisterUser} from 'store/actions'
import {validateEmail} from 'store/validations'

import Button from 'components/button'
import Trans from 'components/i18n_trans'
import Input from 'components/input'
import {LoginLink} from 'components/login'
import isMobileVersion from 'store/mobile'
import {Modal} from 'components/modal'


interface CoachingConfirmModalProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  onCloseModal: () => void
}


const registrationContentStyle: React.CSSProperties = {
  padding: '30px 50px 50px',
}
const formStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  marginTop: 12,
  ...isMobileVersion ? {} : {maxWidth: 500},
}
const errorStyle = {
  border: `1px solid ${colors.RED_PINK}`,
}


const CoachingConfirmationModal = (props: CoachingConfirmModalProps): React.ReactElement => {
  const {coachingEmailFrequency, onCloseModal} = props
  const [email, setEmail] = useState('')
  const [isEmailAlreadyUsed, setIsEmailAlreadyUsed] = useState(false)
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()

  // TODO(pascal): Give the choice to the user.
  const isPersistent = false

  const submitEmail = useCallback(async (): Promise<void> => {
    if (!validateEmail(email)) {
      return
    }
    const response = await dispatch(emailCheck(email))
    if (!response) {
      return
    }
    if (!response.isNewUser) {
      setIsEmailAlreadyUsed(true)
      return
    }
    dispatch(silentlyRegisterUser(email, isPersistent, t))
  }, [dispatch, email, isPersistent, t])

  const submitEmailViaForm = useCallback((event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submitEmail()
  }, [submitEmail])

  const isEmailValid = validateEmail(email)
  return <Modal
    style={{margin: 20, maxWidth: 500}}
    isShown={!!coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE'}
    onClose={onCloseModal} title={t('Une adresse email est nécessaire')}>
    <div style={registrationContentStyle}>
      {t("Pour vous coacher, j'ai besoin de votre adresse email.")}
      <form onSubmit={submitEmailViaForm} style={formStyle}>
        <Input
          value={email} onChange={setEmail}
          placeholder={t('votre@email.com')} name="email" autoComplete="email"
          style={isEmailAlreadyUsed ? errorStyle : undefined} />
        <Button
          disabled={!isEmailValid} onClick={submitEmail} isRound={true}
          style={{marginLeft: 15}} isNarrow={true}>
          {t('Valider')}
        </Button>
      </form>
      <div style={{fontSize: 13, marginTop: 10}}>
        {isEmailAlreadyUsed ? <Trans parent={null}>
          Cet email est déjà lié à un compte, <LoginLink
            email={email} isSignUp={false} visualElement="coaching">
            connectez-vous
          </LoginLink> pour continuer.
        </Trans> : <Trans parent={null}>
          Vous pouvez aussi créer un compte en{' '}
          <LoginLink visualElement="coaching" isSignUp={true} email={email}>
            cliquant ici
          </LoginLink>.
        </Trans>}
      </div>
    </div>
  </Modal>
}


export default React.memo(CoachingConfirmationModal)
