import _uniqueId from 'lodash/uniqueId'
import AccountOutlineIcon from 'mdi-react/AccountOutlineIcon'
import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import GoogleIcon from 'mdi-react/GoogleIcon'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import {parse, stringify} from 'query-string'
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react'
import type {ReactFacebookLoginInfo, ReactFacebookLoginProps} from 'react-facebook-login'
import FacebookLogin from 'react-facebook-login'
// TODO(cyrille): Rather use useGoogleLogin hook.
import type {GoogleLoginResponse, GoogleLoginResponseOffline} from 'react-google-login'
import GoogleLogin from 'react-google-login'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory, useLocation} from 'react-router'
import {Link} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'
import type {DispatchAllActions, RootState} from 'store/actions'
import {askPasswordReset, changePassword, closeLoginModal,
  displayToasterMessage, emailCheck, facebookAuthenticateUser, googleAuthenticateUser,
  linkedInAuthenticateUser, loginUser, noOp, openLoginModal, openRegistrationModal,
  peConnectAuthenticateUser, registerNewUser, resetPassword, startAsGuest} from 'store/actions'
import {getLanguage} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString, parsedValueFlattener} from 'store/parse'
import {useAsynceffect, useSafeDispatch} from 'store/promise'
import {getUniqueExampleEmail, useUserExample} from 'store/user'
import {scorePasswordComplexity, validateEmail} from 'store/validations'

import Button from 'components/button'
import CircularProgress from 'components/circular_progress'
import Trans from 'components/i18n_trans'
import IconInput from 'components/icon_input'
import type {Inputable} from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import LinkButton from 'components/link_button'
import ModalCloseButton from 'components/modal_close_button'
import {Modal} from 'components/modal'
import PasswordStrength from 'components/password_strength'
import {SmartLink} from 'components/radium'
import {Styles} from 'components/theme'
import {Routes} from 'components/url'
import linkedInIcon from 'images/linked-in.png'
import logoProductImage from 'deployment/bob-logo.svg?fill=%23fff'
import peConnectIcon from 'images/pole-emploi-connect.svg'
import portraitCoverImage from 'images/catherine_portrait.jpg'


const PE_CONNECT_SCOPES = ['api_peconnect-individuv1', 'profile', 'email', 'openid']

const LINKEDIN_SCOPES = ['r_liteprofile', 'r_emailaddress']

const toLocaleLowerCase = (email: string): string => email.toLocaleLowerCase()

const stopPropagation = (event: React.SyntheticEvent): void => event.stopPropagation()

interface LoginProps {
  defaultEmail: string
  onLogin: (user: bayes.bob.User) => void
  onShowRegistrationFormClick: () => void
  stateToStore: StoredState
  storedState?: StoredState
  titleId?: string
}

const loginBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  marginTop: 15,
}
const lostPasswordLinkStyle: React.CSSProperties = {
  color: colors.GREYISH_BROWN,
  display: 'inline-block',
  fontSize: 13,
  marginLeft: 15,
  marginTop: 12,
  textDecoration: 'none',
}
const errorStyle: React.CSSProperties = {
  color: colors.RED_PINK,
  fontSize: 13,
  margin: '5px 0 0',
}


