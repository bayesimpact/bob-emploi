import {parse} from 'query-string'
import PropTypes from 'prop-types'
import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import config from 'config'

import {landingPageSectionIsShown, openLoginModal, openRegistrationModal,
  loadLandingPageAction} from 'store/actions'

import adviceScreenshot from 'images/screenshots/advice.png'
import arrowLeftImage from 'images/landing-arrow-left.svg'
import arrowRightImage from 'images/landing-arrow-right.svg'
import backgroundCoverImage1 from 'images/cover/cover-1.jpg'
import backgroundCoverImage2 from 'images/cover/cover-2.jpg'
import backgroundCoverImage3 from 'images/cover/cover-3.jpg'
import backgroundCoverImage4 from 'images/cover/cover-4.jpg'
import backgroundCoverImage5 from 'images/cover/cover-5.jpg'
import backgroundCoverImage6 from 'images/cover/cover-6.jpg'
import bulletImage from 'images/bullet.svg'
import diagnosticScreenshot from 'images/screenshots/diagnostic.png'
import echappeeImage from 'images/echappee-ico.png'
import etalabImage from 'images/etalab-ico.png'
import franceEngageImage from 'images/francengage-ico.png'
import githubImage from 'images/github.png'
import onboardingScreenshot from 'images/screenshots/onboarding.png'
import openAdviceScreenshot from 'images/screenshots/open-advice.png'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import rcoImage from 'images/rco-ico.png'
import sncImage from 'images/snc-ico.png'
import teamImage from 'images/landing-team.jpg'

