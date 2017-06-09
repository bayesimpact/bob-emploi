import React from 'react'
import PropTypes from 'prop-types'
import {Link} from 'react-router'

import config from 'config'

import {openLoginModal, loadLandingPageAction} from 'store/actions'

import adviceScreenshot from 'images/screenshots/advice.png'
import arrowLeftImage from 'images/landing-arrow-left.svg'
import arrowRightImage from 'images/landing-arrow-right.svg'
import diagnosticScreenshot from 'images/screenshots/diagnostic.png'
import echappeeImage from 'images/echappee-ico.png'
import etalabImage from 'images/etalab-ico.png'
import franceEngageImage from 'images/francengage-ico.png'
import onboardingScreenshot from 'images/screenshots/onboarding.png'
import openAdviceScreenshot from 'images/screenshots/open-advice.png'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import rcoImage from 'images/rco-ico.png'
import sncImage from 'images/snc-ico.png'

import {LoginButton} from 'components/login'
import {ShortKey} from 'components/shortkey'
import {StaticPage} from 'components/static'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import {Colors} from 'components/theme'
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
    buttonCaption: 'Obtenir mon diagnostic',
    match: /evaluation/,
    title: <span>Bob <span style={emStyle}>évalue</span> votre recherche d'emploi</span>,
  },
}
const kinds = Object.keys(landingPageTitles)


const sectionTitleStyle = isMobileVersion => ({
  color: Colors.SLATE,
  fontSize: isMobileVersion ? 25 : 35,
  fontWeight: 'bold',
  lineHeight: 1.34,
})


class TitleSection extends React.Component {
  static propTypes = {
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  render() {
    const {isMobileVersion, landingPageKind} = this.context
    const {buttonCaption, fontSize, subtitle, title} = landingPageTitles[landingPageKind] || {}
    const style = {
      alignItems: 'flex-start',
      backgroundColor: Colors.DARK,
      color: Colors.COOL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: isMobileVersion ? 30 : (fontSize || 40),
      justifyContent: 'center',
      lineHeight: 1.15,
      padding: isMobileVersion ? '30px 10px 45px 10px' : '40px 0',
      position: 'relative',
      ...this.props.style,
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      marginTop: isMobileVersion ? 10 : 0,
      padding: '14px 28px 12px',
      textTransform: 'uppercase',
    }
    const titleStyle = {
      marginBottom: 18,
      marginTop: isMobileVersion ? 0 : 30,
    }
    const subTitleStyle = {
      fontSize: isMobileVersion ? 20 : 25,
      marginBottom: 20,
    }
    return <section style={style}>
      <div style={{margin: '0 auto', maxWidth: 950, textAlign: 'center'}}>
        <div style={titleStyle}>{title}</div>
        {subtitle ? <div style={subTitleStyle}>{subtitle}</div> : null}
        <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="title">
          {buttonCaption || 'Commencer'}
        </LoginButton>
        <div style={{fontSize: 15, marginTop: 15}}>
          <Link to={Routes.PROFESSIONALS_PAGE} style={{color: Colors.COOL_GREY}}>
            Vous êtes un accompagnant&nbsp;?
          </Link>
        </div>
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
        <img src={screenshotSrc} style={imageStyle} />
        {(!isMobileVersion && arrowNext) ? <img
            style={arrowStyle}
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


class BobHelpsYouSection extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  render() {
    const {isMobileVersion, landingPageKind} = this.context
    const {buttonCaption} = landingPageTitles[landingPageKind] || {}
    const style = {
      backgroundColor: Colors.DARK,
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
      <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="helpsyou">
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
    routing: PropTypes.object.isRequired,
  }

  state = {
    landingPageKind: '',
  }

  static childContextTypes = {
    landingPageKind: PropTypes.oneOf(kinds).isRequired,
  }

  getChildContext() {
    const {landingPageKind} = this.state
    return {landingPageKind}
  }

  componentWillMount() {
    const {query} = this.props.routing.locationBeforeTransitions
    const utmContent = query['utm_content'] || ''
    for (const landingPageKind in landingPageTitles) {
      if (landingPageTitles[landingPageKind].match.test(utmContent)) {
        this.setState({landingPageKind})
        break
      }
    }
  }

  componentDidMount() {
    this.props.dispatch(loadLandingPageAction)
  }

  handleOpenLoginModal = () => {
    this.props.dispatch(openLoginModal(undefined, 'fastforward'))
  }

  render() {
    return <StaticPage page="landing">
      <ShortKey
          keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.handleOpenLoginModal} />

      <TitleSection />

      <ScreenshotsSection />

      <BobHelpsYouSection />

      <TestimonialsSection />

      <PartnersSection />
    </StaticPage>
  }
}

export {LandingPage}
