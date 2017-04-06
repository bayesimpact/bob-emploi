import React from 'react'
import {ShortKey} from 'components/shortkey'

import config from 'config'
import {StaticPage} from 'components/static'
import {Colors, SmoothTransitions} from 'components/theme'
import {openLoginModal, loadLandingPageAction} from 'store/actions'
import {LoginButton} from 'components/login'


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
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
    landingPageKind: React.PropTypes.oneOf(kinds).isRequired,
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
      marginRight: 15,
      marginTop: isMobileVersion ? 10 : 0,
      padding: '16px 28px 12px',
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
      </div>
    </section>
  }
}


class ScreenshotsSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
      </span>, 'row-reverse', require('images/screenshot-advisor.png'))}

      {this.renderScreenshot(<span>
        Nos recommandations utilisent l'analyse <strong>de millions de
        données</strong> et de <strong>retours du terrain</strong> pour être
        plus pertinentes
      </span>, 'row', require('images/screenshot-data.png'))}

      {this.renderScreenshot(<span>
        <strong>Foncez</strong> vers l'emploi grâce à votre <strong>plan
        d'action personnalisé</strong>
      </span>, 'row-reverse', require('images/screenshot-tips.png'))}
    </section>
  }
}


class BobHelpsYouSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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


class TestimonialCard extends React.Component {
  static propTypes = {
    author: React.PropTypes.string.isRequired,
    children: React.PropTypes.node,
    isAuthorMan: React.PropTypes.bool,
    style: React.PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {author, children, isAuthorMan} = this.props
    const {isMobileVersion} = this.context
    const horizontalPadding = isMobileVersion ? 30 : 75
    const style = {
      backgroundColor: '#fff',
      borderRadius: 10,
      color: Colors.DARK_TWO,
      fontSize: 18,
      fontStyle: 'italic',
      lineHeight: 1.44,
      maxWidth: 600,
      minHeight: 280,
      padding: isMobileVersion ? '30px 30px' : `60px ${horizontalPadding}px 0`,
      position: 'relative',
      ...this.props.style,
    }
    const authorStyle = {
      alignItems: 'center',
      bottom: 50,
      color: Colors.DARK,
      display: 'flex',
      fontSize: 14,
      fontStyle: 'initial',
      fontWeight: 500,
      left: 0,
      padding: `0 ${horizontalPadding}px`,
      position: 'absolute',
    }
    const authorPicto = <img style={{marginRight: 15}} src={isAuthorMan ?
      require('images/man-icon.svg') : require('images/woman-icon.svg')} />
    return <div style={style}>
      {children}
      <div style={authorStyle}>{authorPicto} {author}</div>
    </div>
  }
}


const testimonialCards = [
  <TestimonialCard author="Jean, 45 ans" style={{margin: 'auto'}} isAuthorMan={true}>
    Merci ! Grâce aux conseils simples mais avisés de votre site j'ai
    rapidement été contacté par un recruteur.
  </TestimonialCard>,
  <TestimonialCard author="Laurie, 36 ans" style={{margin: 'auto'}}>
    J'ai été bluffée par la pertinence du plan d'action proposé.
  </TestimonialCard>,
  <TestimonialCard author="Sofiane, 27 ans" style={{margin: 'auto'}}>
    Organisation, soutien, motivation, {config.productName} m'a aidée à savoir
    quoi faire et comment.
  </TestimonialCard>,
]


class TestimonialsSection extends React.Component {
  static propTypes = {
    carouselAutoRotationDurationMs: React.PropTypes.number.isRequired,
  }
  static defaultProps = {
    carouselAutoRotationDurationMs: 5000,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    isTransitionBlocked: false,
    previousTestimonial: null,
    shownTestimonial: null,
    shownTestimonialIndex: -1,
  }