import {LoginButton} from 'components/login'
import {ShortKey} from 'components/shortkey'
import {StaticPage} from 'components/static'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import {Button, Colors, Icon, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'


const emStyle = {
  color: '#fff',
}


// Kinds of different landing page excluding the default kind.
const landingPageTitles = {
  coach: {
    match: /coach/,
    title: <span>
      Un <em style={emStyle}>plan d'accompagnement</em> sur-mesure pour
      <em style={emStyle}> accélérer</em> votre recherche d'emploi
    </span>,
  },
  ease: {
    match: /ease|simplicity/,
    title: <span>
      Avancez <em style={emStyle}>plus facilement</em> dans votre recherche
      d'emploi
    </span>,
  },
  personalization: {
    fontSize: 35,
    match: /personalization/,
    subtitle: `${config.productName} analyse votre situation spécifique et ` +
      'trouve les meilleures solutions concrètes pour vous',
    title: <span>
      Qu'est-ce qui a le plus <span style={emStyle}>aidé</span> les gens dans
      <span style={emStyle}> ma situation</span> à <span style={emStyle}>trouver
      un emploi</span> ?
    </span>,
  },
  prioritization: {
    match: /prioritization/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui est vraiment important',
    title: <span>
      Que faire en <span style={emStyle}>priorité</span> pour <span
        style={emStyle}>trouver un emploi</span> ?
    </span>,
  },
  speed: {
    match: /speed/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui marche vraiment',
    title: <span>
      Quelle est <span style={emStyle}>la clé</span> pour <span
        style={emStyle}>trouver rapidement un emploi</span> ?
    </span>,
  },
  '': {
    buttonCaption: "Inscrivez-vous, c'est gratuit !",
    fontSize: 42,
    match: /evaluation/,
    title: <span style={emStyle}>
      Obtenez des conseils personnalisés pour
      accélérer votre recherche d'emploi
    </span>,
  },
}
const kinds = Object.keys(landingPageTitles)


const sectionTitleStyle = isMobileVersion => ({
  color: Colors.SLATE,
  fontSize: isMobileVersion ? 25 : 35,
  fontWeight: 'bold',
  lineHeight: 1.34,
})


const coverImages = [
  backgroundCoverImage1,
  backgroundCoverImage2,
  backgroundCoverImage3,
  backgroundCoverImage4,
  backgroundCoverImage5,
  backgroundCoverImage6,
]


class TitleSection extends React.Component {
  static propTypes = {
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  state = {
    coverImage: '',
    coverImageIndex: 0,
    nextCoverImage: '',
    // Extra height of components above the title (typically the cookie header).
    overheadHeight: 0,
  }

  componentWillMount() {
    this.setState({coverImage: coverImages[0], coverImageIndex: 0})
    this.interval = setInterval(this.nextCoverImage, 15000)
  }

  componentDidMount() {
    this.adjustToViewportBottom()
    this.viewportInterval = setInterval(() => this.adjustToViewportBottom(), 500)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
    clearInterval(this.viewportInterval)
    clearTimeout(this.timeout)
  }

  adjustToViewportBottom() {
    if (!this.dom) {
      return
    }
    const overheadHeight = this.dom.getBoundingClientRect().top + (
      window.scrollY || window.document.body.scrollTop || 0)
    if (overheadHeight !== this.state.overheadHeight) {
      this.setState({overheadHeight})
    }
  }

  nextCoverImage = () => {
    const nextCoverImageIndex = (this.state.coverImageIndex + 1) % coverImages.length
    const nextCoverImage = coverImages[nextCoverImageIndex]
    this.setState({nextCoverImage})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.setState({
        coverImage: nextCoverImage,
        coverImageIndex: nextCoverImageIndex,
        nextCoverImage: '',
      })
    }, 1000)
  }

  renderLoginButtons() {
    const {isMobileVersion, landingPageKind} = this.context
    const {buttonCaption} = landingPageTitles[landingPageKind] || {}
    const buttonStyle = {
      boxShadow: '0 10px 15px 0 rgba(0, 0, 0, 0.3)',
      fontSize: 15,
      letterSpacing: 1,
      marginTop: isMobileVersion ? 10 : 0,
      padding: '15px 28px 12px',
      textTransform: 'uppercase',
    }
    const loginButtonStyle = {
      ':hover': {
        backgroundColor: 'transparent',
        textShadow: '0 1px 2px rgba(0, 0, 0, .9)',
      },
      backgroundColor: 'transparent',
      color: '#fff',
      letterSpacing: 1.1,
      padding: 11,
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
      textTransform: 'uppercase',
    }
    return <div>
      <LoginButton
        style={buttonStyle} isSignUpButton={true} visualElement="title" type="navigation">
        {buttonCaption || 'Commencer'}
      </LoginButton>

      <div style={{alignItems: 'center', display: 'flex', justifyContent: 'center', marginTop: 11}}>
        <div style={{backgroundColor: 'rgba(255, 255, 255, .5)', height: 1, width: 66}} />
        <span style={{color: '#fff', fontSize: 14, margin: 7, ...Styles.CENTER_FONT_VERTICALLY}}>
          ou
        </span>
        <div style={{backgroundColor: 'rgba(255, 255, 255, .5)', height: 1, width: 66}} />
      </div>

      <div style={{lineHeight: 0.4}}>
        <LoginButton style={loginButtonStyle} visualElement="title-login">
          <Icon name="lock" style={{marginRight: 8}} />
          S'identifier
        </LoginButton>
      </div>
    </div>
  }

  render() {
    const {isMobileVersion, landingPageKind} = this.context
    const {overheadHeight} = this.state
    const {fontSize, subtitle, title} = landingPageTitles[landingPageKind] || {}
    const style = {
      alignItems: 'flex-start',
      backgroundColor: Colors.DARK,
      color: Colors.COOL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: isMobileVersion ? 39 : (fontSize || 40),
      justifyContent: 'center',
      lineHeight: 1.15,
      minHeight: `calc(100vh - ${overheadHeight}px)`,
      padding: isMobileVersion ? '0 10px 60px' : '60px 10px',
      position: 'relative',
      ...this.props.style,
    }
    const coverAll = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const backgroundStyle = {
      ...coverAll,
      zIndex: 0,
    }
    const navBackgroundStyle = {
      backgroundImage: 'linear-gradient(to bottom, rgba(33, 41, 61, 0.5), transparent)',
      height: 100,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: -1,
    }
    const imageBackgroundStyle = {
      ...coverAll,
      backgroundImage: `url("${this.state.coverImage}")`,
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      zIndex: -3,
    }
    const nextImageBackgroundStyle = {
      ...imageBackgroundStyle,
      backgroundImage:
        this.state.nextCoverImage ? `url("${this.state.nextCoverImage}")` : 'initial',
      opacity: this.state.nextCoverImage ? 1 : 0,
      transition: this.state.nextCoverImage ? '1s' : 'initial',
      zIndex: -2,
    }
    const coverBackgroundStyle = {
      ...coverAll,
      backgroundColor: Colors.DARK,
      opacity: .4,
      zIndex: -1,
    }
    const titleStyle = {
      fontWeight: 'bold',
      marginBottom: 18,
      marginTop: isMobileVersion ? 0 : 30,
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
    }
    const subTitleStyle = {
      fontSize: isMobileVersion ? 20 : 25,
      marginBottom: 20,
      textShadow: '0 2px 15px rgba(0, 0, 0, 0.5)',
    }
    const chevronStyle = {
      animation: 'bounce 4s ease infinite',
      bottom: 0,
      color: '#fff',
      cursor: 'pointer',
      fontSize: 45,
      left: isMobileVersion ? 0 : 400,
      position: 'absolute',
      right: isMobileVersion ? 0 : 400,
      textAlign: 'center',
    }
    const ngoBoxStyle = {
      alignSelf: 'center',
      color: Colors.MODAL_PROJECT_GREY,
      display: 'flex',
      fontSize: 14,
      fontStyle: 'italic',
      fontWeight: 500,
      textAlign: 'center',
      width: isMobileVersion ? 280 : 340,
      zIndex: 1,
    }
    return <section style={style} ref={dom => {
      this.dom = dom
    }}>
      <div style={backgroundStyle}>
        <div style={imageBackgroundStyle} />
        <div style={nextImageBackgroundStyle} />
        <div style={coverBackgroundStyle} />
        <div style={navBackgroundStyle} />
      </div>
      <div style={{flex: 1}} />
      <div style={{margin: '0 auto', maxWidth: 950, textAlign: 'center', zIndex: 1}}>
        <div style={titleStyle}>{title}</div>
        {subtitle ? <div style={subTitleStyle}>{subtitle}</div> : <div style={{height: 65}} />}
        {this.renderLoginButtons()}
      </div>
      <div style={{flex: 1}} />
      <div style={ngoBoxStyle}>
        Nous sommes une association loi 1901 à but non lucratif&nbsp;: {config.productName} est
        gratuit et le restera toujours.
      </div>
      <div style={chevronStyle} onClick={() => {
        window.scroll({behavior: 'smooth', top: this.dom && this.dom.clientHeight || 500})
      }}>
        <Icon name="chevron-down" />
      </div>
    </section>
  }
}


