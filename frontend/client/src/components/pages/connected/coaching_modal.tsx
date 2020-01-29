import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'

import {DispatchAllActions, emailCheck, silentlyRegisterUser} from 'store/actions'
import {validateEmail} from 'store/validations'

import {Trans} from 'components/i18n'
import {LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Modal} from 'components/modal'
import {Button, Input} from 'components/theme'


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


const CoachingConfirmationModalBase: React.FC<CoachingConfirmModalProps> =
(props: CoachingConfirmModalProps): React.ReactElement => {
  const {coachingEmailFrequency, onCloseModal} = props
  const [email, setEmail] = useState('')
  const [isEmailAlreadyUsed, setIsEmailAlreadyUsed] = useState(false)
  const dispatch = useDispatch<DispatchAllActions>()
  const {t} = useTranslation()

  const submitEmail = useCallback((): void => {
    if (!validateEmail(email)) {
      return
    }
    dispatch(emailCheck(email)).then((response): void => {
      if (!response) {
        return
      }
      if (!response.isNewUser) {
        setIsEmailAlreadyUsed(true)
        return
      }
      dispatch(silentlyRegisterUser(email))
    })
  }, [dispatch, email])

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
          placeholder={t('votre@email.com')}
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
const CoachingConfirmationModal = React.memo(CoachingConfirmationModalBase)


export {CoachingConfirmationModal}
