import omit from 'lodash/omit'
import AccountOutlineIcon from 'mdi-react/AccountOutlineIcon'
import EmailOutlineIcon from 'mdi-react/EmailOutlineIcon'
import GoogleIcon from 'mdi-react/GoogleIcon'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {parse, stringify} from 'query-string'
import {Link} from 'react-router-dom'

import FacebookLogin from 'react-facebook-login'
import GoogleLogin from 'react-google-login'
import config from 'config'

import peConnectIcon from 'images/pole-emploi-connect.svg'
import signupCoverImage from 'images/signup-cover.jpg?multi&sizes[]=1440&sizes[]=600'

import {FastForward} from 'components/fast_forward'
import {validateEmail} from 'store/validations'
import {facebookAuthenticateUser, googleAuthenticateUser, emailCheck,
  registerNewUser, loginUser, displayToasterMessage, resetPassword, peConnectAuthenticateUser,
  askPasswordReset, openLoginModal, openRegistrationModal, closeLoginModal,
  AUTHENTICATE_USER, EMAIL_CHECK, RESET_USER_PASSWORD} from 'store/actions'
import {chooseImageVersion, Colors, colorToAlpha, IconInput,
  LabeledToggle, Button, Styles} from 'components/theme'
import {upperFirstLetter} from 'store/french'
import {Modal, ModalCloseButton} from 'components/modal'
import {Routes} from 'components/url'


class LoginFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isAskingForPasswordReset: PropTypes.bool,
    isAuthenticating: PropTypes.bool,
    onLogin: PropTypes.func.isRequired,
    onShowRegistrationFormClick: PropTypes.func.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    hashSalt: '',
    isTryingToResetPassword: false,
    password: '',
    passwordResetRequestedEmail: null,
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleLogin = event => {
    const {dispatch} = this.props
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    dispatch(emailCheck(this.state.email)).
      then(response => {
        this.setState({hashSalt: response.hashSalt})
        return response
      }).
      then(response => {
        if (response.isNewUser) {
          // TODO: Emphasize to registration form if response.isNewUser
          dispatch(displayToasterMessage("L'utilisateur n'existe pas."))
          return
        }
        const {email, password, hashSalt} = this.state
        this.props.onLogin(email, password, hashSalt)
        return response
      })
  }

  handleLostPasswordClick = event => {
    const {dispatch} = this.props
    const {email} = this.state
    event.preventDefault()
    if (!validateEmail(email)) {
      dispatch(displayToasterMessage(
        'Entrez correctement votre email dans le champs ci-dessus pour récupérer ' +
          'votre mot de passe.'))
      this.setState({isTryingToResetPassword: true})
      return
    }
    dispatch(askPasswordReset(email)).then(response => {
      this.setState({passwordResetRequestedEmail: email})
      return response
    })
  }

  isFormValid = () => {
    const {email, isTryingToResetPassword, password} = this.state
    return !!((isTryingToResetPassword || password) && validateEmail(email))
  }

  fastForward = () => {
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

  render() {
    const {email, isTryingToResetPassword, password, passwordResetRequestedEmail} = this.state
    const {isAskingForPasswordReset, isAuthenticating} = this.props
    const loginBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    const lostPasswordLinkStyle = {
      color: Colors.COOL_GREY,
      display: 'inline-block',
      fontSize: 13,
      marginLeft: 15,
      marginTop: 12,
      textDecoration: 'none',
    }
    return <form style={loginBoxStyle} onSubmit={this.handleLogin}>
      <FastForward onForward={this.fastForward} />
      <FormHeader
        title={isTryingToResetPassword ? 'Mot de passe oublié ?' : "S'identifier"}
        question={isTryingToResetPassword ? '' : 'Pas encore de compte ?'}
        linkText="Inscrivez-vous !"
        onClick={this.props.onShowRegistrationFormClick} />
      <IconInput
        shouldFocusOnMount={!email}
        type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={email => email.toLocaleLowerCase()}
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        onChange={this.handleChange('email')} />
      {isTryingToResetPassword ? null : <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        type="password" shouldFocusOnMount={!!email}
        placeholder="Mot de passe" value={password} iconComponent={LockOutlineIcon}
        onChange={this.handleChange('password')}
        style={{marginTop: 10}} />}
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
          disabled={!this.isFormValid()}
          onClick={isTryingToResetPassword ? this.handleLostPasswordClick : this.handleLogin}
          style={{alignSelf: 'center', marginTop: 30}}
          isNarrow={true}
          isProgressShown={(isAuthenticating || isAskingForPasswordReset)}
          type="validation">
          {isTryingToResetPassword ? 'Récupérer son mot de passe' : "S'identifier"}
        </Button>}
    </form>
  }
}
const LoginForm = connect(({asyncState}) => ({
  isAskingForPasswordReset: asyncState.isFetching[RESET_USER_PASSWORD],
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(LoginFormBase)


class ResetPasswordFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    isAuthenticating: PropTypes.bool,
    onResetPassword: PropTypes.func.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    password: '',
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleResetPassword = event => {
    const {onResetPassword} = this.props
    if (event && event.preventDefault) {
      event.preventDefault()
    }
    if (!this.isFormValid()) {
      return
    }
    const {email, password} = this.state
    onResetPassword(email, password)
  }

  isFormValid = () => {
    const {email, password} = this.state
    return !!(password && validateEmail(email))
  }

  render() {
    const {email, password} = this.state
    const {isAuthenticating} = this.props
    const loginBoxStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginTop: 15,
    }
    return <form style={loginBoxStyle} onSubmit={this.handleResetPassword}>
      <FormHeader title="Changez votre mot de passe" />
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={!email}
        type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={email => email.toLocaleLowerCase()}
        onChange={this.handleChange('email')} />
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        type="password" shouldFocusOnMount={!!email}
        placeholder="Nouveau mot de passe" value={password} iconComponent={LockOutlineIcon}
        onChange={this.handleChange('password')}
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
const ResetPasswordForm = connect(({asyncState}) => ({
  isAuthenticating: asyncState.isFetching[EMAIL_CHECK] || asyncState.isFetching[AUTHENTICATE_USER],
}))(ResetPasswordFormBase)


class RegistrationFormBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    isAuthenticating: PropTypes.bool,
    onRegister: PropTypes.func.isRequired,
    onShowLoginFormClick: PropTypes.func.isRequired,
  }

  state = {
    email: this.props.defaultEmail || '',
    hasAcceptedTerms: false,
    lastName: '',
    name: '',
    password: '',
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  handleRegister = () => {
    if (!this.isFormValid()) {
      return
    }
    const {email, password, name, lastName} = this.state
    this.props.onRegister(email, password, name, lastName)
  }

  isFormValid = () => {
    const {email, hasAcceptedTerms, password, lastName, name} = this.state
    return !!(hasAcceptedTerms && password && lastName && name && validateEmail(email))
  }

  fastForward = () => {
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

  render() {
    const {email, hasAcceptedTerms, password, name, lastName} = this.state
    const {isAuthenticating} = this.props
    const registrationBoxStyle = {
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
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        shouldFocusOnMount={true}
        type="text" placeholder="Prénom" value={name} iconComponent={AccountOutlineIcon}
        onChange={this.handleChange('name')} />
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        type="text" placeholder="Nom" value={lastName} iconComponent={AccountOutlineIcon}
        onChange={this.handleChange('lastName')}
        style={{marginTop: 10}} />
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        type="email" placeholder="Email" value={email} iconComponent={EmailOutlineIcon}
        applyFunc={email => email.toLocaleLowerCase()}
        onChange={this.handleChange('email')}
        style={{marginTop: 10}} />
      <IconInput
        iconStyle={{fill: Colors.PINKISH_GREY, width: 20}}
        type="password"
        placeholder="Créer un mot de passe" value={password} iconComponent={LockOutlineIcon}
        onChange={this.handleChange('password')}
        style={{marginTop: 10}} />
      <div style={{fontSize: 12, margin: '10px auto 0', maxWidth: 325}}>
        Nous sommes une association loi 1901 à but non lucratif&nbsp;:
        {' '}{config.productName} est <strong>gratuit</strong> et le restera
        toujours.
      </div>
      <LabeledToggle
        type="checkbox" label={<span>
            J'ai lu et j'accepte les <Link
            to={Routes.TERMS_AND_CONDITIONS_PAGE} target="_blank"
            onClick={event => event.stopPropagation()}>
              conditions générales d'utilisation
          </Link>
        </span>}
        style={{fontSize: 12, marginTop: 10}}
        isSelected={hasAcceptedTerms}
        onClick={() => this.setState({hasAcceptedTerms: !hasAcceptedTerms})} />
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
const RegistrationForm = connect(({app, asyncState}) => {
  const {loginModal} = app
  const {email} = loginModal && loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isAuthenticating: asyncState.isFetching[AUTHENTICATE_USER],
  }
})(RegistrationFormBase)


class FormHeader extends React.Component {
  static propTypes = {
    linkText: PropTypes.string,
    onClick: PropTypes.func,
    question: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  render() {
    const {linkText, onClick, question, title} = this.props
    const headlineStyle = {
      color: Colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
      textAlign: 'center',
    }
    const contentStyle = {
      color: Colors.GREYISH_BROWN,
      fontSize: 14,
      lineHeight: 1.4,
      textAlign: 'center',
    }
    const linkStyle = {
      color: Colors.BOB_BLUE,
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


class PEConnectLogin extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    clientId: PropTypes.string.isRequired,
    onFailure: PropTypes.func,
    onSuccess: PropTypes.func,
    style: PropTypes.object,
  }

  componentWillMount() {
    const {onFailure, onSuccess} = this.props
    const {search} = window.location
    if (!search) {
      return
    }
    const {code, iss, state} = parse(search.substr(1))
    if (!state || !iss || !iss.match(/authentification-candidat.pole-emploi.fr/)) {
      return
    }
    // TODO(pascal): Cleanup the URL and localStorage so that a refresh does
    // not attempt logging in again.
    const nonce = localStorage.getItem(`pe-connect.${state}`)
    if (!nonce) {
      onFailure(new Error(`Invalid state: "${state}".`))
    }
    onSuccess({code, nonce})
  }

  getRandomHash() {
    return (Math.random() * 36).toString(36)
  }

  startSigninFlow = () => {
    const authority = 'https://authentification-candidat.pole-emploi.fr'
    const state = this.getRandomHash()
    const nonce = this.getRandomHash()
    const {host, protocol} = window.location
    const redirectUri = `${protocol}//${host}${Routes.ROOT}`
    const url = `${authority}/connexion/oauth2/authorize?${stringify({
      'client_id': this.props.clientId,
      nonce,
      realm: '/individu',
      'redirect_uri': redirectUri,
      'response_type': 'code',
      scope: 'api_peconnect-individuv1 openid profile email api_peconnect-coordonneesv1 ' +
        'coordonnees api_peconnect-competencesv1 competences',
      state,
    })}`
    localStorage.setItem(`pe-connect.${state}`, nonce)
    window.location = url
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const buttonStyle = {
      padding: '5px 10px',
      ...style,
    }
    const imageStyle = {
      height: 31,
      marginRight: 10,
      verticalAlign: 'middle',
      width: 34,
    }
    return <button
      {...omit(extraProps, ['clientId', 'onFailure', 'onSuccess'])}
      className="login pe-connect-login"
      onClick={this.startSigninFlow} style={buttonStyle}>
      <img style={imageStyle} src={peConnectIcon} alt="Icône Pôle emploi" />
      {children}
    </button>
  }
}


class LoginModalBase extends React.Component {
  static propTypes = {
    defaultEmail: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    isLoginFormShownByDefault: PropTypes.bool,
    isShown: PropTypes.bool,
    onLogin: PropTypes.func,
    resetToken: PropTypes.string,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool.isRequired,
  }

  state = {
    isLoginFormShown: false,
    isShown: false,
  }

  componentWillMount() {
    const {isLoginFormShownByDefault, isShown} = this.props
    this.componentWillReceiveProps({isLoginFormShownByDefault, isShown})
  }

  componentWillReceiveProps(nextProps) {
    const wantShown = nextProps.isShown || !!nextProps.resetToken
    if (wantShown === this.state.isShown) {
      return
    }
    this.setState({isShown: wantShown})
    if (wantShown) {
      this.setState({isLoginFormShown: nextProps.isLoginFormShownByDefault})
    }
  }

  handleActualLogin = user => {
    const {onLogin} = this.props
    onLogin && onLogin(user)
    this.close(false)
  }

  close = hasCanceledLogin => {
    this.props.dispatch(closeLoginModal(hasCanceledLogin))
  }

  handleFacebookLogin = facebookAuth => {
    const {dispatch} = this.props
    // The facebookAuth object contains:
    //  - the email address: email
    //  - the facebook user ID: userID
    //  - the full name: name
    //  - the URL of a profile picture: picture.data.url
    const email = facebookAuth && facebookAuth.email
    if (email) {
      dispatch(facebookAuthenticateUser(facebookAuth)).then(response => {
        this.handleActualLogin(response.authenticatedUser)
        return response
      })
    }
  }

  handleGoogleLogin = googleAuth => {
    const {dispatch} = this.props
    // The googleAuth object contains the profile in getBasicProfile()
    //  - the Google ID: getId()
    //  - the email address: getEmail()
    //  - the first name: getGivenName()
    //  - the last name: getFamilyName()
    //  - the full name: getName()
    //  - the URL of a profile picture: getImageUrl()
    const email = googleAuth && googleAuth.getBasicProfile().getEmail()
    if (email) {
      dispatch(googleAuthenticateUser(googleAuth)).then(response => {
        this.handleActualLogin(response.authenticatedUser)
        return response
      })
    }
  }

  handleGoogleFailure = ({details}) => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(details))
  }

  handlePEConnectLogin = ({code, nonce}) => {
    const {dispatch} = this.props
    dispatch(peConnectAuthenticateUser(code, nonce)).then(response => {
      // TODO(pascal): Make sure we go to /confidentialite page on first registration.
      this.handleActualLogin(response.authenticatedUser)
      return response
    })
  }

  handlePEConnectFailure = error => {
    const {dispatch} = this.props
    dispatch(displayToasterMessage(error.message))
  }

  // TODO: Use different API endpoints for login and registration.
  handleRegister = (email, password, name, lastName) => {
    const {dispatch} = this.props
    name = upperFirstLetter(name.trim())
    lastName = upperFirstLetter(lastName.trim())
    return dispatch(registerNewUser(email.trim(), password, name, lastName)).then(response => {
      // TODO: Handle this more explicitly after switch to two endpoints.
      // User already exists
      if (!response.authenticatedUser) {
        dispatch(displayToasterMessage(
          'Ce compte existe déjà, merci de vous connecter avec vos identifiants'))
        this.setState({isLoginFormShown: true})
        return
      }
      this.handleActualLogin(response.authenticatedUser)
      return response
    })
  }

  handleLogin = (email, password, hashSalt) => {
    const {dispatch} = this.props
    dispatch(loginUser(email.trim(), password, hashSalt)).then(response => {
      if (response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
        // TODO: Take care of the else case when the authentication was
        // not successful but we got back some new salt. (response.hashSalt)
      }
      return response
    })
  }

  handleResetPassword = (email, password) => {
    const {dispatch, resetToken} = this.props
    dispatch(resetPassword(email.trim(), password, resetToken)).then(response => {
      if (response.authenticatedUser) {
        this.handleActualLogin(response.authenticatedUser)
      }
      return response
    })
  }

  renderIntro(style) {
    const {isMobileVersion} = this.context
    const containerStyle = {
      minHeight: '100vh',
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const coverAll = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const coverImageStyle = {
      ...coverAll,
      backgroundImage: `url(${chooseImageVersion(signupCoverImage, isMobileVersion)})`,
      backgroundPosition: 'center, center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -2,
    }
    const contentStyle = {
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 29,
      justifyContent: 'center',
      lineHeight: '38px',
      minHeight: '100vh',
      padding: 60,
    }
    const titleStyle = {
      fontSize: 60,
      fontWeight: 'bold',
      lineHeight: 1,
      textShadow: `0 2px 6px ${colorToAlpha(Colors.BOB_BLUE_HOVER, .5)}`,
    }
    const quoteStyle = {
      fontSize: 128,
      opacity: .3,
      position: 'absolute',
      right: '100%',
    }

    return <div style={containerStyle}>
      <div style={{...coverAll, backgroundColor: Colors.BOB_BLUE, opacity: .9, zIndex: -1}} />
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
          peut-être moins. Faites-nous vos retours :
          Bob s'améliore grâce à vous&nbsp;!
        </div>

        <div style={{fontSize: 20, marginTop: 40}}>
          - L'équipe de {config.productName}
        </div>
      </div>
    </div>
  }

  render() {
    const {defaultEmail, resetToken} = this.props
    const {isMobileVersion} = this.context
    const {isLoginFormShown} = this.state
    const isFullRegistrationFormShown = !isMobileVersion && !resetToken && !isLoginFormShown
    const actionBoxStyle = {
      alignItems: 'center',
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? '30px 20px' : '30px 60px',
    }
    const socialLoginBox = {
      ...actionBoxStyle,
      backgroundColor: isFullRegistrationFormShown ? 'initial' : Colors.BACKGROUND_GREY,
      borderRadius: '0 0 5px 5px',
      fontFamily: 'Lato, Helvetica',
      fontSize: 15,
    }
    const containerStyle = isFullRegistrationFormShown ? {
      alignItems: 'center',
      display: 'flex',
      transition: 'none',
      width: '100vw',
    } : {
      borderRadius: 5,
      margin: isMobileVersion ? 15 : 'initial',
      width: isMobileVersion ? 'initial' : 400,
    }
    const closeButtonStyle = {
      ':hover': {
        opacity: .9,
      },
      boxShadow: 'initial',
      opacity: .6,
      right: 50,
      top: 50,
      transform: 'initial',
    }
    const googleIconStyle = {
      fill: '#fff',
      height: 24,
      marginRight: 10,
      verticalAlign: 'middle',
      width: 34,
    }
    const socialLoginPrefix = isLoginFormShown ? 'Connexion' : 'Inscription'
    let form
    if (resetToken) {
      form = <ResetPasswordForm
        defaultEmail={defaultEmail} onResetPassword={this.handleResetPassword} />
    } else if (isLoginFormShown) {
      form = <LoginForm
        onLogin={this.handleLogin} defaultEmail={defaultEmail}
        onShowRegistrationFormClick={() => this.setState({isLoginFormShown: false})} />
    } else {
      form = <RegistrationForm
        onRegister={this.handleRegister}
        onShowLoginFormClick={() => this.setState({isLoginFormShown: true})} />
    }
    const orStyle = {
      alignItems: 'center',
      color: Colors.DARK_TWO,
      display: 'flex',
      fontSize: 15,
      width: isMobileVersion ? '100%' : 325,
    }
    return <Modal
      isShown={this.state.isShown || !!resetToken} style={containerStyle}
      onClose={(resetToken || isFullRegistrationFormShown) ? null : () => this.close(true)}>
      {isFullRegistrationFormShown ? this.renderIntro({flex: 1}) : null}
      {isFullRegistrationFormShown ?
        <ModalCloseButton onClick={() => this.close(true)} style={closeButtonStyle} /> : null}
      <div style={{flex: 1, ...Styles.CENTERED_COLUMN}}>
        <div style={actionBoxStyle}>
          {form}
        </div>
        <div style={orStyle}>
          <span style={{borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`, flex: 1}} />
          <span style={{margin: '0 20px', ...Styles.CENTER_FONT_VERTICALLY}}>ou</span>
          <span style={{borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`, flex: 1}} />
        </div>
        {resetToken ? null : <div style={socialLoginBox}>
          <FacebookLogin
            appId={config.facebookSSOAppId} language="fr"
            callback={this.handleFacebookLogin}
            fields="email,name,picture,gender,birthday"
            size="small" icon="fa-facebook"
            textButton={`${socialLoginPrefix} avec Facebook`}
            cssClass="login facebook-login" />
          <GoogleLogin
            clientId={config.googleSSOClientId} offline={false}
            onSuccess={this.handleGoogleLogin}
            onFailure={this.handleGoogleFailure}
            className="login google-login">
            <GoogleIcon style={googleIconStyle} />{`${socialLoginPrefix} avec Google`}
          </GoogleLogin>
          <PEConnectLogin
            clientId={config.emploiStoreClientId}
            onSuccess={this.handlePEConnectLogin}
            onFailure={this.handlePEConnectFailure}>
            {socialLoginPrefix} avec Pôle emploi
          </PEConnectLogin>
        </div>}
      </div>
    </Modal>
  }
}
const LoginModal = connect(({app}) => {
  const {loginModal} = app
  const {email, isReturningUser, resetToken} = loginModal && loginModal.defaultValues || {}
  return {
    defaultEmail: email,
    isLoginFormShownByDefault: !!isReturningUser,
    isShown: !!loginModal,
    resetToken,
  }
})(LoginModalBase)


class LoginButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    email: PropTypes.string,
    isLoggedIn: PropTypes.bool,
    isSignUpButton: PropTypes.bool,
    style: PropTypes.object,
    visualElement: PropTypes.string,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
  }

  handleClick = () => {
    const {email, isLoggedIn, isSignUpButton, dispatch, visualElement} = this.props
    if (isLoggedIn) {
      this.context.history.push(Routes.PROJECT_PAGE)
      return
    }
    if (isSignUpButton) {
      dispatch(openRegistrationModal({email}, visualElement))
    } else {
      dispatch(openLoginModal({email}, visualElement))
    }
  }

  render() {
    const {children} = this.props
    const extraProps = omit(this.props, [
      'children', 'dispatch', 'email', 'isLoggedIn', 'isSignUpButton', 'visualElement',
    ])
    return <Button type="deletion" onClick={this.handleClick} {...extraProps}>
      {children}
    </Button>
  }
}
const LoginButton = connect(({user}) => ({
  isLoggedIn: !!user.userId,
}))(LoginButtonBase)


export {LoginModal, LoginButton}