class ScreenshotsSection extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  renderScreenshot(title, description, flexDirection, screenshotSrc, arrowNext) {
    const {isMobileVersion} = this.context
    const style = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : flexDirection,
      fontSize: isMobileVersion ? 16 : 18,
      justifyContent: 'space-between',
      lineHeight: 1.3,
      margin: 'auto',
      maxWidth: 1000,
      paddingBottom: isMobileVersion ? 40 : 100,
    }
    const descriptionStyle = {
      marginTop: isMobileVersion ? 20 : 0,
      maxWidth: isMobileVersion ? '90%' : 340,
      textAlign: isMobileVersion ? 'center' : 'left',
    }
    const titleStyle = {
      fontSize: isMobileVersion ? 20 : 25,
      fontWeight: 'bold',
      marginBottom: 25,
    }
    const imageStyle = {
      boxShadow: '0 0 35px 0 rgba(0, 0, 0, 0.25)',
      width: isMobileVersion ? '90%' : 570,
    }
    const arrowStyle = {
      [arrowNext === 'left' ? 'right' : 'left']: '100%',
      [arrowNext === 'left' ? 'marginRight' : 'marginLeft']: 5,
      position: 'absolute',
      top: '100%',
    }
    return <div style={style}>
      <div style={{position: 'relative'}}>
        <img src={screenshotSrc} style={imageStyle} alt="" />
        {(!isMobileVersion && arrowNext) ? <img
          style={arrowStyle} alt=""
          src={arrowNext === 'left' ? arrowLeftImage : arrowRightImage} /> : null}
      </div>
      <div style={descriptionStyle}>
        <div style={titleStyle}>{title}</div>
        <em>{description}</em>
      </div>
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: Colors.BACKGROUND_GREY,
      color: Colors.SLATE,
      paddingTop: 50,
      textAlign: 'center',
    }
    const headerStyle = {
      fontSize: isMobileVersion ? 28 : 35,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 50,
    }
    return <section style={style}>
      <header style={headerStyle}>
        Comment ça marche&nbsp;?
      </header>

      {this.renderScreenshot(
        'Vous expliquez votre projet à Bob',
        "L'application vous pose une série de questions pour situer votre projet.",
        'row-reverse', onboardingScreenshot, 'left')}

      {this.renderScreenshot(
        'Bob analyse votre situation',
        `À l'aide du Big data et des données du marché du travail l'application
        remonte les freins et les facteurs de succès de votre recherche
        d'emploi.`,
        'row', diagnosticScreenshot, 'right')}

      {this.renderScreenshot(
        'Bob vous propose de nouvelles pistes',
        `En partant des astuces de centaines de professionnels, l'application
        trouve les plus adaptées à votre profil.`,
        'row-reverse', adviceScreenshot, 'left')}

      {this.renderScreenshot(
        'Vous relancez votre recherche avec de meilleurs outils',
        `L'application garde vos informations et vous pouvez consulter à tous
        moments les conseils et astuces.`,
        'row', openAdviceScreenshot)}
    </section>
  }
}


