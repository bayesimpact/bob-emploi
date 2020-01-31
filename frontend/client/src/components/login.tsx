import Storage from 'local-storage-fallback'
import _memoize from 'lodash/memoize'
import AccountOutlineIcon from 'mdi-react/AccountOutlineIcon'
import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import GoogleIcon from 'mdi-react/GoogleIcon'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import {parse, stringify} from 'query-string'
import React, {useCallback, useMemo, useState} from 'react'
import FacebookLogin, {ReactFacebookLoginInfo, ReactFacebookLoginProps} from 'react-facebook-login'
import GoogleLogin, {GoogleLoginResponse, GoogleLoginResponseOffline} from 'react-google-login'
import {WithTranslation, useTranslation, withTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Link, LinkProps} from 'react-router-dom'

import {DispatchAllActions, RootState, askPasswordReset, changePassword, closeLoginModal,
  displayToasterMessage, emailCheck, facebookAuthenticateUser, googleAuthenticateUser,
  linkedInAuthenticateUser, loginUser, noOp, openLoginModal, openRegistrationModal,
  peConnectAuthenticateUser, registerNewUser, resetPassword, startAsGuest} from 'store/actions'
import {parseQueryString, parsedValueFlattener} from 'store/parse'
import {getUniqueExampleEmail} from 'store/user'
import {validateEmail} from 'store/validations'

import {FastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalCloseButton} from 'components/modal'
import {ButtonProps, Button, CircularProgress, IconInput, LabeledToggle, Styles,
  chooseImageVersion} from 'components/theme'
import {Routes} from 'components/url'
import linkedInIcon from 'images/linked-in.png'
import logoProductImage from 'images/bob-logo.svg'
import peConnectIcon from 'images/pole-emploi-connect.svg'
import portraitCoverImage from 'images/catherine_portrait.jpg?multi&sizes[]=1440&sizes[]=600'


// TODO(cyrille): Add 'pfccompetences', 'api_peconnect-competencesv2' once we have upgraded
// to competences v2.
const PE_CONNECT_SCOPES = ['api_peconnect-individuv1', 'profile', 'email', 'coordonnees',
  'api_peconnect-coordonneesv1', 'openid']

const LINKEDIN_SCOPES = ['r_liteprofile', 'r_emailaddress']

const toLocaleLowerCase = (email: string): string => email.toLocaleLowerCase()

const stopPropagation = (event: React.SyntheticEvent): void => event.stopPropagation()

interface LoginConnectedProps {
  isAskingForPasswordReset?: boolean
  isAuthenticatingEmail?: boolean
  isAuthenticatingOther?: boolean
}

interface LoginProps extends LoginConnectedProps {
  defaultEmail: string
  dispatch: DispatchAllActions
  onLogin: (user: bayes.bob.User) => void
  onShowRegistrationFormClick: () => void
  stateToStore: StoredState
  storedState?: StoredState
}

const loginBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  marginTop: 15,
}
const lostPasswordLinkStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  display: 'inline-block',
  fontSize: 13,
  marginLeft: 15,
  marginTop: 12,
  textDecoration: 'none',
}


