import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, askPasswordReset, changePassword, displayToasterMessage,
  emailCheck, registerNewUser} from 'store/actions'

import Button from 'components/button'
import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import Input from 'components/input'
import {LoginButton} from 'components/login'
import isMobileVersion from 'store/mobile'
import {RadiumSpan} from 'components/radium'
import WithNote from 'components/with_note'

import {ProfileStepProps, Step} from './step'


interface NoteProps {
  email: string
  dispatch: DispatchAllActions
}

const ForgottenPasswordNoteBase: React.FC<NoteProps> =
({dispatch, email}: NoteProps): React.ReactElement => {
  const [hasAskedForReset, setHasAskedForReset] = useState(false)
  const handleResetPassword = useCallback(async () => {
    const response = await dispatch(askPasswordReset(email))
    if (response) {
      setHasAskedForReset(true)
    }
  }, [email, dispatch, setHasAskedForReset])
  if (hasAskedForReset) {
    return <Trans parent="span">
      Un email a été envoyé à {{email}} pour réinitialiser le mot de passe.
    </Trans>
  }
  const noteStyle: RadiumCSSProperties = {
    ':hover': {
      textDecoration: 'underline',
    },
    'cursor': 'pointer',
    'fontStyle': 'italic',
  }
  return <RadiumSpan style={noteStyle} onClick={handleResetPassword}>
    Mot de passe oublié&nbsp;?
  </RadiumSpan>
}
const ForgottenPasswordNote = React.memo(ForgottenPasswordNoteBase)


// TODO(cyrille): Check for missing email workflow.
// TODO(sil): Add clearer error messages.
const PasswordStep = (props: ProfileStepProps): React.ReactElement => {
  const {hasAccount, profile: {email}} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const hasPassword = useSelector(({user: {hasPassword}}: RootState): boolean => !!hasPassword)
  const isAuthenticating = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['AUTHENTICATE_USER'],
  )
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [isValidated, setIsValidated] = useState(false)
  const {t} = useTranslation()
  const handleChangePassword = useCallback(async () => {
    if (!email) {
      return
    }
    if (hasPassword) {
      const checkedEmail = await dispatch(emailCheck(email))
      const {hashSalt = ''} = checkedEmail || {}
      const passwordChanged = await dispatch(changePassword(email, oldPassword, hashSalt, password))
      if (!passwordChanged) {
        return
      }
    } else {
      const passwordChanged = await dispatch(registerNewUser(email, password, ''))
      if (!passwordChanged) {
        return
      }
    }
    setOldPassword('')
    setPassword('')
    setIsValidated(false)
    dispatch(displayToasterMessage(
      hasPassword ?
        t('Le mot de passe a bien été modifié') :
        t('Le mot de passe a bien été créé'),
    ))
  }, [
    dispatch, email, hasPassword, oldPassword,
    password, setIsValidated, setPassword, setOldPassword, t,
  ])
  const handleForward = useCallback(() => {
    if ((!hasPassword || oldPassword) && password) {
      handleChangePassword()
      return
    }
    if (!password) {
      setPassword('password')
    }
    if (hasPassword && !oldPassword) {
      setOldPassword('password')
    }
  }, [handleChangePassword, hasPassword, oldPassword, password, setOldPassword, setPassword])
  if (!hasAccount) {
    return <Step fastForward={handleForward} title={t('Créer un compte')} {...props}>
      {t(
        'Avec un compte, je peux revenir sur {{productName}} plus tard pour suivre mes progrès ' +
        "(c'est gratuit et le restera toujours).",
        {productName: config.productName},
      )}
      <LoginButton
        visualElement="profile" isSignUp={true}
        isRound={true} type="navigation" style={{marginTop: 20}}>
        {t('Créer un compte')}
      </LoginButton>
    </Step>
  }
  return <Step fastForward={handleForward} title={t('Mot de passe')} {...props}>
    {hasPassword && email ? <React.Fragment>
      <FieldSet
        hasNoteOrComment={true} label={t('Mot de passe actuel')}
        isValid={!!oldPassword} isValidated={isValidated}>
        <WithNote note={<ForgottenPasswordNote email={email} dispatch={dispatch} />}>
          <Input
            type="password" autoComplete="password" style={isMobileVersion ? {} : {width: 360}}
            onChange={setOldPassword} value={oldPassword} onChangeDelayMillisecs={1000} />
        </WithNote>
      </FieldSet>
    </React.Fragment> : null}
    <FieldSet
      label={hasPassword ? t('Nouveau mot de passe') : t('Créer un mot de passe')}
      isValid={!!password} isValidated={isValidated}>
      <Input
        type="password" autoComplete="new-password"
        onChange={setPassword} value={password} onChangeDelayMillisecs={1000} />
    </FieldSet>
    <Button
      disabled={hasPassword && !oldPassword || !password}
      onClick={handleChangePassword}
      isProgressShown={isAuthenticating}
      isRound={true} type="navigation">
      {t('Enregistrer')}
    </Button>
  </Step>
}


export default React.memo(PasswordStep)