class ConvictionsSection extends React.Component {
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  renderConviction(content) {
    const {isMobileVersion} = this.context
    const style = {
      display: 'block',
      padding: isMobileVersion ? '0 0 25px' : '0 0 25px 35px',
      position: 'relative',
      textAlign: 'left',
    }
    const bulletStyle = {
      left: 0,
      position: 'absolute',
      top: 0,
    }
    return <li style={style}>
      {isMobileVersion ? null : <img src={bulletImage} alt="" style={bulletStyle} />}
      {content}
    </li>
  }

  render() {
    const {isMobileVersion, history} = this.context
    const style = {
      backgroundColor: '#fff',
      color: Colors.SLATE,
      overflowX: 'hidden',
      padding: isMobileVersion ? '50px 0' : '100px 0',
    }
    const contentStyle = {
      lineHeight: 1.47,
      maxWidth: 600,
      minHeight: 365,
      padding: isMobileVersion ? '22px 40px 0' : '22px 40px 0 0',
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'initial',
    }
    const headerStyle = {
      fontSize: isMobileVersion ? 28 : 35,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 50,
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.SKY_BLUE,
        color: '#fff',
      },
      backgroundColor: '#fff',
      border: `solid 2px ${Colors.SKY_BLUE}`,
      color: Colors.SKY_BLUE,
      marginTop: 35,
    }

    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: 1000}}>
        <div style={contentStyle}>
          <header style={headerStyle}>
            Nos convictions
          </header>
          {isMobileVersion ? null :
            <img src={teamImage} style={{left: '100%', position: 'absolute', top: 0}} alt="" />}
          {this.renderConviction(
            <span>
              Qu'il faut toujours
              <strong> mettre l'individu au coeur de la recherche d'emploi</strong>.
            </span>)}
          {this.renderConviction(
            <span>
              Que même s'il n'y a pas de solution miracle,
              <strong> on a tous des pistes à explorer pour augmenter ses chances. </strong>
              Qu'elles soient nouvelles ou paraissent évidentes.
            </span>)}
          {this.renderConviction(
            <span>Qu'il ne sert à rien de s'épuiser à postuler toujours plus&nbsp;: la
              recherche d'emploi n'est pas une affaire de matching.
              <strong> C'est une affaire humaine</strong>.
            </span>)}
          <Button
            style={buttonStyle} isNarrow={true}
            onClick={() => history.push(Routes.VISION_PAGE)}>
            En lire plus sur notre mission
          </Button>
        </div>
      </div>
    </section>
  }
}