const LoginFormBase = (props: LoginProps): React.ReactElement => {
  const {
    defaultEmail,
    onLogin,
    onShowRegistrationFormClick,
    stateToStore,
    storedState,
    titleId,
  } = props

  const isAskingForPasswordReset = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['RESET_USER_PASSWORD'],
  )
  const isAuthenticatingEmail = useSelector(
    ({asyncState: {authMethod, isFetching}}: RootState): boolean =>
      !!isFetching['EMAIL_CHECK'] || !!isFetching['AUTHENTICATE_USER'] && authMethod === 'password',
  )
  const isAuthenticatingOther = useSelector(
    ({asyncState: {authMethod, isFetching}}: RootState): boolean =>
      !!isFetching['AUTHENTICATE_USER'] && authMethod !== 'password',
  )

  const [isValidated, setIsValidated] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [hashSalt, setHashSalt] = useState('')
  const [isTryingToResetPassword, setIsTryingToResetPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordResetRequestedEmail, setPasswordRequestedEmail] = useState('')
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const [isLoginIncorrect, setIsLoginIncorrect] = useState(false)

  const {t} = useTranslation('components')

  const isEmailValid = useMemo((): boolean => validateEmail(email), [email])
  const isFormValid = !!((isTryingToResetPassword || password) && isEmailValid)

  const handleLogin = useCallback(async (event?: React.SyntheticEvent) => {
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!isFormValid) {
      setIsValidated(true)
      return
    }
    const checkedEmail = await dispatch(emailCheck(email))
    if (!checkedEmail) {
      return
    }
    if (checkedEmail.hashSalt) {
      setHashSalt(checkedEmail.hashSalt)
    }
    if (checkedEmail.isNewUser) {
      setIsLoginIncorrect(true)
      return
    }
    // TODO(pascal): Add a checkbox to ask the user.
    const isPersistent = true
    // TODO: Use different API endpoints for login and registration.
    const loggedIn = await dispatch(loginUser(email, password, hashSalt, isPersistent))
    if (loggedIn && loggedIn.authenticatedUser) {
      onLogin(loggedIn.authenticatedUser)
      // TODO: Take care of the else case when the authentication was
      // not successful but we got back some new salt. (response.hashSalt)
    }
  }, [dispatch, email, hashSalt, isFormValid, onLogin, password, setIsLoginIncorrect])

  const handleLostPasswordClick = useCallback(async (event?: React.SyntheticEvent) => {
    if (event) {
      event.preventDefault()
    }
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
        t('Entrez correctement votre email dans le champ ci-dessus pour récupérer ' +
          'votre mot de passe.')))
      setIsTryingToResetPassword(true)
      return
    }
    if (await dispatch(askPasswordReset(email))) {
      setPasswordRequestedEmail(email)
    }
  }, [dispatch, email, t])

  const isMissingEmail = !email
  const isMissingPassword = !password

  useFastForward((): void => {
    if (isFormValid) {
      handleLogin()
      return
    }
    if (isMissingEmail) {
      setEmail('test@example.com')
    }
    if (isMissingPassword) {
      // Let's hope it's the right password.
      setPassword('password')
    }
  }, [handleLogin, isFormValid, isMissingEmail, isMissingPassword])

  const handleSubmit = isTryingToResetPassword ? handleLostPasswordClick : handleLogin
  return <form style={loginBoxStyle} onSubmit={handleSubmit}>
    <FormHeader
      title={isTryingToResetPassword ? t('Mot de passe oublié\u00A0?') : t("S'identifier")}
      question={isTryingToResetPassword ? '' : t('Pas encore de compte\u00A0?')}
      linkText={t('Inscrivez-vous\u00A0!')} titleId={titleId}
      onClick={onShowRegistrationFormClick} />

    <SocialLoginButtons stateToStore={stateToStore} storedState={storedState} onLogin={onLogin} />

    <FormSection title={t('Identification par mot de passe')}>
      <IconInput
        shouldFocusOnMount={!email}
        type="email" autoComplete="email" name="email"
        placeholder={t('Email\u00A0: adresse@mail.com')} title={t('Email')}
        value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase}
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        onChange={setEmail} />
      {isValidated && !isEmailValid ? <p style={errorStyle} role="alert">
        {t('Entrez un email valide')}
      </p> : null}
      {isTryingToResetPassword ? null : <React.Fragment>
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="password" autoComplete="new-password" name="new-password"
          shouldFocusOnMount={!!email}
          placeholder={t('Mot de passe')} title={t('Mot de passe')}
          value={password} iconComponent={LockOutlineIcon}
          onChange={setPassword}
          style={{marginTop: 10}} />
        {isValidated && !password ? <p style={errorStyle} role="alert">
          {t('Le mot de passe ne peut pas être vide')}
        </p> : null}
      </React.Fragment>}
    </FormSection>

    {isTryingToResetPassword ? null : <SmartLink
      style={lostPasswordLinkStyle} onClick={handleLostPasswordClick}>
      {t('Mot de passe oublié\u00A0?')}
    </SmartLink>}
    {passwordResetRequestedEmail ?
      <span style={lostPasswordLinkStyle}>{t(
        'Un email a été envoyé à {{passwordResetRequestedEmail}} si un compte {{productName}} ' +
        'utilise cette adresse.',
        {passwordResetRequestedEmail, productName: config.productName},
      )}</span>
      : <React.Fragment>
        {isLoginIncorrect ? <p style={{...errorStyle, marginTop: 20}} role="alert">{t(
          "L'email et le mot de passe ne correspondent pas. " +
          "Si vous avez déjà créé un compte mais que vous n'avez pas créé votre mot de passe, " +
          'nous venons de vous envoyer un email pour vous connecter.')}
        </p> : null}
        <Button
          disabled={isAuthenticatingOther || isAuthenticatingEmail}
          onClick={handleSubmit}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={(isAuthenticatingEmail || isAskingForPasswordReset)}
          type="validation">
          {isTryingToResetPassword ? t('Récupérer son mot de passe') : t("S'identifier")}
        </Button>
      </React.Fragment>}
  </form>
}
const LoginForm = React.memo(LoginFormBase)


interface ResetPasswordProps {
  defaultEmail?: string
  inputRef?: React.RefObject<Inputable>
  isTitleShown?: boolean
  onLogin: (user: bayes.bob.User) => void
  resetToken?: string
  style?: React.CSSProperties
  titleId?: string
}


const buttonLinkStyle: React.CSSProperties = {
  color: colors.DARK_BLUE,
  padding: 0,
  textDecoration: 'underline',
}


