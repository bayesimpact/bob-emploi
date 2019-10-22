import React, {useCallback, useState} from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, askPasswordReset, changePassword, displayToasterMessage,
  emailCheck, registerNewUser} from 'store/actions'

import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {RadiumSpan} from 'components/radium'
import {FieldSet} from 'components/pages/connected/form_utils'
import {Button, Input, WithNote} from 'components/theme'

import {ProfileStepProps, Step} from './step'


interface StepConnectedProps {
  hasPassword: boolean
  isAuthenticating: boolean
}

interface StepProps extends ProfileStepProps, StepConnectedProps {
  dispatch: DispatchAllActions
}

interface NoteProps {
  email: string
  dispatch: DispatchAllActions
}

const ForgottenPasswordNoteBase: React.FC<NoteProps> =
({dispatch, email}: NoteProps): React.ReactElement => {
  const [hasAskedForReset, setHasAskedForReset] = useState(false)
  const handleResetPassword = useCallback(() => {
    dispatch(askPasswordReset(email)).then((response): void =>
      response && setHasAskedForReset(true))
  }, [email, dispatch, setHasAskedForReset])
  if (hasAskedForReset) {
    return <span>Un email a été envoyé à {email} pour réinitialiser le mot de passe.</span>
  }
  const noteStyle: RadiumCSSProperties = {
    ':hover': {
      textDecoration: 'underline',
    },
    cursor: 'pointer',
    fontStyle: 'italic',
  }
  return <RadiumSpan style={noteStyle} onClick={handleResetPassword}>
    Mot de passe oublié&nbsp;?
  </RadiumSpan>
}
const ForgottenPasswordNote = React.memo(ForgottenPasswordNoteBase)


// TODO(cyrille): Check for missing email workflow.
// TODO(marielaure): Add clearer error messages.
const PasswordStepBase: React.FC<StepProps> = (props: StepProps): React.ReactElement => {
  const {dispatch, hasAccount, hasPassword, isAuthenticating, profile: {email}} = props
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [isValidated, setIsValidated] = useState(false)
  const handleChangePassword = useCallback(() => {
    if (!email) {
      return
    }
    const passwordChangePromise = hasPassword ?
      dispatch(emailCheck(email)).then((response): Promise<bayes.bob.AuthResponse|void> => {
        const {hashSalt = ''} = response || {}
        return dispatch(changePassword(email, oldPassword, hashSalt, password))
      }) :
      dispatch(registerNewUser(email, password, '', ''))
    passwordChangePromise.then((response): void => {
      if (!response) {
        return
      }
      setOldPassword('')
      setPassword('')
      setIsValidated(false)
      const passwordModified = hasPassword ? 'modifié' : 'créé'
      dispatch(displayToasterMessage(`Le mot de passe a bien été ${passwordModified}`))
    })
  }, [
    dispatch, email, hasPassword, oldPassword,
    password, setIsValidated, setPassword, setOldPassword,
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
    return <Step fastForward={handleForward} title="Créer un compte" {...props}>
      Avec un compte, je peux revenir sur {config.productName} plus tard pour suivre mes progrès
      (c'est gratuit et le restera toujours).
      <LoginButton
        visualElement="profile" isSignUp={true}
        isRound={true} type="navigation" style={{marginTop: 20}}>
        Créer un compte
      </LoginButton>
    </Step>
  }
  return <Step fastForward={handleForward} title="Mot de passe" {...props}>
    {hasPassword && email ? <React.Fragment>
      <FieldSet
        hasNoteOrComment={true} label="Mot de passe actuel"
        isValid={!!oldPassword} isValidated={isValidated}>
        <WithNote note={<ForgottenPasswordNote email={email} dispatch={dispatch} />}>
          <Input
            type="password" autoComplete="password" style={isMobileVersion ? {} : {width: 360}}
            onChange={setOldPassword} value={oldPassword} onChangeDelayMillisecs={1000} />
        </WithNote>
      </FieldSet>
    </React.Fragment> : null}
    <FieldSet
      label={`${hasPassword ? 'Nouveau' : 'Créer un'} mot de passe`}
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
      Enregistrer
    </Button>
  </Step>
}
const PasswordStep = connect(({user: {hasPassword}, asyncState: {isFetching}}: RootState) => ({
  hasPassword,
  isAuthenticating: isFetching['USER_AUTHENTICATE'],
}))(React.memo(PasswordStepBase))


export {PasswordStep}