class BobHelpsYouSection extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  render() {
    const {isMobileVersion, landingPageKind} = this.context
    const {buttonCaption} = landingPageTitles[landingPageKind] || {}
    const style = {
      backgroundColor: Colors.SKY_BLUE,
      color: '#fff',
      fontSize: 30,
      lineHeight: 1.33,
      padding: isMobileVersion ? '40px 30px' : 65,
      textAlign: 'center',
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      marginTop: 30,
      padding: '18px 28px 12px',
      textTransform: 'uppercase',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: 960}}>
        Seulement 12% des embauches se font en répondant aux offres sur
        internet. Avec {config.productName}, vous saurez trouver 100% des
        opportunités&nbsp;!
      </div>
      <LoginButton
        style={buttonStyle} isSignUpButton={true} visualElement="helpsyou"
        type="navigationOnImage">
        {buttonCaption || 'Commencer'}
      </LoginButton>
    </section>
  }
}


class TestimonialsSection extends React.Component {
  render() {
    const {isMobileVersion} = this.context
    const headerStyle = {
      color: Colors.SLATE,
      fontSize: isMobileVersion ? 30 : 35,
      fontWeight: 'bold',
      padding: isMobileVersion ? '45px 30px' : '70px 100px',
      textAlign: 'center',
    }
    return <section style={{paddingBottom: 40}}>
      <header style={headerStyle}>
        Bob les a aidés à retrouver du travail
      </header>
      <Testimonials>
        <TestimonialCard author="Jean, 45 ans" isAuthorMan={true}>
          Merci ! Grâce aux conseils simples mais avisés de votre site j'ai
          rapidement été contacté par un recruteur.
        </TestimonialCard>
        <TestimonialCard author="Laurie, 36 ans">
          J'ai été bluffée par la pertinence du plan d'action proposé.
        </TestimonialCard>
        <TestimonialCard author="Sofiane, 27 ans">
          Organisation, soutien, motivation, {config.productName} m'a aidée à savoir
          quoi faire et comment.
        </TestimonialCard>
      </Testimonials>
    </section>
  }
}


const partnersContent = [
  {
    imageSrc: poleEmploiImage,
    name: 'Pôle Emploi',
  },
  {
    imageSrc: franceEngageImage,
    name: "La France s'engage",
  },
  {
    imageSrc: sncImage,
    name: 'Solidarités nouvelles contre le chômage',
  },
  {
    imageSrc: rcoImage,
    name: 'Réseau des CARIF-OREF',
  },
  {
    imageSrc: echappeeImage,
    name: "L'Échappée Volée",
  },
  {
    imageSrc: etalabImage,
    name: 'Etalab',
  },
]


class PartnersSection extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      margin: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '45px 30px 30px' : '70px 100px 55px',
    }
    const partnerBoxStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      marginTop: 50,
    }
    return <section style={{backgroundColor: '#fff'}}>
      <div style={style}>
        <div style={sectionTitleStyle(isMobileVersion)}>
          Nos partenaires
        </div>
        <div style={partnerBoxStyle}>
          {partnersContent.map(partner => {
            return <PartnerCard
              name={partner.name} key={partner.name}
              imageSrc={partner.imageSrc} />
          })}
        </div>
      </div>
    </section>
  }
}


class PartnerCard extends React.Component {
  static propTypes = {
    imageSrc: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  };

  render() {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      width: 300,
    }
    const imageContainerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      height: 150,
      justifyContent: 'center',
      marginBottom: 45,
      width: 300,
    }
    const {imageSrc, name} = this.props
    return <div style={containerStyle}>
      <div style={imageContainerStyle}>
        <img src={imageSrc} alt={name} title={name} />
      </div>
    </div>
  }
}


class LandingPage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  static childContextTypes = {
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  state = {
    isGitHubBannerShown: false,
    isLastSectionVisible: false,
    landingPageKind: '',
  }

  getChildContext() {
    const {landingPageKind} = this.state
    return {landingPageKind}
  }

  componentWillMount() {
    const {dispatch, location} = this.props
    const {hash, pathname, search} = location
    const query = parse(search)
    const utmContent = query['utm_content'] || ''
    for (const landingPageKind in landingPageTitles) {
      if (landingPageTitles[landingPageKind].match.test(utmContent)) {
        this.setState({landingPageKind})
        break
      }
    }
    if (hash === '#inscription') {
      dispatch(openRegistrationModal({email: query.email || ''}, 'urlHash'))
    }
    // In Mobile Facebook auth flow, the Facebook login button component needs
    // to be mounted in order to actually login after a redirect.
    if (query.state === 'facebookdirect') {
      dispatch(openRegistrationModal({}, 'facebookDirect'))
    }
    if (pathname !== Routes.ROOT) {
      dispatch(openLoginModal({
        email: query.email || '',
      }, 'returninguser'))
    }
  }