// TODO(cyrille): Check whether the token has expired on mount, to avoid having the expiration error
// after the user has entered their new password.
const ResetPasswordFormBase = (props: ResetPasswordProps): React.ReactElement => {
  const {defaultEmail, inputRef, isTitleShown = true, onLogin, resetToken, style, titleId} = props
  const {t} = useTranslation('components')

  const [isValidated, setIsValidated] = useState(false)
  const [email, setEmail] = useState(defaultEmail || '')
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [hashSalt, setHashSalt] = useState('')
  const [passwordResetRequestedEmail, setPasswordResetRequestEmail] = useState('')

  const dispatch = useSafeDispatch<DispatchAllActions>()

  const hasTokenExpired = useSelector(
    ({app: {hasTokenExpired}}: RootState): boolean => !!hasTokenExpired,
  )
  const isAuthenticating = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean =>
      !!(isFetching['EMAIL_CHECK'] || isFetching['AUTHENTICATE_USER']),
  )

  useAsynceffect(async (checkIfCanceled) => {
    if (resetToken || !defaultEmail) {
      return
    }
    const checkedEmail = await dispatch(emailCheck(defaultEmail))
    if (checkedEmail && checkedEmail.hashSalt && !checkIfCanceled()) {
      setHashSalt(checkedEmail.hashSalt)
    }
  }, [defaultEmail, dispatch, resetToken])

  const isEmailValid = useMemo((): boolean => !!validateEmail(email), [email])
  const {
    isStrongEnough: isPasswordValid,
    score: passwordComplexity,
  } = scorePasswordComplexity(password || '')
  const isFormValid = !!(isPasswordValid && isEmailValid && (resetToken || oldPassword))

  const handleResetPassword = useCallback(async () => {
    if (!isFormValid) {
      setIsValidated(true)
      return
    }
    if (!email) {
      return
    }

    if (resetToken && isPasswordValid) {
      const {authenticatedUser} = await dispatch(resetPassword(email, password, resetToken)) || {}
      if (authenticatedUser) {
        onLogin(authenticatedUser)
      }
      return
    }

    if (oldPassword && hashSalt && isPasswordValid) {
      const {authenticatedUser, isPasswordUpdated} =
        await dispatch(changePassword(email, oldPassword, hashSalt, password)) || {}
      if (isPasswordUpdated && authenticatedUser) {
        onLogin(authenticatedUser)
      }
    }
  }, [
    dispatch, isFormValid, email, hashSalt, oldPassword, onLogin, resetToken, password,
    isPasswordValid,
  ])

  const handleResetPasswordForm = useCallback((event: React.SyntheticEvent): void => {
    event.preventDefault()
    handleResetPassword()
  }, [handleResetPassword])

  const handleResendEmail = useCallback(async (): Promise<void> => {
    if (!email) {
      return
    }
    const response = await dispatch(askPasswordReset(email))
    if (response) {
      setPasswordResetRequestEmail(email)
    }
  }, [dispatch, email])

  if (hasTokenExpired) {
    const emailSentStyle = {
      fontStyle: 'italic',
      marginTop: 10,
    }
    return <div>
      <FormHeader title={t("Moyen d'authentification périmé")} titleId={titleId} />
      <Trans ns="components">
        Le lien que vous avez utilisé est trop vieux. Veuillez
        vous <LoginLink visualElement="expired-resetToken" style={buttonLinkStyle}>
          reconnecter
        </LoginLink> ou <button style={buttonLinkStyle} onClick={handleResendEmail} type="button">
          cliquer ici
        </button> pour
        réinitialiser votre mot de passe.
      </Trans>
      {passwordResetRequestedEmail ? <Trans style={emailSentStyle} ns="components">
        Un email a été envoyé à {{passwordResetRequestedEmail}}
      </Trans> : null}
    </div>
  }

  const loginBoxStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 15,
    ...style,
  }
  return <form style={loginBoxStyle} onSubmit={handleResetPasswordForm}>
    {isTitleShown ? <FormHeader title={t('Changez votre mot de passe')} titleId={titleId} /> : null}
    {resetToken ? <React.Fragment>
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={!defaultEmail} autoComplete="email" name="email"
        type="email" placeholder={t('Email\u00A0: adresse@mail.com')} value={email}
        iconComponent={EmailOutlineIcon} applyFunc={toLocaleLowerCase} title={t('Email')}
        onChange={setEmail} />
      {isValidated && !isEmailValid ? <p style={errorStyle} role="alert">
        {t('Entrez un email valide')}
      </p> : null}
    </React.Fragment> : <React.Fragment>
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="current-password" shouldFocusOnMount={true}
        name="current-password" title={t('Mot de passe actuel')}
        placeholder={t('Mot de passe actuel')} value={oldPassword} iconComponent={LockOutlineIcon}
        onChange={setOldPassword} ref={inputRef} />
      {isValidated && !oldPassword ? <p style={errorStyle} role="alert">
        {t('Le mot de passe ne peut pas être vide')}
      </p> : null}
    </React.Fragment>}
    <IconInput
      iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
      type="password" autoComplete="new-password" shouldFocusOnMount={!!defaultEmail}
      name="new-password"
      placeholder={t('Nouveau mot de passe')} value={password} iconComponent={LockOutlineIcon}
      onChange={setPassword} title={t('Nouveau mot de passe')}
      style={{marginTop: 10}} ref={resetToken ? inputRef : undefined} />
    {isValidated && !password ? <p style={errorStyle} role="alert">
      {t('Le mot de passe ne peut pas être vide')}
    </p> : null}
    {password ? <PasswordStrength score={passwordComplexity} /> : null}
    <Button
      onClick={handleResetPassword}
      style={{alignSelf: 'center', marginTop: 30}}
      isProgressShown={isAuthenticating}
      isNarrow={true}
      type="validation">
      <Trans parent={null} ns="components">Changer le mot de passe</Trans>
    </Button>
  </form>
}
const ResetPasswordForm = React.memo(ResetPasswordFormBase)


interface RegistrationProps {
  onLogin: (user: bayes.bob.User) => void
  onShowLoginFormClick: () => void
  stateToStore: StoredState
  storedState?: StoredState
  titleId?: string
}

const registrationBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  marginTop: 15,
}