const LoginFormBase = (props: LoginProps): React.ReactElement => {
  const {
    defaultEmail,
    dispatch,
    isAskingForPasswordReset,
    isAuthenticatingOther,
    isAuthenticatingEmail,
    onLogin,
    onShowRegistrationFormClick,
    stateToStore,
    storedState,
  } = props

  const [email, setEmail] = useState(defaultEmail)
  const [hashSalt, setHashSalt] = useState('')
  const [isTryingToResetPassword, setIsTryingToResetPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordResetRequestedEmail, setPasswordRequestedEmail] = useState('')

  const {t} = useTranslation()

  const isFormValid = useMemo((): boolean => {
    return !!((isTryingToResetPassword || password) && validateEmail(email))
  }, [email, isTryingToResetPassword, password])

  const handleLogin = useCallback((event?: React.SyntheticEvent): void => {
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!isFormValid) {
      return
    }
    dispatch(emailCheck(email)).
      then((response): bayes.bob.AuthResponse | void => {
        if (response && response.hashSalt) {
          setHashSalt(response.hashSalt)
        }
        return response
      }).
      then((response): bayes.bob.AuthResponse | void => {
        if (!response) {
          return response
        }
        if (response.isNewUser) {
          // TODO: Emphasize to registration form if response.isNewUser
          dispatch(displayToasterMessage(t("L'utilisateur n'existe pas.")))
          return
        }
        // TODO: Use different API endpoints for login and registration.
        dispatch(loginUser(email, password, hashSalt)).
          then((response): bayes.bob.AuthResponse | void => {
            if (response && response.authenticatedUser) {
              onLogin(response.authenticatedUser)
              // TODO: Take care of the else case when the authentication was
              // not successful but we got back some new salt. (response.hashSalt)
            }
            return response
          })
        return response
      })
  }, [dispatch, email, hashSalt, isFormValid, onLogin, password, t])

  const handleLostPasswordClick = useCallback((event?: React.SyntheticEvent): void => {
    if (event) {
      event.preventDefault()
    }
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
        t('Entrez correctement votre email dans le champs ci-dessus pour récupérer ' +
          'votre mot de passe.')))
      setIsTryingToResetPassword(true)
      return
    }
    dispatch(askPasswordReset(email)).then((response): bayes.bob.AuthResponse | void => {
      if (response) {
        setPasswordRequestedEmail(email)
        return response
      }
    })
  }, [dispatch, email, t])

  const isMissingEmail = !email
  const isMissingPassword = !password

  const fastForward = useCallback((): void => {
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
    <FastForward onForward={fastForward} />
    <FormHeader
      title={isTryingToResetPassword ? t('Mot de passe oublié\u00A0?') : t("S'identifier")}
      question={isTryingToResetPassword ? '' : t('Pas encore de compte\u00A0?')}
      linkText={t('Inscrivez-vous\u00A0!')}
      onClick={onShowRegistrationFormClick} />

    <SocialLoginButtons stateToStore={stateToStore} storedState={storedState} onLogin={onLogin} />

    <FormSection title={t('Identification par mot de passe')}>
      <IconInput
        shouldFocusOnMount={!email}
        type="email" autoComplete="current-password"
        placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase}
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        onChange={setEmail} />
      {isTryingToResetPassword ? null : <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="new-password"
        shouldFocusOnMount={!!email}
        placeholder={t('Mot de passe')} value={password} iconComponent={LockOutlineIcon}
        onChange={setPassword}
        style={{marginTop: 10}} />}
    </FormSection>

    {isTryingToResetPassword ? null : <Trans
      style={{...lostPasswordLinkStyle, cursor: 'pointer'}}
      onClick={handleLostPasswordClick} parent="a">
      Mot de passe oublié&nbsp;?
    </Trans>}
    {passwordResetRequestedEmail ?
      <Trans style={lostPasswordLinkStyle} parent="span">
        Un email a été envoyé à {{passwordResetRequestedEmail}}
      </Trans>
      : <Button
        disabled={!isFormValid || isAuthenticatingOther || isAuthenticatingEmail}
        onClick={handleSubmit}
        style={{alignSelf: 'center', marginTop: 30}}
        isNarrow={true}
        isProgressShown={(isAuthenticatingEmail || isAskingForPasswordReset)}
        type="validation">
        {isTryingToResetPassword ? t('Récupérer son mot de passe') : t("S'identifier")}
      </Button>}
  </form>
}
LoginFormBase.propTypes = {
  defaultEmail: PropTypes.string,
  dispatch: PropTypes.func.isRequired,
  isAskingForPasswordReset: PropTypes.bool,
  isAuthenticatingEmail: PropTypes.bool,
  isAuthenticatingOther: PropTypes.bool,
  onLogin: PropTypes.func.isRequired,
  onShowRegistrationFormClick: PropTypes.func.isRequired,
}
const LoginForm =
  connect(({asyncState: {authMethod, isFetching}}: RootState): LoginConnectedProps => ({
    isAskingForPasswordReset: isFetching['RESET_USER_PASSWORD'],
    isAuthenticatingEmail:
      isFetching['EMAIL_CHECK'] || isFetching['AUTHENTICATE_USER'] && authMethod === 'password',
    isAuthenticatingOther: isFetching['AUTHENTICATE_USER'] && authMethod !== 'password',
  }))(React.memo(LoginFormBase))


interface ResetPasswordConnectedProps {
  hasTokenExpired: boolean
  isAuthenticating: boolean
}

interface ResetPasswordProps extends ResetPasswordConnectedProps, WithTranslation {
  defaultEmail?: string
  dispatch: DispatchAllActions
  inputRef?: React.RefObject<IconInput>
  isEmailShown?: boolean
  isTitleShown?: boolean
  onLogin: (user: bayes.bob.User) => void
  resetToken?: string
  style?: React.CSSProperties
}

interface ResetPasswordState {
  email?: string
  hashSalt?: string
  oldPassword?: string
  password?: string
  passwordResetRequestedEmail?: string
}