  componentWillMount() {
    this.pickTestimonial(0)
    this.resetRotationTimer()
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  resetRotationTimer() {
    const {carouselAutoRotationDurationMs} = this.props
    clearInterval(this.interval)
    this.interval = setInterval(
      () => this.pickTestimonial(this.state.shownTestimonialIndex + 1),
      carouselAutoRotationDurationMs)
  }

  pickTestimonial = (index, isManullyPicked) => {
    const shownTestimonialIndex = (index + testimonialCards.length) % testimonialCards.length
    if (isManullyPicked) {
      this.resetRotationTimer()
    }
    if (shownTestimonialIndex === this.state.shownTestimonialIndex) {
      return
    }
    this.setState({
      isTransitionBlocked: true,
      previousTestimonial: this.state.shownTestimonial,
      previousTestimonialIndex: this.state.shownTestimonialIndex,
      shownTestimonial: testimonialCards[shownTestimonialIndex] || null,
      shownTestimonialIndex,
    }, () => setTimeout(() => this.setState({isTransitionBlocked: false}), false))
  }

  renderBullets() {
    const containerStyle = {
      marginBottom: 40,
      padding: 0,
      textAlign: 'center',
    }
    const style = isSelected => ({
      backgroundColor: isSelected ? Colors.CHARCOAL_GREY : Colors.PINKISH_GREY,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-block',
      height: 6,
      margin: 4,
      width: 6,
    })
    return <ol style={containerStyle}>
      {testimonialCards.map((card, i) => <li
          key={'bullet-' + i} style={style(i === this.state.shownTestimonialIndex)}
          onClick={() => this.pickTestimonial(i, true)} />)}
    </ol>
  }

  render() {
    const {isMobileVersion} = this.context
    const {isTransitionBlocked, previousTestimonial, previousTestimonialIndex,
      shownTestimonial, shownTestimonialIndex} = this.state
    const headerStyle = {
      color: Colors.SLATE,
      fontSize: isMobileVersion ? 30 : 35,
      padding: isMobileVersion ? '45px 30px' : '70px 100px',
      textAlign: 'center',
    }
    const style = {
      height: 280,
      margin: 'auto',
      overflow: 'hidden',
      padding: isMobileVersion ? '45px 30px 10px' : '30px 100px 10px',
      position: 'relative',
    }
    const containerStyle = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    const leavingStyle = {
      opacity: isTransitionBlocked ? 1 : 0,
      transform: `translateX(${isTransitionBlocked ? '0' : '-500px'})`,
      ...containerStyle,
    }
    const arrivingStyle = {
      opacity: isTransitionBlocked ? 0 : 1,
      transform: `translateX(${isTransitionBlocked ? '500px' : '0'})`,
      ...containerStyle,
    }
    return <section>
      <header style={headerStyle}>
        Ils ont essayé {config.productName}, et ont <span style={{color:
          Colors.SKY_BLUE}}>retrouvé du travail</span>
      </header>
      <div style={style}>
        {previousTestimonialIndex === shownTestimonialIndex ? null :
        <div style={leavingStyle} key={previousTestimonialIndex}>
          {previousTestimonial}
        </div>}
        <div style={arrivingStyle} key={shownTestimonialIndex}>
          {shownTestimonial}
        </div>
      </div>
      {this.renderBullets()}
    </section>
  }
}


const partnersContent = [
  {
    imageSrc: require('images/ple-emploi-ico.png'),
    name: 'Pôle Emploi',
  },
  {
    imageSrc: require('images/francengage-ico.png'),
    name: "La France s'engage",
  },
  {
    imageSrc: require('images/snc-ico.png'),
    name: 'Solidarités nouvelles contre le chômage',
  },
  {
    imageSrc: require('images/rco-ico.png'),
    name: 'Réseau des CARIF-OREF',
  },
  {
    imageSrc: require('images/echappee-ico.png'),
    name: "L'Échappée Volée",
  },
  {
    imageSrc: require('images/etalab-ico.png'),
    name: 'Etalab',
  },
]


class PartnersSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
    imageSrc: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
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
    dispatch: React.PropTypes.func.isRequired,
    routing: React.PropTypes.object.isRequired,
  }

  state = {
    landingPageKind: '',
  }

  static childContextTypes = {
    landingPageKind: React.PropTypes.oneOf(kinds).isRequired,
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
