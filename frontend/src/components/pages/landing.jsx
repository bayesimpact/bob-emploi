import React from 'react'
import PropTypes from 'prop-types'
import {Link} from 'react-router'

import config from 'config'

import {openLoginModal, loadLandingPageAction} from 'store/actions'

import advisorScreenshot from 'images/screenshot-advisor.png'
import dataScreenshot from 'images/screenshot-data.png'
import echappeeImage from 'images/echappee-ico.png'
import etalabImage from 'images/etalab-ico.png'
import franceEngageImage from 'images/francengage-ico.png'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import rcoImage from 'images/rco-ico.png'
import sncImage from 'images/snc-ico.png'
import tipsScreenshot from 'images/screenshot-tips.png'

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
    match: /prioritization/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui est vraiment important',
    title: <span>
      Que faire en <span style={emStyle}>priorité</span> pour <span
      style={emStyle}>trouver un emploi</span> ?
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
    const {fontSize, subtitle, title} = landingPageTitles[landingPageKind] || {}
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
          Commencer
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

  renderScreenshot(description, flexDirection, screenshotSrc) {
    const {isMobileVersion} = this.context
    const style = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : flexDirection,
      fontSize: isMobileVersion ? 20 : 25,
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
    const imageStyle = {
      boxShadow: '0 0 35px 0 rgba(0, 0, 0, 0.25)',
      width: isMobileVersion ? '90%' : 570,
    }
    return <div style={style}>
      <img src={screenshotSrc} style={imageStyle} />
      <div style={descriptionStyle}>{description}</div>
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: '#fff',
      color: Colors.SLATE,
      paddingTop: 50,
      textAlign: 'center',
    }
    const headerStyle = {
      fontSize: isMobileVersion ? 28 : 35,
      lineHeight: 1,
      marginBottom: 50,
    }
    return <section style={style}>
      <header style={headerStyle}>
        Un service d'accompagnement
        <div style={{fontStyle: 'italic', fontWeight: 'bold'}}>
          personnalisé et entièrement gratuit
        </div>

        <div style={{fontSize: 20, fontStyle: 'italic', marginTop: 15}}>
          proposé par l'ONG à but non-lucratif Bayes Impact
        </div>
      </header>

      {this.renderScreenshot(<span>
        Découvrez ce qui va vraiment <strong>booster votre recherche d'emploi</strong>
      </span>, 'row-reverse', advisorScreenshot)}

      {this.renderScreenshot(<span>
        Nos recommandations utilisent l'analyse <strong>de millions de
        données</strong> et de <strong>retours du terrain</strong> pour être
        plus pertinentes
      </span>, 'row', dataScreenshot)}

      {this.renderScreenshot(<span>
        <strong>Foncez</strong> vers l'emploi grâce à votre <strong>plan
        d'action personnalisé</strong>
      </span>, 'row-reverse', tipsScreenshot)}
    </section>
  }
}


class BobHelpsYouSection extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
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
      <div style={{margin: 'auto', maxWidth: 450}}>
        Découvrez comment {config.productName} peut vous aider !
      </div>
      <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="helpsyou">
        Commencer
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
      padding: isMobileVersion ? '45px 30px' : '70px 100px',
      textAlign: 'center',
    }
    return <section style={{paddingBottom: 40}}>
      <header style={headerStyle}>
        Ils ont essayé {config.productName}, et ont <span style={{color:
          Colors.SKY_BLUE}}>retrouvé du travail</span>
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
    ]
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
    for (const landingPageKind in landingPageTitles) {
      if (landingPageTitles[landingPageKind].match.test(query['utm_content'] || '')) {
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