// TODO(cyrille): Check whether the token has expired on mount, to avoid having the expiration error
// after the user has entered their new password.
class ResetPasswordFormBase extends React.PureComponent<ResetPasswordProps, ResetPasswordState> {
  public static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    hasTokenExpired: PropTypes.bool.isRequired,
    isAuthenticating: PropTypes.bool,
    isTitleShown: PropTypes.bool.isRequired,
    onLogin: PropTypes.func.isRequired,
    resetToken: PropTypes.string,
    style: PropTypes.object,
    t: PropTypes.func.isRequired,
  }

  public static defaultProps = {
    isEmailShown: true,
    isTitleShown: true,
  }

  public state: ResetPasswordState = {
    email: this.props.defaultEmail || '',
    oldPassword: '',
    password: '',
  }

  public componentDidMount(): void {
    const {defaultEmail, dispatch, resetToken} = this.props
    if (!resetToken && defaultEmail) {
      dispatch(emailCheck(defaultEmail)).
        then((response): bayes.bob.AuthResponse|void => {
          if (response && response.hashSalt) {
            this.setState({hashSalt: response.hashSalt})
          }
          return response
        })
    }
  }

  private handleEmailChange = (email: string): void => this.setState({email})

  private handleOldPasswordChange = (oldPassword: string): void => this.setState({oldPassword})

  private handlePasswordChange = (password: string): void => this.setState({password})

  private handleResetPassword = (): void => {
    if (!this.isFormValid()) {
      return
    }
    const {email, hashSalt, oldPassword, password} = this.state
    const {dispatch, onLogin, resetToken} = this.props

    if (!email) {
      return
    }

    if (resetToken && password) {
      dispatch(resetPassword(email, password, resetToken)).
        then((response): void => {
          if (response && response.authenticatedUser) {
            onLogin(response.authenticatedUser)
          }
        })
      return
    }

    if (oldPassword && hashSalt && password) {
      dispatch(changePassword(email, oldPassword, hashSalt, password)).
        then((response): void => {
          if (response && response.isPasswordUpdated && response.authenticatedUser) {
            onLogin(response.authenticatedUser)
          }
        })
    }
  }

  private handleResetPasswordForm = (event: React.SyntheticEvent): void => {
    event.preventDefault()
    this.handleResetPassword()
  }

  private handleResendEmail = (): void => {
    const {email} = this.state
    if (!email) {
      return
    }
    this.props.dispatch(askPasswordReset(email)).then((response): void => {
      if (response) {
        this.setState({passwordResetRequestedEmail: email})
      }
    })
  }

  private isFormValid = (): boolean => {
    const {resetToken} = this.props
    const {email, oldPassword, password} = this.state
    return !!(password && validateEmail(email) && (resetToken || oldPassword))
  }

  private renderExpiredToken(): React.ReactNode {
    const {t} = this.props
    const {passwordResetRequestedEmail} = this.state
    const emailSentStyle = {
      fontStyle: 'italic',
      marginTop: 10,
    }
    return <div>
      <FormHeader title={t("Moyen d'authentification périmé")} />
      <Trans>
        Le lien que vous avez utilisé est trop vieux. Veuillez
        vous <LoginLink visualElement="expired-resetToken">
          reconnecter
        </LoginLink> ou <a href="#" onClick={this.handleResendEmail}>cliquer ici</a> pour
        réinitialiser votre mot de passe.
      </Trans>
      {passwordResetRequestedEmail ? <Trans style={emailSentStyle}>
        Un email a été envoyé à {{passwordResetRequestedEmail}}
      </Trans> : null}
    </div>
  }

  public render(): React.ReactNode {
    const {inputRef, hasTokenExpired, isAuthenticating, isTitleShown = true, resetToken,
      style, t} = this.props
    if (hasTokenExpired) {
      return this.renderExpiredToken()
    }
    const {email, oldPassword, password} = this.state
    const loginBoxStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
      ...style,
    }
    return <form style={loginBoxStyle} onSubmit={this.handleResetPasswordForm}>
      {isTitleShown ? <FormHeader title={t('Changez votre mot de passe')} /> : null}
      {resetToken ? <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={!email} autoComplete="email"
        type="email" placeholder={t('Email')} value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase}
        onChange={this.handleEmailChange} /> : <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="password" shouldFocusOnMount={true}
        placeholder={t('Mot de passe actuel')} value={oldPassword} iconComponent={LockOutlineIcon}
        onChange={this.handleOldPasswordChange} ref={inputRef} />}
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="new-password" shouldFocusOnMount={!!email}
        placeholder={t('Nouveau mot de passe')} value={password} iconComponent={LockOutlineIcon}
        onChange={this.handlePasswordChange}
        style={{marginTop: 10}} ref={resetToken ? inputRef : undefined} />
      <Button
        disabled={!this.isFormValid()}
        onClick={this.handleResetPassword}
        style={{alignSelf: 'center', marginTop: 30}}
        isProgressShown={isAuthenticating}
        isNarrow={true}
        type="validation">
        <Trans parent={null}>Changer le mot de passe</Trans>
      </Button>
    </form>
  }
}
const ResetPasswordForm = connect(
  ({app: {hasTokenExpired}, asyncState: {isFetching}}: RootState): ResetPasswordConnectedProps => ({
    hasTokenExpired: !!hasTokenExpired,
    isAuthenticating: !!(isFetching['EMAIL_CHECK'] || isFetching['AUTHENTICATE_USER']),
  }))(withTranslation()(ResetPasswordFormBase))


interface RegistrationConnectedProps {
  defaultEmail: string
  hasUser?: boolean
  isAuthenticating: boolean
  shouldRequestNames?: boolean
}

interface RegistrationProps extends RegistrationConnectedProps {
  dispatch: DispatchAllActions
  onLogin: (user: bayes.bob.User) => void
  onShowLoginFormClick: () => void
  stateToStore: StoredState
  storedState?: StoredState
}

const registrationBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  marginTop: 15,
}


