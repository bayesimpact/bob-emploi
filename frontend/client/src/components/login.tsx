import Storage from 'local-storage-fallback'
import _memoize from 'lodash/memoize'
import AccountOutlineIcon from 'mdi-react/AccountOutlineIcon'
import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import GoogleIcon from 'mdi-react/GoogleIcon'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import {parse, stringify} from 'query-string'
import React from 'react'
import FacebookLogin from 'react-facebook-login'
import GoogleLogin from 'react-google-login'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {AUTHENTICATE_USER, DispatchAllActions, EMAIL_CHECK, RESET_USER_PASSWORD, RootState,
  askPasswordReset, closeLoginModal, displayToasterMessage, emailCheck, facebookAuthenticateUser,
  googleAuthenticateUser, linkedInAuthenticateUser, loginUser, openLoginModal,
  openRegistrationModal, peConnectAuthenticateUser, registerNewUser,
  resetPassword} from 'store/actions'
import {validateEmail} from 'store/validations'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalCloseButton} from 'components/modal'
import {Button, CircularProgress, IconInput, LabeledToggle, Styles, chooseImageVersion,
  colorToAlpha} from 'components/theme'
import {Routes} from 'components/url'
import linkedInIcon from 'images/linked-in.png'
import peConnectIcon from 'images/pole-emploi-connect.svg'
import signupCoverImage from 'images/signup-cover.jpg?multi&sizes[]=1440&sizes[]=600'


const toLocaleLowerCase = (email: string): string => email.toLocaleLowerCase()

const stopPropagation = (event): void => event.stopPropagation()

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
}

interface LoginState {
  email: string
  hashSalt: string
  isTryingToResetPassword: boolean
  password: string
  passwordResetRequestedEmail: string
}