const RegistrationFormBase = (props: RegistrationProps): React.ReactElement => {
  const {
    onLogin,
    onShowLoginFormClick,
    stateToStore,
    storedState,
    titleId,
  } = props

  const dispatch = useDispatch<DispatchAllActions>()
  const defaultEmail = useSelector(
    ({app: {loginModal}}: RootState): string => loginModal?.defaultValues?.email || '',
  )
  const hasUser = useSelector(({user: {userId}}: RootState): boolean => !!userId)
  const isAuthenticating = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['AUTHENTICATE_USER'],
  )

  const [email, setEmail] = useState(defaultEmail)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(!!hasUser)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isFastForwarded, setIsFastForwarded] = useState(false)
  const [isValidated, setIsValidated] = useState(false)

  const {t} = useTranslation('components')

  const isEmailValid = useMemo((): boolean => validateEmail(email), [email])
  const {
    isStrongEnough: isPasswordValid,
    score: passwordComplexity,
  } = scorePasswordComplexity(password || '')
  const isFormValid = !!(hasAcceptedTerms && isPasswordValid && isEmailValid && name)

  const handleRegister = useCallback(async (): Promise<void> => {
    if (!isFormValid) {
      setIsValidated(true)
      return
    }
    const userData = {
      isAlpha: isFastForwarded,
      locale: getLanguage(),
    }
    // TODO(pascal): Ask the user for their choice.
    const isPersistent = true
    const response = await dispatch(registerNewUser(email, password, name, isPersistent, userData))
    if (!response) {
      return response
    }
    // TODO: Handle this more explicitly after switch to two endpoints.
    // User already exists
    if (!response.authenticatedUser) {
      dispatch(displayToasterMessage(t(
        'Ce compte existe déjà, merci de vous connecter avec vos identifiants')))
      onShowLoginFormClick()
      return
    }
    onLogin(response.authenticatedUser)
  }, [
    email, name, password, isFastForwarded, isFormValid, dispatch, onLogin,
    onShowLoginFormClick, t,
  ])

  const handleToggleAcceptTerms = useCallback(
    (): void => setHasAcceptedTerms(!hasAcceptedTerms),
    [hasAcceptedTerms],
  )

  const isMissingEmail = !email
  const isMissingName = !name

  const {profile: {name: exampleFirstName}} = useUserExample()

  useFastForward((): void => {
    setIsFastForwarded(true)
    if (isFormValid) {
      handleRegister()
      return
    }
    if (isMissingEmail) {
      setEmail(getUniqueExampleEmail())
    }
    if (!isPasswordValid) {
      setPassword('password')
    }
    if (!hasAcceptedTerms) {
      setHasAcceptedTerms(true)
    }
    if (isMissingName) {
      setName(exampleFirstName)
    }
  }, [
    isMissingName, isPasswordValid, isMissingEmail, isFormValid,
    handleRegister, hasAcceptedTerms, exampleFirstName,
  ])

  return <form style={registrationBoxStyle} onSubmit={handleRegister}>
    <FormHeader
      title={t('Créer un compte')}
      question={t('Déjà un compte\u00A0?')}
      linkText={t('Connectez-vous\u00A0!')}
      onClick={onShowLoginFormClick}
      titleId={titleId} />

    <SocialLoginButtons
      stateToStore={stateToStore} storedState={storedState} onLogin={onLogin} isNewUser={true} />

    <FormSection title={t('Inscription par mot de passe')}>
      <p style={{fontSize: 12, margin: '0 0 5px'}}>{t('* Champs obligatoires')}</p>
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={true} autoComplete="given-name" name="name"
        type="text" placeholder={t('* Prénom')} title={t('* Prénom')}
        value={name} iconComponent={AccountOutlineIcon}
        onChange={setName} aria-required={true} aria-invalid={isValidated && !name} />
      {isValidated && !name ? <p style={errorStyle} role="alert">
        {t(
          'Un prénom est obligatoire. Si vous préférez rester discret·e, vous pouvez mettre un ' +
          'prénom au hasard\u00A0: Camille, Laurent ou Lisa par exemple.')}
      </p> : null}
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="email" placeholder={t('* Email\u00A0: adresse@mail.com')} title={t('* Email')}
        value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase} autoComplete="email" name="email"
        onChange={setEmail}
        style={{marginTop: 10}} aria-required={true} aria-invalid={isValidated && !isEmailValid} />
      {isValidated && !isEmailValid ? <p style={errorStyle} role="alert">
        {t('Entrez un email valide')}
      </p> : null}
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="new-password" name="new-password"
        placeholder={t('* Créer un mot de passe')} title={t('* Créer un mot de passe')}
        value={password} iconComponent={LockOutlineIcon}
        onChange={setPassword}
        style={{marginTop: 10}} aria-required={true} aria-invalid={isValidated && !password} />
      {isValidated && !password ? <p style={errorStyle} role="alert">
        {t('Le mot de passe ne peut pas être vide')}
      </p> : null}
      {password ? <PasswordStrength score={passwordComplexity} /> : null}
    </FormSection>

    <Trans style={{fontSize: 12, margin: '10px auto 0', maxWidth: 325}} parent="p" ns="components">
      Nous sommes une association loi 1901 à but non
      lucratif&nbsp;: {{productName: config.productName}} est <strong>gratuit</strong> et
      le restera toujours.
    </Trans>
    {hasUser ? null : <React.Fragment>
      <LabeledToggle
        type="checkbox" label={<Trans parent="span" ns="components">
            J'ai lu et j'accepte les <Link
            to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank" rel="noopener noreferrer"
            onClick={stopPropagation}>
              conditions générales d'utilisation
          </Link>
        </Trans>}
        style={{fontSize: 12, marginTop: 10}}
        isSelected={hasAcceptedTerms}
        onClick={handleToggleAcceptTerms} />
      {isValidated && !hasAcceptedTerms ? <p style={errorStyle} role="alert">
        {t('Avant de continuer, lisez et acceptez les CGU ci-dessus.')}
      </p> : null}
    </React.Fragment>}
    <Button
      onClick={handleRegister}
      style={{alignSelf: 'center', marginTop: 30}}
      isNarrow={true}
      isProgressShown={isAuthenticating}
      type="validation">
      {t("S'inscrire")}
    </Button>
  </form>
}
const RegistrationForm = React.memo(RegistrationFormBase)


interface SectionProps {
  children: React.ReactNode
  title: React.ReactNode
}

const formSectionTitleStyle: React.CSSProperties = {
  color: colors.GREYISH_BROWN,
  fontSize: 14,
  margin: '30px 0 15px',
  textAlign: 'center',
}


const FormSectionBase = (props: SectionProps): React.ReactElement => {
  const {children, title} = props
  return <React.Fragment>
    <p style={formSectionTitleStyle}>
      {title}
    </p>
    {children}
  </React.Fragment>
}
const FormSection = React.memo(FormSectionBase)


interface HeaderProps {
  linkText?: string
  onClick?: () => void
  question?: string
  title: string
  titleId?: string
}

const headerHeadlineStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 23,
  fontWeight: 500,
  lineHeight: 1.6,
  margin: 0,
  textAlign: 'center',
}
const formHeaderContentStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.4,
  margin: 0,
  textAlign: 'center',
}
const formHeaderLinkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  padding: 0,
  textDecoration: 'underline',
}


const FormHeaderBase = (props: HeaderProps): React.ReactElement => {
  const {linkText, onClick, question, title, titleId} = props
  return <div style={{marginBottom: 20}}>
    <h2 style={headerHeadlineStyle} id={titleId}>{title}</h2>
    {question && onClick && linkText ? <p style={formHeaderContentStyle}>
      {question} <SmartLink onClick={onClick} style={formHeaderLinkStyle}>{linkText}</SmartLink>
    </p> : null}
  </div>
}
const FormHeader = React.memo(FormHeaderBase)


