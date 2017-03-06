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
  coach: <span>
    Un <em style={emStyle}>plan d'accompagnement</em> sur-mesure pour
    <em style={emStyle}> accélérer</em> votre recherche d'emploi
  </span>,
  ease: <span>
    Avancez <em style={emStyle}>plus facilement</em> dans votre recherche
    d'emploi
  </span>,
  '': <span>
    Les meilleures <em style={emStyle}>recommandations</em> pour
    <em style={emStyle}> accélérer</em> votre recherche d'emploi
  </span>,
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
    const style = {
      alignItems: 'flex-start',
      color: Colors.COOL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: isMobileVersion ? 25 : 40,
      justifyContent: 'center',
      lineHeight: 1.15,
      padding: isMobileVersion ? '30px 10px 45px 10px' : '40px 0',
      position: 'relative',
      zIndex: 0,
      ...this.props.style,
    }
    const backgroundStyle = {
      backgroundColor: Colors.DARK,
      bottom: isMobileVersion ? 0 : -100,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: -1,
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
    const byBayesStyle = {
      fontSize: 15,
      marginTop: 35,
    }
    const strongEmStyle = {
      fontWeight: 500,
      ...emStyle,
    }
    return <section style={style}>
      <div style={backgroundStyle} />
      <div style={{margin: '0 auto', maxWidth: 800, textAlign: 'center'}}>
        <div style={titleStyle}>
          {landingPageTitles[landingPageKind] || ''}
        </div>
        <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="title">
          Commencer
        </LoginButton>
        {isMobileVersion ? null : <div style={byBayesStyle}>
          un service <em style={strongEmStyle}>gratuit</em> créé par l'association à
          but non lucratif <em style={strongEmStyle}>Bayes Impact</em>
        </div>}
      </div>
    </section>
  }
}


class DescriptionSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
    landingPageKind: React.PropTypes.oneOf(kinds).isRequired,
  }

  renderDescription(kind, picto, children) {
    const {isMobileVersion, landingPageKind} = this.context
    if (kind !== landingPageKind) {
      return null
    }
    const style = {
      backgroundColor: '#fff',
      borderRadius: 2,
      boxShadow: '0 2px 24px 0 rgba(0, 0, 0, 0.05)',
      color: Colors.CHARCOAL_GREY,
      display: 'inline-block',
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 500,
      height: 180,
      lineHeight: 1.56,
      margin: '30px 14px 15px',
      padding: '80px 30px 0',
      position: 'relative',
      verticalAlign: 'top',
      width: isMobileVersion ? 'initial' : 315,
    }
    const pictoContainerStyle = {
      left: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'center',
      top: -30,
    }
    const pictoStyle = {
      borderRadius: '100%',
      boxShadow: '5px 10px 25px 0 rgba(56, 63, 81, 0.25)',
    }
    return <div style={style}>
      <div style={pictoContainerStyle}>
        <img src={picto} style={pictoStyle} />
      </div>
      {children}
    </div>
  }

  render() {
    return <section style={{marginBottom: 15, marginTop: 15, textAlign: 'center'}}>
      {this.renderDescription('', require('images/file-search-picto.svg'), <div>
        <strong>Trouvez quels conseils suivre en priorité</strong> grâce à nos algorithmes.
      </div>)}
      {this.renderDescription('', require('images/file-checks-picto.svg'), <div>
        <strong>Choisissez les solutions pour améliorer votre recherche </strong>
        qui vous correspondent le mieux.
      </div>)}
      {this.renderDescription('', require('images/file-checked-picto.svg'), <div>
        <strong>Avancez vers vos objectifs</strong> grâce à un plan d'action détaillé.
      </div>)}

      {this.renderDescription('coach', require('images/file-checked-picto.svg'), <div>
        <strong>Créez votre plan d'action</strong> personnalisé en deux minutes.
      </div>)}
      {this.renderDescription('coach', require('images/file-checks-picto.svg'), <div>
        <strong>Avancez en restant motivé</strong> avec un accompagnement au quotidien.
      </div>)}
      {this.renderDescription('coach', require('images/light-bulb-picto.svg'), <div>
        <strong>Découvrez de nouvelles idées</strong> pour faciliter votre recherche.
      </div>)}

      {this.renderDescription('ease', require('images/file-search-picto.svg'), <div>
        <strong>Trouver des solutions</strong> simples et qui vous correspondent.
      </div>)}
      {this.renderDescription('ease', require('images/file-checks-picto.svg'), <div>
        <strong>Avancez rapidement</strong> grâce à un accompagnement pas à pas.
      </div>)}
      {this.renderDescription('ease', require('images/light-bulb-picto.svg'), <div>
        <strong>Découvrez de nouvelles idées</strong> pour étendre votre recherche.
      </div>)}
    </section>
  }
}


class BigDataForYouSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: Colors.SKY_BLUE,
      color: '#fff',
      fontSize: 30,
      lineHeight: 1.33,
      padding: isMobileVersion ? '40px 30px' : 65,
      textAlign: 'center',
    }
    const buttonStyle = {
      ':hover': {
        backgroundColor: Colors.SKY_BLUE,
      },
      backgroundColor: Colors.SKY_BLUE_HOVER,
      fontSize: 15,
      letterSpacing: 1,
      marginTop: 30,
      padding: '18px 28px 12px',
      textTransform: 'uppercase',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: 450}}>
        Basez vous sur nos données pour prendre
        <strong style={{fontStyle: 'italic'}}> les bonnes décisions</strong>
      </div>
      <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="bigdata">
        Commencer
      </LoginButton>
    </section>
  }
}


class BetaSection extends React.Component {
  render() {
    const style = {
      backgroundColor: Colors.CHARCOAL_GREY,
      color: Colors.PINKISH_GREY,
      fontSize: 22,
      lineHeight: 1.36,
      margin: 'auto',
      padding: '45px 20px',
      textAlign: 'center',
    }
    const emStyle = {
      color: '#fff',
      fontWeight: 500,
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      marginTop: 25,
      padding: '16px 28px 12px',
      textTransform: 'uppercase',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: 820}}>
        {config.productName} est actuellement en version Bêta,<br />
        mais vous permet déjà d'<em style={emStyle}>accélérer votre recherche</em>
      </div>
      <LoginButton style={buttonStyle} isSignUpButton={true} visualElement="beta">
        Commencer
      </LoginButton>
    </section>
  }
}


class TestimonialCard extends React.Component {
  static propTypes = {
    author: React.PropTypes.string.isRequired,
    children: React.PropTypes.node,
    style: React.PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {author, children} = this.props
    const {isMobileVersion} = this.context
    const style = {
      color: Colors.DARK_TWO,
      fontSize: 18,
      fontStyle: 'italic',
      lineHeight: 1.44,
      maxWidth: 500,
      padding: isMobileVersion ? '30px 30px' : '30px 50px 0',
      position: 'relative',
      ...this.props.style,
    }
    const quoteStyle = {
      color: Colors.MODAL_PROJECT_GREY,
      fontSize: 120,
      left: isMobileVersion ? -12 : -15,
      position: 'absolute',
      top: isMobileVersion ? -40 : -30,
    }
    const authorStyle = {
      fontSize: 14,
      fontStyle: 'initial',
      fontWeight: 500,
      marginTop: 15,
    }
    return <div style={style}>
      <div style={quoteStyle}>“</div>
      {children}
      <div style={authorStyle}>{author}</div>
    </div>
  }
}


const testimonialCards = [
  <TestimonialCard author="Jean, 45 ans" style={{margin: 'auto'}}>
    Merci ! Grâce aux conseils simples mais avisés de votre site j'ai
    rapidement été contacté par un recruteur.
  </TestimonialCard>,
  <TestimonialCard author="Laurie, 36 ans" style={{margin: 'auto'}}>
    J'ai été bluffée par la pertinence du plan d'action proposé.
  </TestimonialCard>,
  <TestimonialCard author="Sofiane, 27 ans" style={{margin: 'auto'}}>
    Organisation, soutien, motivation, Bob Emploi m'a aidée à savoir quoi faire
    et comment.
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
    const style = {
      height: isMobileVersion ? 180 : 180,
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
    imageName: 'ple-emploi-ico.png',
    name: 'Pôle Emploi',
  },
  {
    imageName: 'francengage-ico.png',
    name: "La France s'engage",
  },
  {
    imageName: 'snc-ico.png',
    name: 'Solidarités nouvelles contre le chômage',
  },
  {
    imageName: 'rco-ico.png',
    name: 'Réseau des CARIF-OREF',
  },
  {
    imageName: 'echappee-ico.png',
    name: "L'Échappée Volée",
  },
  {
    imageName: 'etalab-ico.png',
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
    return <section style={style}>
      <div style={sectionTitleStyle(isMobileVersion)}>
        Nos partenaires
      </div>
      <div style={partnerBoxStyle}>
        {partnersContent.map(partner => {
          return <PartnerCard
              name={partner.name} key={partner.name}
              imageName={partner.imageName} />
        })}
      </div>
    </section>
  }
}


class PartnerCard extends React.Component {
  static propTypes = {
    imageName: React.PropTypes.string.isRequired,
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
    const {imageName, name} = this.props
    return <div style={containerStyle}>
      <div style={imageContainerStyle}>
        <img src={require(`images/${imageName}`)} alt={name} title={name} />
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
    const isLandingPageForCoaching = /coach/.test(query['utm_content'] || '')
    const isLandingPageForEase = /ease|simplicity/.test(query['utm_content'] || '')
    this.setState({landingPageKind:
      isLandingPageForCoaching ? 'coach' :
        isLandingPageForEase ? 'ease' : ''})
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

      <DescriptionSection />

      <TestimonialsSection />

      <BigDataForYouSection />

      <PartnersSection />

      <BetaSection />
    </StaticPage>
  }
}

export {LandingPage}