const RegistrationFormBase = (props: RegistrationProps): React.ReactElement => {
  const {
    defaultEmail,
    dispatch,
    hasUser,
    isAuthenticating,
    onLogin,
    onShowLoginFormClick,
    shouldRequestNames,
    stateToStore,
    storedState,
  } = props

  const [email, setEmail] = useState(defaultEmail)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(!!hasUser)
  const [lastName, setLastName] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const {t} = useTranslation()

  const isFormValid = useMemo((): boolean => {
    return !!(hasAcceptedTerms && password && validateEmail(email) &&
      (!shouldRequestNames || (lastName && name)))
  }, [shouldRequestNames, lastName, name, password, hasAcceptedTerms, email])

  const handleRegister = useCallback((): void => {
    if (!isFormValid) {
      return
    }
    dispatch(registerNewUser(email, password, name, lastName)).
      then((response): bayes.bob.AuthResponse | void => {
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
        return response
      })
  }, [email, lastName, name, password, isFormValid, dispatch, onLogin, onShowLoginFormClick, t])

  const handleToggleAcceptTerms = useCallback(
    (): void => setHasAcceptedTerms(!hasAcceptedTerms),
    [hasAcceptedTerms],
  )

  const isMissingEmail = !email
  const isMissingPassword = !password
  const isMissingName = !name
  const isMissingLastName = !name

  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleRegister()
      return
    }
    if (isMissingEmail) {
      setEmail(getUniqueExampleEmail())
    }
    if (isMissingPassword) {
      setPassword('password')
    }
    // TODO(marielaure) Clean when launching Late Sign Up.
    if (!shouldRequestNames && hasAcceptedTerms) {
      return
    }
    setHasAcceptedTerms(true)
    if (isMissingLastName) {
      setLastName('Dupont')
    }
    if (isMissingName) {
      setName('Angèle')
    }
  }, [
    isMissingName, isMissingPassword, isMissingEmail, isMissingLastName, isFormValid,
    handleRegister, hasAcceptedTerms, shouldRequestNames,
  ])

  // TODO(marielaure) Clean when launching Late Sign Up.
  return <form style={registrationBoxStyle} onSubmit={handleRegister}>
    <FastForward onForward={fastForward} />
    <FormHeader
      title={t('Créer un compte')}
      question={t('Déjà un compte\u00A0?')}
      linkText={t('Connectez-vous\u00A0!')}
      onClick={onShowLoginFormClick} />

    <SocialLoginButtons
      stateToStore={stateToStore} storedState={storedState} onLogin={onLogin} isNewUser={true} />

    <FormSection title={t('Inscription par mot de passe')}>
      {shouldRequestNames ? <React.Fragment>
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          shouldFocusOnMount={true} autoComplete="given-name"
          type="text" placeholder={t('Prénom')} value={name} iconComponent={AccountOutlineIcon}
          onChange={setName} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="text" placeholder={t('Nom')} value={lastName} iconComponent={AccountOutlineIcon}
          onChange={setLastName} autoComplete="family-name"
          style={{marginTop: 10}} />
      </React.Fragment> : null}
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="email" placeholder={t('Email')} value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase} autoComplete="email"
        onChange={setEmail}
        style={{marginTop: 10}} />
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="new-password"
        placeholder={t('Créer un mot de passe')} value={password} iconComponent={LockOutlineIcon}
        onChange={setPassword}
        style={{marginTop: 10}} />
    </FormSection>

    <Trans style={{fontSize: 12, margin: '10px auto 0', maxWidth: 325}}>
      Nous sommes une association loi 1901 à but non
      lucratif&nbsp;: {{productName: config.productName}} est <strong>gratuit</strong> et
      le restera toujours.
    </Trans>
    {hasUser ? null : <LabeledToggle
      type="checkbox" label={<Trans parent="span">
          J'ai lu et j'accepte les <Link
          to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank" rel="noopener noreferrer"
          onClick={stopPropagation}>
            conditions générales d'utilisation
        </Link>
      </Trans>}
      style={{fontSize: 12, marginTop: 10}}
      isSelected={hasAcceptedTerms}
      onClick={handleToggleAcceptTerms} />}
    <Button
      disabled={!isFormValid}
      onClick={handleRegister}
      style={{alignSelf: 'center', marginTop: 30}}
      isNarrow={true}
      isProgressShown={isAuthenticating}
      type="validation">
      <Trans parent={null}>S'inscrire</Trans>
    </Button>
  </form>
}
RegistrationFormBase.propTypes = {
  defaultEmail: PropTypes.string.isRequired,
  dispatch: PropTypes.func.isRequired,
  hasUser: PropTypes.bool,
  isAuthenticating: PropTypes.bool,
  onLogin: PropTypes.func.isRequired,
  onShowLoginFormClick: PropTypes.func.isRequired,
  shouldRequestNames: PropTypes.bool,
}
const RegistrationForm = connect(({app, asyncState, user}: RootState):
RegistrationConnectedProps => {
  const {
    profile: {name = undefined} = {},
    userId = undefined,
  } = user
  const {email = ''} = app.loginModal && app.loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    hasUser: !!userId,
    isAuthenticating: !!asyncState.isFetching['AUTHENTICATE_USER'],
    shouldRequestNames: !name,
  }
})(React.memo(RegistrationFormBase))


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
    <div style={formSectionTitleStyle}>
      {title}
    </div>
    {children}
  </React.Fragment>
}
FormSectionBase.propTypes = {
  children: PropTypes.node,
  title: PropTypes.node.isRequired,
}
const FormSection = React.memo(FormSectionBase)