function getLocalStorageKey(state: string): string {
  return `oauth2.${state}`
}


function getRandomHash(): string {
  return (Math.random() * 36).toString(36)
}


interface StoredState {
  clientId?: string
  location?: string
  isNewUser?: boolean
  nonce?: string
}

function setStoredState(state: StoredState, stateKey?: string): [string, StoredState] {
  const storedState = {
    ...state,
    nonce: getRandomHash(),
  }
  stateKey = stateKey || getRandomHash()
  window.sessionStorage.setItem(getLocalStorageKey(stateKey), JSON.stringify(storedState))
  return [stateKey, storedState]
}


function getStoredState(state: string): StoredState|null {
  const stateKey = getLocalStorageKey(state)
  const stateContent = window.sessionStorage.getItem(stateKey)
  if (!stateContent) {
    return null
  }
  window.sessionStorage.removeItem(stateKey)
  return JSON.parse(stateContent)
}

interface OAuth2Props extends React.HTMLProps<HTMLButtonElement> {
  authorizeEndpoint: string
  authorizeParams?: {[param: string]: string}
  clientId: string
  isNewUser?: boolean
  logo: string
  onFailure?: (error: {message: string}) => void
  onSuccess?: (auth: {code: string; nonce: string}) => void
  scopes?: string[]
  stateToStore?: StoredState
  storedState?: StoredState
  style?: React.CSSProperties
}

const OAuth2ConnectLoginBase = (props: OAuth2Props): React.ReactElement => {
  const {children, authorizeEndpoint, authorizeParams, clientId, isNewUser: omittedIsNewUser, logo,
    onFailure, onSuccess, scopes, stateToStore, storedState, style, ...extraProps} = props

  const {search} = useLocation()
  const [initialSearch] = useState(search)
  useEffect((): void => {
    if (!initialSearch || !storedState) {
      return
    }
    const {clientId: storedClientId, nonce} = storedState
    if (storedClientId !== clientId) {
      return
    }
    const {code, error, error_description: errorDescription, state} = parse(initialSearch.slice(1))
    if (!nonce) {
      onFailure && onFailure(new Error(`Invalid state: "${state}".`))
      return
    }
    if (error || !code) {
      const fullError: string|undefined = parsedValueFlattener.join(errorDescription)
      if (fullError && /(user cancelled|owner did not authorize)/i.test(fullError)) {
        // User cancelled their request so they are aware of what happened.
        onFailure && onFailure(new Error('Authentification annulée'))
        return
      }
      onFailure && onFailure(new Error(
        fullError || parsedValueFlattener.join(error) ||
        "Erreur lors de l'authentification, code manquant"))
      return
    }
    const lastCode = parsedValueFlattener.last(code)
    lastCode && onSuccess && onSuccess({code: lastCode, nonce})
  }, [clientId, initialSearch, onFailure, onSuccess, storedState])

  const startSigninFlow = useCallback((): void => {
    const [state, {nonce}] = setStoredState({...stateToStore, clientId})
    const {host, protocol} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    const url = `${authorizeEndpoint}?${stringify({
      // eslint-disable-next-line camelcase
      client_id: clientId,
      nonce,
      // eslint-disable-next-line  camelcase
      redirect_uri: redirectUri,
      // eslint-disable-next-line  camelcase
      response_type: 'code',
      state,
      ...(scopes ? {scope: scopes.join(' ')} : {}),
      ...authorizeParams,
    })}`
    window.location.href = url
  }, [authorizeEndpoint, authorizeParams, clientId, scopes, stateToStore])

  const buttonStyle: React.CSSProperties = {
    padding: '5px 10px',
    ...style,
  }
  const imageStyle: React.CSSProperties = {
    height: 31,
    marginRight: 10,
    verticalAlign: 'middle',
    width: 34,
  }
  return <button {...extraProps} onClick={startSigninFlow} style={buttonStyle} type="button">
    <img style={imageStyle} src={logo} alt="" />
    {children}
  </button>
}
const OAuth2ConnectLogin = React.memo(OAuth2ConnectLoginBase)


const LoginModalBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const loginModal = useSelector(
    ({app: {loginModal}}: RootState) => loginModal,
  )
  const {defaultValues: {isReturningUser = false, resetToken = ''} = {}} = loginModal || {}
  const isLoginFormShownByDefault = !!isReturningUser
  // TODO(cyrille): Clean this up, since modal is never rendered if !loginModal.
  const wantShown = !!(loginModal || resetToken)

  const [isShown, setIsShown] = useState(false)
  const [isShownAsFullPage, setIsShownAsfullPage] = useState(false)

  useLayoutEffect((): void => {
    if (wantShown === isShown) {
      return
    }
    setIsShown(wantShown)
    if (wantShown) {
      setIsShownAsfullPage(!isMobileVersion && !resetToken && !isLoginFormShownByDefault)
    }
  }, [isShown, resetToken, isLoginFormShownByDefault, wantShown])

  const handleClose = useCallback((): void => {
    dispatch(closeLoginModal())
  }, [dispatch])

  const {t} = useTranslation('components')

  const renderIntro = useCallback((style: React.CSSProperties): React.ReactNode => {
    const containerStyle: React.CSSProperties = {
      minHeight: '100vh',
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const coverAll: React.CSSProperties = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle: React.CSSProperties = {
      ...coverAll,
      backgroundImage: `url(${portraitCoverImage})`,
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    const portraitQuoteStyle: React.CSSProperties = {
      bottom: 0,
      fontSize: 18,
      lineHeight: 1.44,
      margin: '60px 50px',
      position: 'absolute',
    }
    const coverShadeStyle: React.CSSProperties = {
      ...coverAll,
      backgroundColor: colors.BOB_BLUE,
      opacity: .8,
      zIndex: -1,
    }

    return <div style={containerStyle}>
      <div
        style={{...coverShadeStyle, background: 'linear-gradient(to bottom, transparent, #000)'}} />
      <div style={coverImageStyle} />
      <div>
        <img
          style={{height: 35, marginLeft: 60, marginTop: 30}}
          src={logoProductImage} alt={config.productName} />
        <div style={portraitQuoteStyle}>
          <blockquote style={{color: '#fff', fontStyle: 'italic', margin: 0, maxWidth: 360}}>
            «&nbsp;{t(
              "{{productName}} a provoqué l'étincelle chez moi. J'ai compris qu'il fallait que " +
              'je me tourne prioritairement vers des entreprises qui me plaisent et que je ' +
              'mobilise plus activement mon réseau.',
              {productName: config.productName},
            )}&nbsp;»
          </blockquote>
          <p style={{color: colors.WARM_GREY, margin: '25px 0 0'}}>{t('Catherine, 37 ans')}</p>
        </div>
      </div>
    </div>
  }, [t])

  const containerStyle: React.CSSProperties = isShownAsFullPage ? {
    alignItems: 'center',
    borderRadius: 0,
    display: 'flex',
    transition: 'none',
    width: '100vw',
  } : {
    width: isMobileVersion ? 'initial' : 400,
  }
  const closeButtonStyle: RadiumCSSProperties = {
    ':focus': {
      opacity: .9,
    },
    ':hover': {
      opacity: .9,
    },
    'boxShadow': 'initial',
    'opacity': .6,
    'right': 50,
    'top': 50,
    'transform': 'initial',
  }
  const titleId = useMemo(_uniqueId, [])

  return <Modal
    isShown={isShown || !!resetToken} style={containerStyle}
    onClose={(resetToken || isShownAsFullPage) ? undefined : handleClose}
    aria-labelledby={titleId}>
    {isShownAsFullPage ? renderIntro({flex: .5}) : null}
    {isShownAsFullPage ?
      <ModalCloseButton
        onClick={handleClose} style={closeButtonStyle}
        aria-describedby={titleId} /> : null}
    <LoginMethods onFinish={handleClose} titleId={titleId} />
  </Modal>
}
const LoginModal = React.memo(LoginModalBase)


interface MethodsProps {
  forwardLocation?: string
  onFinish?: () => void
  onLogin?: (user: bayes.bob.User) => void
  titleId?: string
}


const LoginMethodsBase = (props: MethodsProps): React.ReactElement => {
  const {onFinish, onLogin, titleId} = props
  const loginModal = useSelector(
    ({app: {loginModal}}: RootState): RootState['app']['loginModal'] => loginModal,
  )
  const {email: defaultEmail = '', isReturningUser = false, resetToken = ''} = loginModal &&
    loginModal.defaultValues || {}
  const isLoginFormShownByDefault = !!isReturningUser
  const {pathname, search} = useLocation()
  const history = useHistory()
  const [forwardLocation, setForwardLocation] =
    useState<string|undefined>(props.forwardLocation || pathname)

  const [isLoginFormShown, setIsLoginFormShown] = useState(isLoginFormShownByDefault)
  const showLogin = useCallback((): void => setIsLoginFormShown(true), [])
  const showRegister = useCallback((): void => setIsLoginFormShown(false), [])

  const {state} = parseQueryString(search)
  const [storedState, setStoredState] = useState(
    (): StoredState|undefined => state && getStoredState(state) || undefined,
  )
  useLayoutEffect((): void => {
    const newStoredState = state && getStoredState(state) || undefined
    if (newStoredState) {
      setStoredState(newStoredState)
    }
  }, [state])

  useLayoutEffect((): void => {
    if (!storedState) {
      return
    }
    setForwardLocation(storedState.location)
    if (storedState.isNewUser) {
      showRegister()
    } else {
      showLogin()
    }
  }, [storedState, showLogin, showRegister])

  const handleActualLogin = useCallback((user: bayes.bob.User): void => {
    const {location = undefined} = storedState || {}
    onLogin?.(user)
    onFinish?.()
    if (location && pathname !== location) {
      history.push(location)
    }
  }, [history, onFinish, onLogin, pathname, storedState])

  const actionBoxStyle: React.CSSProperties = {
    alignItems: 'center',
    alignSelf: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    padding: '30px 20px',
  }
  const stateToStore = {isNewUser: !isLoginFormShown, location: forwardLocation}
  let form
  if (resetToken) {
    form = <ResetPasswordForm
      defaultEmail={defaultEmail} onLogin={handleActualLogin} resetToken={resetToken}
      titleId={titleId} />
  } else if (isLoginFormShown) {
    form = <LoginForm
      onLogin={handleActualLogin} defaultEmail={defaultEmail}
      stateToStore={stateToStore} storedState={storedState}
      onShowRegistrationFormClick={showRegister} titleId={titleId} />
  } else {
    form = <RegistrationForm
      onLogin={handleActualLogin} stateToStore={stateToStore} storedState={storedState}
      onShowLoginFormClick={showLogin} titleId={titleId} />
  }
  // TODO(pascal): Simplify and cleanup styling here.
  return <div style={{flex: 1, ...Styles.CENTERED_COLUMN}}>
    <div style={actionBoxStyle}>
      {form}
    </div>
  </div>
}
const LoginMethods = React.memo(LoginMethodsBase)


const circularProgressStyle: React.CSSProperties = {
  color: '#fff',
  display: 'inline-block',
  textAlign: 'center',
  verticalAlign: 'middle',
  width: 170,
}
const googleIconStyle: React.CSSProperties = {
  height: 24,
  marginRight: 10,
  verticalAlign: 'middle',
  width: 34,
}

interface GoogleButtonProps {
  isAuthenticating?: boolean
  onClick: () => void
}

const GoogleButtonBase = (props: GoogleButtonProps): React.ReactElement => {
  const {isAuthenticating, onClick} = props
  const {t} = useTranslation('components')
  return <button className="login google-login" onClick={onClick} type="button">
    <GoogleIcon style={googleIconStyle} aria-hidden={true} focusable={false} />{isAuthenticating ?
      <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
      t('Se connecter avec {{service}}', {service: 'Google'})}
  </button>
}
const GoogleButton = React.memo(GoogleButtonBase)


interface StatefulFacebookLoginProps extends ReactFacebookLoginProps {
  stateToStore?: StoredState
  storedState?: StoredState
}

const StatefulFacebookLoginBase = (props: StatefulFacebookLoginProps): React.ReactElement => {
  // TODO(cyrille): Remove callback hack once react-facebook-login has fixed
  // https://github.com/keppelen/react-facebook-login/issues/262.
  const {appId, callback, onClick, stateToStore, storedState: {clientId = ''} = {}, ...otherProps} =
    props
  const [stateKey, setStateKey] = useState(getRandomHash)
  const [nextKey, setNextKey] = useState(stateKey)

  useEffect((): (() => void) => {
    if (nextKey === stateKey) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setStateKey(nextKey), 100)
    return (): void => window.clearTimeout(timeout)
  }, [nextKey, stateKey])

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    if (isMobileVersion) {
      setStoredState({...stateToStore, clientId: appId}, stateKey)
      // Prepare a new stateKey for the next time the button is clicked.
      setNextKey(getRandomHash())
    }
    onClick && onClick(event)
  }, [appId, onClick, stateKey, stateToStore])

  const {protocol, host} = window.location
  const redirectUri = `${protocol}//${host}${Routes.ROOT}`
  return <FacebookLogin
    {...otherProps} appId={appId} redirectUri={redirectUri} state={stateKey}
    callback={clientId === appId || !clientId ? callback : noOp} onClick={handleClick} />
}
const StatefulFacebookLogin = React.memo(StatefulFacebookLoginBase)