class LoginFormBase extends React.PureComponent<LoginProps, LoginState> {
  public static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAskingForPasswordReset: PropTypes.bool,
    isAuthenticatingEmail: PropTypes.bool,
    isAuthenticatingOther: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    onShowRegistrationFormClick: PropTypes.func.isRequired,
  }

  public state: LoginState = {
    email: this.props.defaultEmail || '',
    hashSalt: '',
    isTryingToResetPassword: false,
    password: '',
    passwordResetRequestedEmail: null,
  }

  private handleEmailChange = (email: string): void => this.setState({email})

  private handlePasswordChange = (password: string): void => this.setState({password})

  private handleLogin = (event?): void => {
    const {dispatch} = this.props
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    dispatch(emailCheck(this.state.email)).
      then((response): bayes.bob.AuthResponse | void => {
        if (response && response.hashSalt) {
          this.setState({hashSalt: response.hashSalt})
        }
        return response
      }).
      then((response): bayes.bob.AuthResponse | void => {
        if (!response) {
          return response
        }
        if (response.isNewUser) {
          // TODO: Emphasize to registration form if response.isNewUser
          dispatch(displayToasterMessage("L'utilisateur n'existe pas."))
          return
        }
        const {email, password, hashSalt} = this.state
        // TODO: Use different API endpoints for login and registration.
        dispatch(loginUser(email, password, hashSalt)).
          then((response): bayes.bob.AuthResponse | void => {
            if (response && response.authenticatedUser) {
              this.props.onLogin(response.authenticatedUser)
              // TODO: Take care of the else case when the authentication was
              // not successful but we got back some new salt. (response.hashSalt)
            }
            return response
          })
        return response
      })
  }

  private handleLostPasswordClick = (event): void => {
    const {dispatch} = this.props
    const {email} = this.state
    if (event) {
      event.preventDefault()
    }
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
        'Entrez correctement votre email dans le champs ci-dessus pour récupérer ' +
          'votre mot de passe.'))
      this.setState({isTryingToResetPassword: true})
      return
    }
    dispatch(askPasswordReset(email)).then((response): bayes.bob.AuthResponse | void => {
      if (response) {
        this.setState({passwordResetRequestedEmail: email})
        return response
      }
    })
  }

  private isFormValid = (): boolean => {
    const {email, isTryingToResetPassword, password} = this.state
    return !!((isTryingToResetPassword || password) && validateEmail(email))
  }

  private fastForward = (): void => {
    const {email, password} = this.state
    if (this.isFormValid()) {
      this.handleLogin()
      return
    }
    this.setState({
      email: email || 'test@example.com',
      // Let's hope it's the right password.
      password: password || 'password',
    })
  }

  public render(): React.ReactNode {
    const {email, isTryingToResetPassword, password, passwordResetRequestedEmail} = this.state
    const {isAskingForPasswordReset, isAuthenticatingEmail,
      isAuthenticatingOther, onLogin} = this.props
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
    const handleSubmit = isTryingToResetPassword ? this.handleLostPasswordClick : this.handleLogin
    return <form style={loginBoxStyle} onSubmit={handleSubmit}>
      <FastForward onForward={this.fastForward} />
      <FormHeader
        title={isTryingToResetPassword ? 'Mot de passe oublié ?' : "S'identifier"}
        question={isTryingToResetPassword ? '' : 'Pas encore de compte ?'}
        linkText="Inscrivez-vous !"
        onClick={this.props.onShowRegistrationFormClick} />

      <SocialLoginButtons onLogin={onLogin} />

      <FormSection title="Identification par mot de passe">
        <IconInput
          shouldFocusOnMount={!email}
          type="email" autoComplete="current-password"
          placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
          applyFunc={toLocaleLowerCase}
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          onChange={this.handleEmailChange} />
        {isTryingToResetPassword ? null : <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="password" autoComplete="new-password"
          shouldFocusOnMount={!!email}
          placeholder="Mot de passe" value={password} iconComponent={LockOutlineIcon}
          onChange={this.handlePasswordChange}
          style={{marginTop: 10}} />}
      </FormSection>

      {isTryingToResetPassword ? null : <a
        style={{...lostPasswordLinkStyle, cursor: 'pointer'}}
        onClick={this.handleLostPasswordClick}>
        Mot de passe oublié ?
      </a>}
      {passwordResetRequestedEmail ?
        <span style={lostPasswordLinkStyle}>
          Un email a été envoyé à {passwordResetRequestedEmail}
        </span>
        : <Button
          disabled={!this.isFormValid() || isAuthenticatingOther || isAuthenticatingEmail}
          onClick={handleSubmit}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={(isAuthenticatingEmail || isAskingForPasswordReset)}
          type="validation">
          {isTryingToResetPassword ? 'Récupérer son mot de passe' : "S'identifier"}
        </Button>}
    </form>
  }
}
const LoginForm =
  connect(({asyncState: {authMethod, isFetching}}: RootState): LoginConnectedProps => ({
    isAskingForPasswordReset: isFetching[RESET_USER_PASSWORD],
    isAuthenticatingEmail:
      isFetching[EMAIL_CHECK] || isFetching[AUTHENTICATE_USER] && authMethod === 'password',
    isAuthenticatingOther: isFetching[AUTHENTICATE_USER] && authMethod !== 'password',
  }))(LoginFormBase)


interface ResetPasswordConnectedProps {
  isAuthenticating: boolean
}

interface ResetPasswordProps extends ResetPasswordConnectedProps {
  defaultEmail?: string
  dispatch: DispatchAllActions
  onLogin: (user: bayes.bob.User) => void
  resetToken: string
}

interface ResetPasswordState {
  email: string
  password: string
}