  componentDidMount() {
    this.props.dispatch(loadLandingPageAction)
  }

  handleOpenLoginModal = () => {
    this.props.dispatch(openRegistrationModal(undefined, 'fastforward'))
  }

  handleVisibility(sectionName) {
    return isVisible => {
      if (!isVisible) {
        return
      }
      this.props.dispatch(landingPageSectionIsShown(sectionName))
    }
  }

  handleVisibilityLastSection(sectionName) {
    return isLastSectionVisible => {
      this.setState({isLastSectionVisible})
      this.handleVisibility(sectionName)(isLastSectionVisible)
    }
  }

  renderGitHubBanner(isVisible) {
    const {isMobileVersion} = this.context
    if (isMobileVersion) {
      return null
    }
    const style = {
      backgroundColor: '#fff',
      borderRadius: 2,
      bottom: isVisible ? 15 : -200,
      boxShadow: '0 18px 25px 0 rgba(0, 0, 0, 0.15)',
      color: Colors.DARK,
      display: 'flex',
      fontSize: 14,
      opacity: isVisible ? 1 : 0,
      position: 'fixed',
      right: 15,
      width: 360,
      zIndex: 1,
      ...SmoothTransitions,
    }
    const imageContainerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.SQUASH,
      borderRadius: '2px 0 0 2px',
      display: 'flex',
      justifyContent: 'center',
      width: 50,
    }
    const linkStyle = {
      color: Colors.DARK,
      fontStyle: 'italic',
      fontWeight: 500,
      textDecoration: 'none',
    }
    return <div style={style}>
      <div style={imageContainerStyle}>
        <img src={githubImage} alt="" />
      </div>
      <div style={{flex: 1, padding: '25px 20px'}}>
        <span style={{fontWeight: 500}}>{config.productName}</span> est un projet
        open source et chacun peut participer à sa construction.
        <br /><br />
        <a
          href={config.githubSourceLink} rel="noopener noreferrer"
          style={linkStyle} target="_blank">
          Voir le code source sur GitHub <Icon name="chevron-right" />
        </a>
      </div>
    </div>
  }

  render() {
    const {isGitHubBannerShown, isLastSectionVisible} = this.state
    return <StaticPage page="landing" isContentScrollable={false} isNavBarTransparent={true}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true}
        onKeyPress={this.handleOpenLoginModal} />

      {this.renderGitHubBanner(isGitHubBannerShown && !isLastSectionVisible)}

      <TitleSection />

      <VisibilitySensor
        onChange={isGitHubBannerShown => this.setState({isGitHubBannerShown})}
        partialVisibility={true} minTopValue={150} intervalDelay={250}>
        <div>
          <VisibilitySensor
            onChange={this.handleVisibility('convictions')} partialVisibility={true}
            intervalDelay={250}>
            <ConvictionsSection />
          </VisibilitySensor>

          <VisibilitySensor
            onChange={this.handleVisibility('screenshot')} partialVisibility={true}
            intervalDelay={250}>
            <ScreenshotsSection />
          </VisibilitySensor>

          <VisibilitySensor
            onChange={this.handleVisibility('bobHelpsYou')} partialVisibility={true}
            intervalDelay={250}>
            <BobHelpsYouSection />
          </VisibilitySensor>

          <VisibilitySensor
            onChange={this.handleVisibility('testimonials')} partialVisibility={true}
            intervalDelay={250}>
            <TestimonialsSection />
          </VisibilitySensor>
        </div>
      </VisibilitySensor>

      <VisibilitySensor
        onChange={this.handleVisibilityLastSection('partners')} partialVisibility={true}
        intervalDelay={250}>
        <PartnersSection />
      </VisibilitySensor>
    </StaticPage>
  }
}

export {LandingPage}