interface HeaderProps {
  linkText?: string
  onClick?: () => void
  question?: string
  title: string
}

const headerHeadlineStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 23,
  fontWeight: 500,
  lineHeight: 1.6,
  textAlign: 'center',
}
const formHeaderContentStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.4,
  textAlign: 'center',
}
const formHeaderLinkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  cursor: 'pointer',
  textDecoration: 'underline',
}


const FormHeaderBase = (props: HeaderProps): React.ReactElement => {
  const {linkText, onClick, question, title} = props
  return <div style={{marginBottom: 20}}>
    <div style={headerHeadlineStyle}>{title}</div>
    {question && onClick && linkText ? <div style={formHeaderContentStyle}>
      <span>{question} </span>
      <span onClick={onClick} style={formHeaderLinkStyle}>{linkText}</span>
    </div> : null}
  </div>
}
FormHeaderBase.propTypes = {
  linkText: PropTypes.string,
  onClick: PropTypes.func,
  question: PropTypes.string,
  title: PropTypes.string.isRequired,
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
  Storage.setItem(getLocalStorageKey(stateKey), JSON.stringify(storedState))
  return [stateKey, storedState]
}


function getStoredState(state: string): StoredState|null {
  const stateKey = getLocalStorageKey(state)
  const stateContent = Storage.getItem(stateKey)
  if (!stateContent) {
    return null
  }
  Storage.removeItem(stateKey)
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

class OAuth2ConnectLogin extends React.PureComponent<OAuth2Props> {
  public static propTypes = {
    authorizeEndpoint: PropTypes.string.isRequired,
    authorizeParams: PropTypes.objectOf(PropTypes.string.isRequired),
    children: PropTypes.node,
    clientId: PropTypes.string.isRequired,
    logo: PropTypes.string.isRequired,
    onFailure: PropTypes.func,
    onSuccess: PropTypes.func,
    scopes: PropTypes.arrayOf(PropTypes.string.isRequired),
    stateToStore: PropTypes.shape({
      isNewUser: PropTypes.bool,
      location: PropTypes.string,
    }),
    storedState: PropTypes.shape({
      clientId: PropTypes.string.isRequired,
      nonce: PropTypes.string,
    }),
    style: PropTypes.object,
  }

  public componentDidMount(): void {
    this.connectFromState()
  }

  public componentDidUpdate({storedState}: OAuth2Props): void {
    if (!storedState && this.props.storedState) {
      this.connectFromState()
    }
  }

  private connectFromState(): void {
    const {clientId, onFailure, onSuccess, storedState} = this.props
    // TODO(cyrille): Rather use withRouter
    const {search} = window.location
    if (!search || !storedState) {
      return
    }
    const {clientId: storedClientId, nonce} = storedState
    if (storedClientId !== clientId) {
      return
    }
    const {code, error, error_description: errorDescription, state} = parse(search.slice(1))
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
  }

  private startSigninFlow = (): void => {
    const {authorizeEndpoint, authorizeParams, clientId, scopes, stateToStore} = this.props
    const [state, {nonce}] = setStoredState({...stateToStore, clientId})
    const {host, protocol} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    const url = `${authorizeEndpoint}?${stringify({
      // eslint-disable-next-line @typescript-eslint/camelcase
      client_id: clientId,
      nonce,
      // eslint-disable-next-line @typescript-eslint/camelcase
      redirect_uri: redirectUri,
      // eslint-disable-next-line @typescript-eslint/camelcase
      response_type: 'code',
      state,
      ...(scopes ? {scope: scopes.join(' ')} : {}),
      ...authorizeParams,
    })}`
    window.location.href = url
  }

  public render(): React.ReactNode {
    const {children, logo, style,
      authorizeEndpoint: omittedEndPoint, authorizeParams: omittedParams, clientId: omittedId,
      isNewUser: omittedIsNewUser, onFailure: omittedOnFailure, onSuccess: omittedOnSuccess,
      scopes: omittedScopes, stateToStore: omittedStateToStore, storedState: omittedStoredState,
      ...extraProps} = this.props
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
    return <button {...extraProps} onClick={this.startSigninFlow} style={buttonStyle} type="button">
      <img style={imageStyle} src={logo} alt="Icône Pôle emploi" />
      {children}
    </button>
  }
}


interface ModalConnectedProps {
  isLoginFormShownByDefault: boolean
  isShown: boolean
  resetToken: string
}

interface ModalProps extends ModalConnectedProps {
  dispatch: DispatchAllActions
}

interface ModalState {
  isShown: boolean
  isShownAsFullPage: boolean
}

class LoginModalBase extends React.PureComponent<ModalProps, ModalState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    isShown: PropTypes.bool,
    resetToken: PropTypes.string,
  }

  public state: ModalState = {
    isShown: false,
    isShownAsFullPage: false,
  }

  public static getDerivedStateFromProps(nextProps: ModalProps, {isShown: wasShown}: ModalState):
  Partial<ModalState>|null {
    const {isLoginFormShownByDefault, isShown, resetToken} = nextProps
    const wantShown = isShown || !!resetToken
    if (wantShown === wasShown) {
      return null
    }
    const newState = {
      isShown: wantShown,
      ...wantShown && {
        isShownAsFullPage: !isMobileVersion && !resetToken && !isLoginFormShownByDefault,
      },
    }
    return newState
  }

  private handleClose = (): void => {
    this.props.dispatch(closeLoginModal())
  }

  // TODO(marielaure): Put a carousel for cover image.
  private renderIntro(style: React.CSSProperties): React.ReactNode {
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
      backgroundImage: `url(${chooseImageVersion(portraitCoverImage, isMobileVersion)})`,
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
          style={{height: 25, marginLeft: 60, marginTop: 30}}
          src={logoProductImage} alt={config.productName} />
        <div style={portraitQuoteStyle}>
          <div style={{color: '#fff', fontStyle: 'italic', maxWidth: 360}}>
            «&nbsp;{config.productName} a provoqué l'étincelle chez moi. J'ai
            compris qu'il fallait que je me tourne prioritairement vers des entreprises
            qui me plaisent et que je mobilise plus activement mon réseau.&nbsp;»
          </div>
          <div style={{color: colors.WARM_GREY, marginTop: 25}}>Catherine, 37 ans</div>
        </div>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {resetToken} = this.props
    const {isShownAsFullPage} = this.state

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
      ':hover': {
        opacity: .9,
      },
      'boxShadow': 'initial',
      'opacity': .6,
      'right': 50,
      'top': 50,
      'transform': 'initial',
    }

    return <Modal
      isShown={this.state.isShown || !!resetToken} style={containerStyle}
      onClose={(resetToken || isShownAsFullPage) ? undefined : this.handleClose}>
      {isShownAsFullPage ? this.renderIntro({flex: .5}) : null}
      {isShownAsFullPage ?
        <ModalCloseButton onClick={this.handleClose} style={closeButtonStyle} /> : null}
      <LoginMethods onFinish={this.handleClose} />
    </Modal>
  }
}
const LoginModal = connect(({app: {loginModal}}: RootState): ModalConnectedProps => {
  const {isReturningUser = false, resetToken = ''} = loginModal && loginModal.defaultValues || {}
  return {
    isLoginFormShownByDefault: !!isReturningUser,
    // TODO(cyrille): Clean this up, since modal is never rendered if !loginModal.
    isShown: !!loginModal,
    resetToken,
  }
})(LoginModalBase)