class ResetPasswordFormBase extends React.PureComponent<ResetPasswordProps, ResetPasswordState> {
  public static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    resetToken: PropTypes.string.isRequired,
  }

  public state: ResetPasswordState = {
    email: this.props.defaultEmail || '',
    password: '',
  }

  private handleEmailChange = (email: string): void => this.setState({email})

  private handlePasswordChange = (password: string): void => this.setState({password})

  private handleResetPassword = (event): void => {
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    const {email, password} = this.state
    const {dispatch, onLogin, resetToken} = this.props
    dispatch(resetPassword(email, password, resetToken)).
      then((response): bayes.bob.AuthResponse | void => {
        if (response && response.authenticatedUser) {
          onLogin(response.authenticatedUser)
        }
        return response
      })
  }

  private isFormValid = (): boolean => {
    const {email, password} = this.state
    return !!(password && validateEmail(email))
  }

  public render(): React.ReactNode {
    const {email, password} = this.state
    const {isAuthenticating} = this.props
    const loginBoxStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={loginBoxStyle} onSubmit={this.handleResetPassword}>
      <FormHeader title="Changez votre mot de passe" />
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={!email} autoComplete="email"
        type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={toLocaleLowerCase}
        onChange={this.handleEmailChange} />
      <IconInput
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        type="password" autoComplete="new-password" shouldFocusOnMount={!!email}
        placeholder="Nouveau mot de passe" value={password} iconComponent={LockOutlineIcon}
        onChange={this.handlePasswordChange}
        style={{marginTop: 10}} />
      <Button
        disabled={!this.isFormValid()}
        onClick={this.handleResetPassword}
        style={{alignSelf: 'center', marginTop: 30}}
        isProgressShown={isAuthenticating}
        isNarrow={true}
        type="validation">
        Changer le mot de passe
      </Button>
    </form>
  }
}
const ResetPasswordForm = connect(({asyncState}: RootState): ResetPasswordConnectedProps => ({
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(ResetPasswordFormBase)


interface RegistrationConnectedProps {
  defaultEmail: string
  isAuthenticating: boolean
}

interface RegistrationProps extends RegistrationConnectedProps{
  dispatch: DispatchAllActions
  onLogin: (user: bayes.bob.User) => void
  onShowLoginFormClick: () => void
}

interface RegistrationState {
  email: string
  hasAcceptedTerms: boolean
  lastName: string
  name: string
  password: string
}

class RegistrationFormBase extends React.PureComponent<RegistrationProps, RegistrationState> {
  public static propTypes = {
    defaultEmail: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    onShowLoginFormClick: PropTypes.func.isRequired,
  }

  public state: RegistrationState = {
    email: this.props.defaultEmail,
    hasAcceptedTerms: false,
    lastName: '',
    name: '',
    password: '',
  }

  private handleNameChange = (name: string): void => this.setState({name})

  private handleLastNameChange = (lastName: string): void => this.setState({lastName})

  private handleEmailChange = (email: string): void => this.setState({email})

  private handlePasswordChange = (password: string): void => this.setState({password})

  private handleRegister = (): void => {
    if (!this.isFormValid()) {
      return
    }
    const {email, password, name, lastName} = this.state
    const {dispatch, onLogin, onShowLoginFormClick} = this.props
    dispatch(registerNewUser(email, password, name, lastName)).
      then((response): bayes.bob.AuthResponse | void => {
        if (!response) {
          return response
        }
        // TODO: Handle this more explicitly after switch to two endpoints.
        // User already exists
        if (!response.authenticatedUser) {
          dispatch(displayToasterMessage(
            'Ce compte existe déjà, merci de vous connecter avec vos identifiants'))
          onShowLoginFormClick()
          return
        }
        onLogin(response.authenticatedUser)
        return response
      })
  }

  private handleToggleAcceptTerms = (): void =>
    this.setState(({hasAcceptedTerms}: RegistrationState):
    Pick<RegistrationState, 'hasAcceptedTerms'> => ({hasAcceptedTerms: !hasAcceptedTerms}))

  private isFormValid = (): boolean => {
    const {email, hasAcceptedTerms, password, lastName, name} = this.state
    return !!(hasAcceptedTerms && password && lastName && name && validateEmail(email))
  }

  private fastForward = (): void => {
    const {email, password, lastName, name} = this.state
    if (this.isFormValid()) {
      this.handleRegister()
      return
    }
    this.setState({
      email: email || 'test-' + (new Date().getTime()) + '@example.com',
      hasAcceptedTerms: true,
      lastName: lastName || 'Dupont',
      name: name || 'Angèle',
      password: password || 'password',
    })
  }

  public render(): React.ReactNode {
    const {email, hasAcceptedTerms, password, name, lastName} = this.state
    const {isAuthenticating, onLogin} = this.props
    const registrationBoxStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={registrationBoxStyle} onSubmit={this.handleRegister}>
      <FastForward onForward={this.fastForward} />
      <FormHeader
        title="Créer un compte"
        question="Déjà un compte ?"
        linkText="Connectez-vous !"
        onClick={this.props.onShowLoginFormClick} />

      <SocialLoginButtons onLogin={onLogin} isNewUser={true} />

      <FormSection title="Inscription par mot de passe">
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          shouldFocusOnMount={true} autoComplete="given-name"
          type="text" placeholder="Prénom" value={name} iconComponent={AccountOutlineIcon}
          onChange={this.handleNameChange} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="text" placeholder="Nom" value={lastName} iconComponent={AccountOutlineIcon}
          onChange={this.handleLastNameChange} autoComplete="family-name"
          style={{marginTop: 10}} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
          applyFunc={toLocaleLowerCase} autoComplete="email"
          onChange={this.handleEmailChange}
          style={{marginTop: 10}} />
        <IconInput
          iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
          type="password" autoComplete="new-password"
          placeholder="Créer un mot de passe" value={password} iconComponent={LockOutlineIcon}
          onChange={this.handlePasswordChange}
          style={{marginTop: 10}} />
      </FormSection>

      <div style={{fontSize: 12, margin: '10px auto 0', maxWidth: 325}}>
        Nous sommes une association loi 1901 à but non lucratif&nbsp;:
        {' '}{config.productName} est <strong>gratuit</strong> et le restera
        toujours.
      </div>
      <LabeledToggle
        type="checkbox" label={<span>
            J'ai lu et j'accepte les <Link
            to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank" rel="noopener noreferrer"
            onClick={stopPropagation}>
              conditions générales d'utilisation
          </Link>
        </span>}
        style={{fontSize: 12, marginTop: 10}}
        isSelected={hasAcceptedTerms}
        onClick={this.handleToggleAcceptTerms} />
      <Button
        disabled={!this.isFormValid()}
        onClick={this.handleRegister}
        style={{alignSelf: 'center', marginTop: 30}}
        isNarrow={true}
        isProgressShown={isAuthenticating}
        type="validation">
        S'inscrire
      </Button>
    </form>
  }
}
const RegistrationForm = connect(({app, asyncState}: RootState): RegistrationConnectedProps => {
  const {email = ''} = app.loginModal && app.loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isAuthenticating: asyncState.isFetching[AUTHENTICATE_USER],
  }
})(RegistrationFormBase)


interface SectionProps {
  title: React.ReactNode
}

class FormSection extends React.PureComponent<SectionProps> {
  public static propTypes = {
    children: PropTypes.node,
    title: PropTypes.node.isRequired,
  }

  public render(): React.ReactNode {
    const {children, title} = this.props
    const titleStyle: React.CSSProperties = {
      color: colors.GREYISH_BROWN,
      fontSize: 14,
      margin: '30px 0 15px',
      textAlign: 'center',
    }
    return <React.Fragment>
      <div style={titleStyle}>
        {title}
      </div>
      {children}
    </React.Fragment>
  }
}


interface HeaderProps {
  linkText?: string
  onClick?: () => void
  question?: string
  title: string
}


class FormHeader extends React.PureComponent<HeaderProps> {
  public static propTypes = {
    linkText: PropTypes.string,
    onClick: PropTypes.func,
    question: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {linkText, onClick, question, title} = this.props
    const headlineStyle: React.CSSProperties = {
      color: colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
      textAlign: 'center',
    }
    const contentStyle: React.CSSProperties = {
      fontSize: 14,
      lineHeight: 1.4,
      textAlign: 'center',
    }
    const linkStyle: React.CSSProperties = {
      color: colors.BOB_BLUE,
      cursor: 'pointer',
      textDecoration: 'underline',
    }
    return <div style={{marginBottom: 20}}>
      <div style={headlineStyle}>{title}</div>
      {question && onClick && linkStyle && linkText ? <div style={contentStyle}>
        <span>{question} </span>
        <span onClick={onClick} style={linkStyle}>{linkText}</span>
      </div> : null}
    </div>
  }
}


interface OAuth2Props extends React.HTMLProps<HTMLButtonElement> {
  authorizeEndpoint: string
  authorizeParams?: {[param: string]: string}
  clientId: string
  logo: string
  onFailure?: (error: {message: string}) => void
  onSuccess?: (auth: {code?: string; nonce?: string}) => void
  scopes?: string[]
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
    style: PropTypes.object,
  }

  public componentDidMount(): void {
    const {onFailure, onSuccess} = this.props
    const {search} = window.location
    if (!search) {
      return
    }
    const {code, error, error_description: errorDescription, state} = parse(search.substr(1))
    if (!state) {
      return
    }
    // TODO(pascal): Cleanup the URL and localStorage so that a refresh does
    // not attempt logging in again.
    const stateContent = Storage.getItem(this.getLocalStorageKey(state))
    if (!stateContent) {
      return
    }
    const {clientId, nonce} = JSON.parse(stateContent)
    if (clientId !== this.props.clientId) {
      return
    }
    if (!nonce) {
      onFailure(new Error(`Invalid state: "${state}".`))
      return
    }
    if (error || !code) {
      if (/Owner did not authorize/.test(errorDescription)) {
        // User canceled their request so they are aware of what happened.
        onFailure(new Error('Authentification annulée'))
        return
      }
      onFailure(new Error(
        errorDescription || error || "Erreur lors de l'authentification, code manquant"))
      return
    }
    onSuccess({code, nonce})
  }

  // TODO(cyrille): Make static.
  private getLocalStorageKey(state: string): string {
    return `oauth2.${state}`
  }

  // TODO(cyrille): Make static.
  private getRandomHash(): string {
    return (Math.random() * 36).toString(36)
  }

  private startSigninFlow = (): void => {
    const {authorizeEndpoint, authorizeParams, clientId, scopes} = this.props
    const state = this.getRandomHash()
    const nonce = this.getRandomHash()
    const {host, protocol} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    const url = `${authorizeEndpoint}?${stringify({
      'client_id': clientId,
      nonce,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      state,
      ...(scopes ? {scope: scopes.join(' ')} : {}),
      ...authorizeParams,
    })}`
    Storage.setItem(this.getLocalStorageKey(state), JSON.stringify({clientId, nonce}))
    window.location.href = url
  }

  public render(): React.ReactNode {
    const {children, logo, style,
      authorizeEndpoint: omittedEndPoint, authorizeParams: omittedParams, clientId: omittedId,
      onFailure: omittedOnFailure, onSuccess: omittedOnSuccess, scopes: omittedSCopes,
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

interface ModalProps extends RouteComponentProps, ModalConnectedProps {
  dispatch: DispatchAllActions
}

interface ModalState {
  isShown: boolean
  isShownAsFullPage: boolean
}

class LoginModalBase extends React.PureComponent<ModalProps, ModalState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: ReactRouterPropTypes.history.isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    isShown: PropTypes.bool,
    location: ReactRouterPropTypes.location.isRequired,
    resetToken: PropTypes.string,
  }

  public state: ModalState = {
    isShown: false,
    isShownAsFullPage: false,
  }

  public static getDerivedStateFromProps(nextProps: ModalProps, {isShown: wasShown}: ModalState):
  Partial<ModalState> {
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

  private handleClose = _memoize((hasCanceledLogin): (() => void) => (): void => {
    const {dispatch, history, location} = this.props
    dispatch(closeLoginModal(hasCanceledLogin))
    if (!hasCanceledLogin) {
      if (location.pathname !== Routes.ROOT) {
        history.push(Routes.ROOT)
      }
    }
  })

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
      backgroundImage: `url(${chooseImageVersion(signupCoverImage, isMobileVersion)})`,
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    const contentStyle: React.CSSProperties = {
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 29,
      justifyContent: 'center',
      lineHeight: '38px',
      minHeight: '100vh',
      padding: 60,
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 60,
      fontWeight: 'bold',
      lineHeight: 1,
      textShadow: `0 2px 6px ${colorToAlpha(colors.BOB_BLUE_HOVER, .5)}`,
    }
    const quoteStyle: React.CSSProperties = {
      fontSize: 128,
      opacity: .3,
      position: 'absolute',
      right: '100%',
    }

    return <div style={containerStyle}>
      <div style={{...coverAll, backgroundColor: colors.BOB_BLUE, opacity: .9, zIndex: -1}} />
      <div style={coverImageStyle} />
      <div style={contentStyle}>
        <div style={titleStyle}>
          Commençons à travailler ensemble&nbsp;!
        </div>

        <div style={{fontStyle: 'italic', marginTop: 60, maxWidth: 550, position: 'relative'}}>
          <div style={quoteStyle}>“</div>
          Nous allons vous poser quelques questions afin de mieux vous
          connaître et vous proposer les conseils que nous pensons être les
          plus adaptés.

          <br /><br />

          Certains vous ouvriront de nouvelles pistes de réflexion, d'autres
          peut-être moins. Faites-nous vos retours&nbsp;: {config.productName} s'améliore grâce
          à vous&nbsp;!
        </div>

        <div style={{fontSize: 20, marginTop: 40}}>
          - L'équipe de {config.productName}
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
      boxShadow: 'initial',
      opacity: .6,
      right: 50,
      top: 50,
      transform: 'initial',
    }

    return <Modal
      isShown={this.state.isShown || !!resetToken} style={containerStyle}
      onClose={(resetToken || isShownAsFullPage) ? null : this.handleClose(true)}>
      {isShownAsFullPage ? this.renderIntro({flex: 1}) : null}
      {isShownAsFullPage ?
        <ModalCloseButton onClick={this.handleClose(true)} style={closeButtonStyle} /> : null}
      <LoginMethods onFinish={this.handleClose(false)} />
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
})(withRouter(LoginModalBase))


interface MethodsConnectedProps {
  defaultEmail: string
  isLoginFormShownByDefault: boolean
  resetToken: string
}

interface MethodsProps extends MethodsConnectedProps {
  dispatch: DispatchAllActions
  onFinish?: () => void
  onLogin?: (user: bayes.bob.User) => void
}

class LoginMethodsBase extends React.PureComponent<MethodsProps, MethodsState> {
  public static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    onFinish: PropTypes.func,
    onLogin: PropTypes.func,
    resetToken: PropTypes.string,
  }

  public state: MethodsState = {
    isLoginFormShown: this.props.isLoginFormShownByDefault,
  }

  private handleActualLogin = (user: bayes.bob.User): void => {
    const {onFinish, onLogin} = this.props
    onLogin && onLogin(user)
    onFinish && onFinish()
  }


  // TODO(cyrille): Drop if unused.
  private handleLogin = (email, password, hashSalt): void => {
    const {dispatch} = this.props
    dispatch(loginUser(email, password, hashSalt)).then((response): void => {
      if (response && response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
        // TODO: Take care of the else case when the authentication was
        // not successful but we got back some new salt. (response.hashSalt)
      }
    })
  }

  private handleShowLoginForm = _memoize((isLoginFormShown): (() => void) =>
    (): void => this.setState({isLoginFormShown}))

  public render(): React.ReactNode {
    const {defaultEmail, resetToken} = this.props
    const {isLoginFormShown} = this.state
    const actionBoxStyle: React.CSSProperties = {
      alignItems: 'center',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      padding: '30px 20px',
    }
    let form
    if (resetToken) {
      form = <ResetPasswordForm
        defaultEmail={defaultEmail} onLogin={this.handleActualLogin} resetToken={resetToken} />
    } else if (isLoginFormShown) {
      form = <LoginForm
        onLogin={this.handleActualLogin} defaultEmail={defaultEmail}
        onShowRegistrationFormClick={this.handleShowLoginForm(false)} />
    } else {
      form = <RegistrationForm
        onLogin={this.handleActualLogin}
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
const LoginMethods = connect(({app: {loginModal}}: RootState): MethodsConnectedProps => {
  const {email = '', isReturningUser = false, resetToken = ''} = loginModal &&
    loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isLoginFormShownByDefault: !!isReturningUser,
    resetToken,
  }
})(LoginMethodsBase)


const circularProgressStyle: React.CSSProperties = {
  color: '#fff',
  display: 'inline-block',
  textAlign: 'center',
  verticalAlign: 'middle',
  width: 170,
}

interface GoogleButtonProps {
  isAuthenticating?: boolean
  onClick: () => void
}

class GoogleButton extends React.PureComponent<GoogleButtonProps> {
  public static propTypes = {
    isAuthenticating: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {isAuthenticating, onClick} = this.props
    const googleIconStyle: React.CSSProperties = {
      height: 24,
      marginRight: 10,
      verticalAlign: 'middle',
      width: 34,
    }
    return <button className="login google-login" onClick={onClick}>
      <GoogleIcon style={googleIconStyle} />{isAuthenticating ?
        <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
        'Se connecter avec Google'}
    </button>
  }
}

interface SocialButtonConnectedProps {
  authMethod: string
  isAuthenticating?: boolean
}

interface SocialButtonProps extends SocialButtonConnectedProps {
  dispatch: DispatchAllActions
  isNewUser?: boolean
  onLogin: ((user: bayes.bob.User) => void)
  style?: React.CSSProperties
}

class SocialLoginButtonsBase extends React.PureComponent<SocialButtonProps> {
  public static propTypes = {
    authMethod: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAuthenticating: PropTypes.bool,
    isNewUser: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  private handleAuthResponse = (response: bayes.bob.AuthResponse | void): void => {
    if (!response) {
      return
    }
    const {dispatch, isNewUser: wantsNewUser, onLogin} = this.props
    const {authenticatedUser, isNewUser} = response
    if (isNewUser && !wantsNewUser) {
      dispatch(displayToasterMessage("Création d'un nouveau compte"))
    } else if (!isNewUser && wantsNewUser) {
      dispatch(displayToasterMessage('Connexion avec le compte existant'))
    }
    // TODO(pascal): Make sure we go to /confidentialite page on first registration.
    onLogin(authenticatedUser)
  }

  private handleFacebookLogin = (facebookAuth): void => {
    // The facebookAuth object contains:
    //  - the email address: email
    //  - the facebook user ID: userID
    //  - the full name: name
    //  - the URL of a profile picture: picture.data.url
    const email = facebookAuth && facebookAuth.email
    if (email) {
      this.props.dispatch(facebookAuthenticateUser(facebookAuth)).then(this.handleAuthResponse)
    }
  }

  private handleGoogleLogin = (googleAuth): void => {
    // The googleAuth object contains the profile in getBasicProfile()
    //  - the Google ID: getId()
    //  - the email address: getEmail()
    //  - the first name: getGivenName()
    //  - the last name: getFamilyName()
    //  - the full name: getName()
    //  - the URL of a profile picture: getImageUrl()
    const email = googleAuth && googleAuth.getBasicProfile().getEmail()
    if (email) {
      this.props.dispatch(googleAuthenticateUser(googleAuth)).then(this.handleAuthResponse)
    }
  }

  private handleGoogleFailure = ({details}): void => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(details))
  }

  private handleConnectFailure = (error): void => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(error.message))
  }

  private handlePEConnectLogin = ({code, nonce}): void => {
    this.props.dispatch(peConnectAuthenticateUser(code, nonce)).then(this.handleAuthResponse)
  }

  private handleLinkedinLogin = ({code}): void => {
    this.props.dispatch(linkedInAuthenticateUser(code)).then(this.handleAuthResponse)
  }

  private renderGoogleButton = _memoize((isGoogleAuthenticating: boolean):
  ((props: GoogleButtonProps) => React.ReactElement) => (props): React.ReactElement =>
    <GoogleButton isAuthenticating={isGoogleAuthenticating} {...props} />)

  public render(): React.ReactNode {
    const {authMethod, isAuthenticating, style} = this.props
    const socialLoginBox: React.CSSProperties = {
      ...style,
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
    }
    // TODO(cyrille): Try to fix https://github.com/keppelen/react-facebook-login/issues/262.
    return <div style={socialLoginBox}>
      <FacebookLogin
        appId={config.facebookSSOAppId} language="fr" disabled={isAuthenticating}
        callback={this.handleFacebookLogin}
        fields="email,name,picture,gender,birthday"
        size="small" icon="fa-facebook"
        textButton={isAuthenticating && authMethod === 'facebook' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec Facebook</React.Fragment>}
        cssClass="login facebook-login" />
      <GoogleLogin
        clientId={config.googleSSOClientId} disabled={isAuthenticating}
        onSuccess={this.handleGoogleLogin}
        onFailure={this.handleGoogleFailure}
        render={this.renderGoogleButton(isAuthenticating && authMethod === 'google')} />
      <OAuth2ConnectLogin
        authorizeEndpoint="https://authentification-candidat.pole-emploi.fr/connexion/oauth2/authorize"
        scopes={['api_peconnect-individuv1', 'profile', 'email',
          'coordonnees', 'api_peconnect-coordonneesv1', 'openid',
          // TODO(cyrille): Add 'pfccompetences', 'api_peconnect-competencesv2' once we have
          // upgraded to competences v2.
        ]}
        authorizeParams={{realm: '/individu'}} disabled={isAuthenticating}
        clientId={config.emploiStoreClientId}
        className="login pe-connect-login"
        logo={peConnectIcon}
        onSuccess={this.handlePEConnectLogin}
        onFailure={this.handleConnectFailure}>
        {isAuthenticating && authMethod === 'peConnect' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec pôle emploi</React.Fragment>}
      </OAuth2ConnectLogin>
      <OAuth2ConnectLogin
        clientId={config.linkedInClientId} disabled={isAuthenticating}
        authorizeEndpoint="https://www.linkedin.com/oauth/v2/authorization"
        scopes={['r_liteprofile', 'r_emailaddress']}
        onSuccess={this.handleLinkedinLogin}
        onFailure={this.handleConnectFailure}
        logo={linkedInIcon} style={{marginBottom: 0}}
        className="login linkedin-login">
        {isAuthenticating && authMethod === 'linkedIn' ?
          <CircularProgress size={23} style={circularProgressStyle} thickness={2} /> :
          <React.Fragment>Se connecter avec LinkedIn</React.Fragment>}
      </OAuth2ConnectLogin>
    </div>
  }
}
const SocialLoginButtons = connect(({asyncState: {authMethod, isFetching}}: RootState):
SocialButtonConnectedProps => ({
  authMethod,
  isAuthenticating: isFetching[EMAIL_CHECK] || isFetching[AUTHENTICATE_USER],
}))(SocialLoginButtonsBase)