interface SocialButtonProps {
  isNewUser?: boolean
  onLogin: ((user: bayes.bob.User) => void)
  returningClientId?: string
  returningNonce?: string
  stateToStore?: StoredState
  storedState?: StoredState
  style?: React.CSSProperties
}

const SocialLoginButtonsBase = (props: SocialButtonProps): React.ReactElement => {
  const {isNewUser: wantsNewUser, onLogin} = props

  const authMethod = useSelector(
    ({asyncState: {authMethod}}: RootState): string|undefined => authMethod,
  )
  const isAuthenticating = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean =>
      !!isFetching['EMAIL_CHECK'] || !!isFetching['AUTHENTICATE_USER'],
  )

  const dispatch = useDispatch<DispatchAllActions>()

  const {t} = useTranslation('components')

  const handleAuthResponse = useCallback((response: bayes.bob.AuthResponse | void): void => {
    if (!response) {
      return
    }
    const {authenticatedUser, isNewUser} = response
    if (!authenticatedUser) {
      return
    }
    if (isNewUser && !wantsNewUser) {
      dispatch(displayToasterMessage(t("Création d'un nouveau compte")))
    } else if (!isNewUser && wantsNewUser) {
      dispatch(displayToasterMessage(t('Connexion avec le compte existant')))
    }
    // TODO(pascal): Make sure we go to /confidentialite page on first registration.
    onLogin(authenticatedUser)
  }, [dispatch, wantsNewUser, onLogin, t])

  const handleFacebookLogin = useCallback(
    async (facebookAuth: ReactFacebookLoginInfo): Promise<void> => {
      const response = await dispatch(facebookAuthenticateUser(facebookAuth))
      handleAuthResponse(response)
    }, [dispatch, handleAuthResponse])

  const handleGoogleLogin = useCallback(
    async (googleResponse: GoogleLoginResponse|GoogleLoginResponseOffline): Promise<void> => {
      const googleAuth = googleResponse as GoogleLoginResponse
      if (!googleAuth.getId) {
        throw new Error('Google Login offline response, this should never happen')
      }
      // The googleAuth object contains the profile in getBasicProfile()
      //  - the Google ID: getId()
      //  - the email address: getEmail()
      //  - the first name: getGivenName()
      //  - the last name: getFamilyName()
      //  - the full name: getName()
      //  - the URL of a profile picture: getImageUrl()
      const email = googleAuth && googleAuth.getBasicProfile().getEmail()
      if (email) {
        const response = await dispatch(googleAuthenticateUser(googleAuth))
        handleAuthResponse(response)
      }
    },
    [dispatch, handleAuthResponse],
  )

  const handleGoogleFailure = useCallback(({details}: {details: string}): void => {
    dispatch(displayToasterMessage(details))
  }, [dispatch])

  const handleConnectFailure = useCallback((error: {message: string}): void => {
    dispatch(displayToasterMessage(error.message))
  }, [dispatch])

  const handlePEConnectLogin = useCallback(
    async ({code, nonce}: {code: string; nonce: string}): Promise<void> => {
      const response = await dispatch(peConnectAuthenticateUser(code, nonce))
      handleAuthResponse(response)
    }, [dispatch, handleAuthResponse])

  const handleLinkedinLogin = useCallback(async ({code}: {code: string}): Promise<void> => {
    const response = await dispatch(linkedInAuthenticateUser(code))
    handleAuthResponse(response)
  }, [dispatch, handleAuthResponse])

  const isGoogleAuthenticating = !!isAuthenticating && authMethod === 'google'
  const MyGoogleButton = useCallback(
    (props: GoogleButtonProps): React.ReactElement =>
      <GoogleButton isAuthenticating={isGoogleAuthenticating} {...props} />,
    [isGoogleAuthenticating],
  )

  const {stateToStore, storedState, style} = props
  const socialLoginBox = useMemo((): React.CSSProperties => ({
    ...style,
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 15,
  }), [style])
  const circularProgress = <CircularProgress
    size={23} style={circularProgressStyle} thickness={2} />
  return <div style={socialLoginBox}>
    {config.facebookSSOAppId ? <StatefulFacebookLogin
      appId={config.facebookSSOAppId} language="fr" isDisabled={isAuthenticating}
      callback={handleFacebookLogin}
      fields="email,name,picture,gender,birthday"
      storedState={storedState}
      size="small" icon="fa-facebook" stateToStore={stateToStore}
      textButton={isAuthenticating && authMethod === 'facebook' ?
        // react-facebook-login expects a string. Beware on lib update.
        circularProgress as unknown as string :
        t('Se connecter avec {{service}}', {service: 'Facebook'})}
      cssClass="login facebook-login" /> : null}
    {config.googleSSOClientId ? <GoogleLogin
      clientId={config.googleSSOClientId} disabled={isAuthenticating}
      onSuccess={handleGoogleLogin}
      onFailure={handleGoogleFailure}
      render={MyGoogleButton} /> : null}
    {config.emploiStoreClientId ? <OAuth2ConnectLogin
      authorizeEndpoint="https://authentification-candidat.pole-emploi.fr/connexion/oauth2/authorize"
      scopes={PE_CONNECT_SCOPES}
      authorizeParams={{realm: '/individu'}} disabled={isAuthenticating}
      clientId={config.emploiStoreClientId} stateToStore={stateToStore} storedState={storedState}
      className="login pe-connect-login"
      logo={peConnectIcon}
      onSuccess={handlePEConnectLogin}
      onFailure={handleConnectFailure}>
      {isAuthenticating && authMethod === 'peConnect' ?
        circularProgress : t('Se connecter avec {{service}}', {service: 'pôle emploi'})}
    </OAuth2ConnectLogin> : null}
    {config.linkedInClientId ? <OAuth2ConnectLogin
      clientId={config.linkedInClientId} disabled={isAuthenticating} stateToStore={stateToStore}
      authorizeEndpoint="https://www.linkedin.com/oauth/v2/authorization"
      scopes={LINKEDIN_SCOPES} storedState={storedState}
      onSuccess={handleLinkedinLogin}
      onFailure={handleConnectFailure}
      logo={linkedInIcon} style={{marginBottom: 0}}
      className="login linkedin-login">
      {isAuthenticating && authMethod === 'linkedIn' ?
        circularProgress : t('Se connecter avec {{service}}', {service: 'LinkedIn'})}
    </OAuth2ConnectLogin> : null}
  </div>
}
const SocialLoginButtons = React.memo(SocialLoginButtonsBase)