interface MethodsConfig {
  forwardLocation?: string
  onFinish?: () => void
  onLogin?: (user: bayes.bob.User) => void
}

interface MethodsConnectedProps {
  defaultEmail: string
  forwardLocation: string
  isLoginFormShownByDefault: boolean
  resetToken: string
}

type MethodsProps = MethodsConnectedProps & MethodsConfig & RouteComponentProps

interface MethodsState {
  forwardLocation?: string
  isLoginFormShown: boolean
  state?: string
  storedState?: StoredState
}

class LoginMethodsBase extends React.PureComponent<MethodsProps, MethodsState> {
  public static propTypes = {
    defaultEmail: PropTypes.string,
    forwardLocation: PropTypes.string,
    isLoginFormShownByDefault: PropTypes.bool,
    onFinish: PropTypes.func,
    onLogin: PropTypes.func,
    resetToken: PropTypes.string,
  }

  public state: MethodsState = {
    forwardLocation: this.props.forwardLocation,
    isLoginFormShown: this.props.isLoginFormShownByDefault,
  }

  public static getDerivedStateFromProps(
    {location: {search}}: MethodsProps, {state: prevState}: MethodsState): null | MethodsState {
    if (!search) {
      return null
    }
    const {state} = parseQueryString(search)
    if (!state || state === prevState) {
      return null
    }
    const storedState = getStoredState(state)
    if (!storedState) {
      return null
    }
    return {
      forwardLocation: storedState.location,
      isLoginFormShown: !storedState.isNewUser,
      state,
      storedState,
    }
  }

  private handleActualLogin = (user: bayes.bob.User): void => {
    const {history, location: {pathname}, onFinish, onLogin} = this.props
    const {storedState: {location = undefined} = {}} = this.state
    onLogin && onLogin(user)
    onFinish && onFinish()
    if (location && pathname !== location) {
      history.push(location)
    }
  }


  private handleShowLoginForm = _memoize((isLoginFormShown): (() => void) =>
    (): void => this.setState({isLoginFormShown}))