interface MethodsState {
  isLoginFormShown: boolean
}


interface ButtonConnectedProps {
  isLoggedIn?: boolean
}

interface ButtonProps extends ButtonConnectedProps {
  dispatch: DispatchAllActions
  email?: string
  isSignUpButton?: boolean
  style?: React.CSSProperties
  type: string
  visualElement?: string
}

interface ButtonState {
  isClicked: boolean
}

class LoginButtonBase extends React.PureComponent<ButtonProps, ButtonState> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    email: PropTypes.string,
    isLoggedIn: PropTypes.bool,
    isSignUpButton: PropTypes.bool,
    style: PropTypes.object,
    visualElement: PropTypes.string,
  }

  public state: ButtonState = {
    isClicked: false,
  }

  private handleClick = (): void => {
    const {email, isLoggedIn, isSignUpButton, dispatch, visualElement} = this.props
    if (isLoggedIn) {
      this.setState({isClicked: true})
      return
    }
    if (isSignUpButton) {
      dispatch(openRegistrationModal({email}, visualElement))
    } else {
      dispatch(openLoginModal({email}, visualElement))
    }
  }

  public render(): React.ReactNode {
    if (this.state.isClicked) {
      return <Redirect to={Routes.PROJECT_PAGE} push={true} />
    }
    const {children,
      dispatch: omittedDispatch, email: omittedEmail, isLoggedIn: omittedIsLoggedIn,
      isSignUpButton: omittedIsSignedUpButton, visualElement: omittedVisualElement,
      ...extraProps} = this.props
    return <Button type="deletion" onClick={this.handleClick} {...extraProps}>
      {children}
    </Button>
  }
}
const LoginButton = connect(({user}: RootState): ButtonConnectedProps => ({
  isLoggedIn: !!user.userId,
}))(LoginButtonBase)


export {LoginModal, LoginMethods, LoginButton}