const useLoginLink = (email: string|undefined, isSignUp: boolean, visualElement: string):
{onClick: () => void; to: LinkButtonProps['to']|null} => {
  const dispatch = useDispatch<DispatchAllActions>()
  const {pathname} = useLocation()
  const hasUserId = useSelector(({user: {userId}}: RootState): boolean => !!userId)
  const hasAccount = useSelector(({user: {hasAccount}}: RootState): boolean => !!hasAccount)
  const isGuest = hasUserId && !hasAccount
  const isRegisteredUser = hasUserId && hasAccount

  const handleClick = useCallback((): void => {
    if (isRegisteredUser) {
      return
    }
    if (!isGuest && isSignUp) {
      dispatch(startAsGuest(visualElement))
      return
    }
    if (isSignUp) {
      dispatch(openRegistrationModal({email}, visualElement))
    } else {
      dispatch(openLoginModal({email}, visualElement))
    }
  }, [email, isGuest, isRegisteredUser, isSignUp, dispatch, visualElement])

  const to = useMemo((): LinkButtonProps['to']|null => {
    if (isRegisteredUser) {
      return Routes.PROJECT_PAGE
    }
    if (!isGuest && isSignUp) {
      return Routes.INTRO_PAGE
    }
    if (isMobileVersion) {
      return {
        pathname: Routes.SIGNUP_PAGE,
        state: {pathname},
      }
    }
    return null
  }, [isGuest, isRegisteredUser, isSignUp, pathname])
  return {onClick: handleClick, to}
}


interface LinkConfig {
  email?: string
  isSignUp?: boolean
  style?: React.CSSProperties
  visualElement: string
}

interface LoginLinkProps extends LinkConfig {
  children: string
  tabIndex?: number
}

interface InternalCommonProps {
  children: string
  onClick: () => void
  style: React.CSSProperties
  tabIndex?: number
}

const LoginLinkBase = (props: LoginLinkProps): React.ReactElement|null => {
  const {
    children,
    email,
    isSignUp,
    style,
    tabIndex,
    visualElement,
  } = props

  const {onClick, to} = useLoginLink(email, !!isSignUp, visualElement)

  const commonProps = useMemo((): InternalCommonProps => ({
    children,
    onClick,
    style: {
      padding: 0,
      ...style,
    },
    tabIndex,
  }), [children, onClick, style, tabIndex])
  if (!config.isLoginEnabled) {
    return null
  }
  if (to) {
    return <Link {...commonProps} to={to} />
  }
  return <button type="button" {...commonProps} />
}
const LoginLink = React.memo(LoginLinkBase)


type LinkButtonProps = React.ComponentProps<typeof LinkButton>
type LoginButtonProps = LinkConfig & Omit<LinkButtonProps, 'href'|'to'>


const LoginButtonBase = (props: LoginButtonProps): React.ReactElement|null => {
  const {children, email, isSignUp, style, tabIndex, visualElement, ...otherProps} = props
  const {onClick, to} = useLoginLink(email, !!isSignUp, visualElement)
  if (!config.isLoginEnabled) {
    return null
  }
  if (to) {
    return <LinkButton
      type="deletion" onClick={onClick} to={to} style={style} tabIndex={tabIndex} {...otherProps}>
      {children}
    </LinkButton>
  }
  return <Button
    type="deletion" onClick={onClick} style={style} tabIndex={tabIndex} {...otherProps}>
    {children}
  </Button>
}
const LoginButton = React.memo(LoginButtonBase)


export {LoginModal, LoginMethods, LoginLink, LoginButton, ResetPasswordForm, useLoginLink}