  public render(): React.ReactNode {
    const {defaultEmail, resetToken} = this.props
    const {isLoginFormShown, forwardLocation, storedState} = this.state
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
        defaultEmail={defaultEmail} onLogin={this.handleActualLogin} resetToken={resetToken} />
    } else if (isLoginFormShown) {
      form = <LoginForm
        onLogin={this.handleActualLogin} defaultEmail={defaultEmail}
        stateToStore={stateToStore} storedState={storedState}
        onShowRegistrationFormClick={this.handleShowLoginForm(false)} />
    } else {
      form = <RegistrationForm
        onLogin={this.handleActualLogin} stateToStore={stateToStore} storedState={storedState}
        onShowLoginFormClick={this.handleShowLoginForm(true)} />
    }
    // TODO(pascal): Simplify and cleanup styling here.
    return <div style={{flex: 1, ...Styles.CENTERED_COLUMN}}>
      <div style={actionBoxStyle}>
        {form}
      </div>
    </div>
  }
}
const LoginMethods: React.ComponentType<MethodsConfig> = withRouter(connect(
  (
    {app: {loginModal}}: RootState,
    {forwardLocation, location: {pathname}}: MethodsConfig & RouteComponentProps,
  ): MethodsConnectedProps => {
    const {email = '', isReturningUser = false, resetToken = ''} = loginModal &&
      loginModal.defaultValues || {}
    return {
      defaultEmail: email,
      forwardLocation: forwardLocation || pathname,
      isLoginFormShownByDefault: !!isReturningUser,
      resetToken,
    }
  })(LoginMethodsBase))


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
  const {t} = useTranslation()
  return <button className="login google-login" onClick={onClick}>
    <GoogleIcon style={googleIconStyle} />{isAuthenticating ?
      <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
      t('Se connecter avec {{service}}', {service: 'Google'})}
  </button>
}
GoogleButtonBase.propTypes = {
  isAuthenticating: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
}
const GoogleButton = React.memo(GoogleButtonBase)

interface StatefulFacebookLoginProps extends ReactFacebookLoginProps {
  stateToStore?: StoredState
  storedState?: StoredState
}

class StatefulFacebookLogin extends
  React.PureComponent<StatefulFacebookLoginProps, {stateKey: string}> {
  public state = {
    stateKey: getRandomHash(),
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout?: number

  private handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const {appId, onClick, stateToStore} = this.props
    if (isMobileVersion) {
      setStoredState({...stateToStore, clientId: appId}, this.state.stateKey)
      // Prepare a new stateKey for the next time the button is clicked.
      this.timeout = window.setTimeout((): void => this.setState({stateKey: getRandomHash()}), 100)
    }
    onClick && onClick(event)
  }

  // TODO(cyrille): Remove callback hack once react-facebook-login has fixed
  // https://github.com/keppelen/react-facebook-login/issues/262.
  public render(): React.ReactNode {
    const {appId, callback, storedState: {clientId = ''} = {},
      ...otherProps} = this.props
    const {stateKey} = this.state
    const {protocol, host} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    return <FacebookLogin
      {...otherProps} appId={appId} redirectUri={redirectUri} state={stateKey}
      callback={clientId === appId || !clientId ? callback : noOp} onClick={this.handleClick} />
  }
}


interface SocialButtonConnectedProps {
  authMethod?: string
  isAuthenticating?: boolean
}

interface SocialButtonProps extends SocialButtonConnectedProps {
  dispatch: DispatchAllActions
  isNewUser?: boolean
  onLogin: ((user: bayes.bob.User) => void)
  returningClientId?: string
  returningNonce?: string
  stateToStore?: StoredState
  storedState?: StoredState
  style?: React.CSSProperties
}

const SocialLoginButtonsBase = (props: SocialButtonProps): React.ReactElement => {
  const {authMethod, dispatch, isAuthenticating, isNewUser: wantsNewUser, onLogin} = props

  const {t} = useTranslation()

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

  const handleFacebookLogin = useCallback((facebookAuth: ReactFacebookLoginInfo): void => {
    // The facebookAuth object contains:
    //  - the email address: email
    //  - the facebook user ID: userID
    //  - the full name: name
    //  - the URL of a profile picture: picture.data.url
    const email = facebookAuth && facebookAuth.email
    if (email) {
      dispatch(facebookAuthenticateUser(facebookAuth)).then(handleAuthResponse)
    }
  }, [dispatch, handleAuthResponse])

  const handleGoogleLogin = useCallback(
    (googleResponse: GoogleLoginResponse|GoogleLoginResponseOffline): void => {
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
        dispatch(googleAuthenticateUser(googleAuth)).then(handleAuthResponse)
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

  const handlePEConnectLogin = useCallback(({code, nonce}: {code: string; nonce: string}): void => {
    dispatch(peConnectAuthenticateUser(code, nonce)).then(handleAuthResponse)
  }, [dispatch, handleAuthResponse])

  const handleLinkedinLogin = useCallback(({code}: {code: string}): void => {
    dispatch(linkedInAuthenticateUser(code)).then(handleAuthResponse)
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
    <StatefulFacebookLogin
      appId={config.facebookSSOAppId} language="fr" isDisabled={isAuthenticating}
      callback={handleFacebookLogin}
      fields="email,name,picture,gender,birthday"
      storedState={storedState}
      size="small" icon="fa-facebook" stateToStore={stateToStore}
      textButton={isAuthenticating && authMethod === 'facebook' ?
        // react-facebook-login expects a string. Beware on lib update.
        circularProgress as unknown as string :
        t('Se connecter avec {{service}}', {service: 'Facebook'})}
      cssClass="login facebook-login" />
    <GoogleLogin
      clientId={config.googleSSOClientId} disabled={isAuthenticating}
      onSuccess={handleGoogleLogin}
      onFailure={handleGoogleFailure}
      render={MyGoogleButton} />
    <OAuth2ConnectLogin
      authorizeEndpoint="https://authentification-candidat.pole-emploi.fr/connexion/oauth2/authorize"
      scopes={PE_CONNECT_SCOPES}
      authorizeParams={{realm: '/individu'}} disabled={isAuthenticating}
      clientId={config.emploiStoreClientId} stateToStore={stateToStore} storedState={storedState}
      className="login pe-connect-login"
      logo={peConnectIcon}
      onSuccess={handlePEConnectLogin}
      onFailure={handleConnectFailure}>
      {isAuthenticating && authMethod === 'peConnect' ?
        circularProgress : <Trans parent={null}>
        Se connecter avec {{service: 'pôle emploi'}}
        </Trans>}
    </OAuth2ConnectLogin>
    <OAuth2ConnectLogin
      clientId={config.linkedInClientId} disabled={isAuthenticating} stateToStore={stateToStore}
      authorizeEndpoint="https://www.linkedin.com/oauth/v2/authorization"
      scopes={LINKEDIN_SCOPES} storedState={storedState}
      onSuccess={handleLinkedinLogin}
      onFailure={handleConnectFailure}
      logo={linkedInIcon} style={{marginBottom: 0}}
      className="login linkedin-login">
      {isAuthenticating && authMethod === 'linkedIn' ?
        circularProgress : <Trans parent={null}>Se connecter avec {{service: 'LinkedIn'}}</Trans>}
    </OAuth2ConnectLogin>
  </div>
}
SocialLoginButtonsBase.propTypes = {
  authMethod: PropTypes.string,
  dispatch: PropTypes.func.isRequired,
  isAuthenticating: PropTypes.bool,
  isNewUser: PropTypes.bool,
  onLogin: PropTypes.func.isRequired,
  style: PropTypes.object,
}
const SocialLoginButtons = connect(({asyncState: {authMethod, isFetching}}: RootState):
SocialButtonConnectedProps => ({
  authMethod,
  isAuthenticating: isFetching['EMAIL_CHECK'] || isFetching['AUTHENTICATE_USER'],
}))(SocialLoginButtonsBase)


interface LinkConfig {
  email?: string
  isSignUp?: boolean
  style?: React.CSSProperties
  visualElement: string
}

interface LinkConnectedProps {
  isGuest?: boolean
  isRegisteredUser?: boolean
}

interface LoginLinkProps extends LinkConfig, LinkConnectedProps, RouteComponentProps {
  children: React.ReactNode
  dispatch: DispatchAllActions
  innerRef?: React.RefObject<HTMLAnchorElement>
}

const LoginLinkBase = (props: LoginLinkProps): React.ReactElement => {
  const {
    children,
    dispatch,
    email,
    innerRef,
    isGuest,
    isRegisteredUser,
    isSignUp,
    location: {pathname},
    style,
    visualElement,
  } = props

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

  const to = useMemo((): LinkProps['to']|null => {
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

  const commonProps = useMemo((): Pick<LinkProps, 'children'|'onClick'|'style'> => ({
    children,
    onClick: handleClick,
    style,
  }), [children, handleClick, style])
  if (to) {
    return <Link {...commonProps} innerRef={innerRef} to={to} />
  }
  return <a {...commonProps} href="#" ref={innerRef} />
}
LoginLinkBase.propTypes = {
  children: PropTypes.node,
  dispatch: PropTypes.func.isRequired,
  email: PropTypes.string,
  isGuest: PropTypes.bool,
  isRegisteredUser: PropTypes.bool,
  isSignUp: PropTypes.bool,
  style: PropTypes.object,
  visualElement: PropTypes.string.isRequired,
}
const LoginLink = connect(({user: {hasAccount, userId}}: RootState): LinkConnectedProps => ({
  isGuest: !!userId && !hasAccount,
  isRegisteredUser: !!userId && !!hasAccount,
}))(withRouter(React.memo(LoginLinkBase)))


class LoginButton extends React.PureComponent<LinkConfig & ButtonProps> {
  public render(): React.ReactNode {
    const {children, email, isSignUp, style, visualElement, ...otherProps} = this.props
    return <LoginLink {...{email, isSignUp, style, visualElement}}>
      <Button type="deletion" {...otherProps}>{children}</Button>
    </LoginLink>
  }
}


export {LoginModal, LoginMethods, LoginLink, LoginButton, ResetPasswordForm}
