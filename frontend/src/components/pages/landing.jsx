import React from 'react'
import {browserHistory} from 'react-router'
import {ShortKey} from 'components/shortkey'

import config from 'config'
import {StaticPage} from 'components/static'
import {Routes} from 'components/url'
import {Colors, Icon, RoundButton, Styles} from 'components/theme'
import {openLoginModal, loadLandingPageAction} from 'store/actions'
import {LoginButton} from 'components/login'


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

  render() {
    const style = {
      alignItems: 'flex-start',
      color: Colors.SLATE,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 40,
      justifyContent: 'center',
      lineHeight: 1.15,
      margin: '0 auto',
      width: 1200,
      ...this.props.style,
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      marginRight: 15,
      padding: '16px 28px 12px',
      textTransform: 'uppercase',
    }
    return <section style={style}>
      <div style={{maxWidth: 900, padding: '0 100px'}}>
        <img src={require('images/logo-bob-emploi.svg')} alt={config.productName} />
        <div style={{marginBottom: 18, marginTop: 30}}>
          Un accompagnement au quotidien pour booster votre recherche d'emploi
        </div>
        <LoginButton style={buttonStyle} isSignUpButton={true}>
          S'inscrire
        </LoginButton>
        <RoundButton
            type="back" style={buttonStyle}
            onClick={() => browserHistory.push(Routes.CONTRIBUTION_PAGE)}>
          Contribuer
        </RoundButton>
      </div>
    </section>
  }
}


class MobileTitleSection extends React.Component {
  render() {
    const style = {
      alignItems: 'center',
      color: Colors.SLATE,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 40,
      height: 464,
      lineHeight: 1.15,
      padding: '0 20px',
      textAlign: 'center',
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      padding: '18px 28px 12px',
      textTransform: 'uppercase',
    }
    return <section style={style}>
      <div style={{alignItems: 'center', display: 'flex', flex: 1}}>
        <div>
          Boostez votre recherche d'emploi
        </div>
      </div>
      <LoginButton style={buttonStyle}>
        Commencer
      </LoginButton>
      <Icon name="chevron-double-down" style={{padding: 20}} />
    </section>
  }
}


class DescriptionSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '45px 30px 0' : '90px 100px 0',
    }
    const buttonContainerStyle = {
      ...style,
      flexDirection: 'row-reverse',
      padding: isMobileVersion ? '30px 30px 70px' : '75px 100px 100px',
    }
    const leftTextStyle = {
      ...sectionTitleStyle(isMobileVersion),
      flex: 1,
      paddingBottom: 40,
      paddingRight: 20,
    }
    const rightTextStyle = {
      color: Colors.CHARCOAL_GREY,
      flex: 2,
      fontSize: 16,
      lineHeight: 1.63,
    }
    const chevronInButtonStyle = {
      fontSize: 24,
      paddingBottom: 2,
      verticalAlign: 'middle',
    }
    return <section>
      <div style={style}>
        <div style={leftTextStyle}>
          Indépendant,<br />
          Non-lucratif,<br />
          Ouvert.
        </div>

        <div style={rightTextStyle}>
          Bob Emploi est une plate-forme indépendante construite par
          l'<strong>ONG Bayes Impact</strong>. Nous sommes une petite équipe dont
          la raison d'être est d'utiliser le pouvoir de la technologie pour le
          bien commun.

          {isMobileVersion ? null : <span>
            <br /><br />

            Nous avons créé Bob Emploi car nous sommes convaincus que la big
            data <strong>peut donner à chaque individu le pouvoir de prendre
            pleinement en main sa recherche d'emploi</strong>. Notre vision à
            travers cette plate-forme est de créer un <strong>véritable service
            public citoyen</strong> : une plate-forme indépendante, gratuite, et en
            constante amélioration, construite par les citoyens pour les citoyens.
          </span>}
        </div>
      </div>

      <div style={buttonContainerStyle}>
        <RoundButton
            style={{fontSize: 17, padding: '10px 12px 8px 39px'}}
            onClick={() => browserHistory.push(Routes.VISION_PAGE)}>
          <span style={{paddingRight: '1em'}}>
            Notre mission
          </span>
          <Icon name="chevron-right" style={chevronInButtonStyle} />
        </RoundButton>
      </div>
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
      fontSize: 19,
      lineHeight: 1.37,
      padding: isMobileVersion ? '40px 30px' : 65,
      textAlign: 'center',
    }
    const titleStyle = {
      fontSize: isMobileVersion ? 26 : 30,
      fontWeight: 'bold',
      lineHeight: 1.33,
      marginBottom: 12,
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 820,
    }
    return <section style={style}>
      <div style={titleStyle}>
        Et si on donnait à chacun le pouvoir de s'appuyer sur l'expérience
        combinée de tous les chercheurs d'emploi&nbsp;?
      </div>

      {isMobileVersion ? null : <div style={{margin: 'auto', maxWidth: 720}}>
        Notre algorithme analyse des données du marché du travail ainsi que des
        millions de parcours de recherche d'emploi afin de permettre à chacun
        de bénéficier des bons conseils au bon moment de façon personnalisée.
      </div>}
    </section>
  }
}


const screenshotsContent = [
  {
    description: 'Nous croisons votre profil avec le marché du travail pour vous aider ' +
      "à identifier comment booster votre recherche d'emploi.",
    imageName: 'screenshot-1.jpg',
    title: "1. Obtenez un plan d'action sur mesure",
  },
  {
    description: 'Tous les jours nous vous proposerons des actions concrètes pour ' +
        'avancer sur votre plan.',
    imageName: 'screenshot-2.jpg',
    title: '2. Recevez de nouveaux conseils chaque jour',
  },
  {
    description: 'Notre algorithme apprend à votre contact. En interagissant avec ' +
      "l'application vous améliorez la pertinence des recommandations qui vous seront faites.",
    imageName: 'screenshot-3.jpg',
    title: <span>3. Découvrez de nouveaux métiers à votre image&nbsp;!</span>,
  },
]

const SCREENSHOT_INTERVAL = 8000


class ScreenshotsSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: '#fff',
      margin: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '45px 30px 20px' : '70px 100px 30px',
    }
    const headerStyle = {
      ...sectionTitleStyle(isMobileVersion),
      marginBottom: 100,
      maxWidth: 400,
    }
    return <section style={style}>
      <header style={headerStyle}>
        Une solution simple, rapide et gratuite&nbsp;!
      </header>

      {isMobileVersion ? <ScreenshotList /> : <ScreenshotCarousel />}
    </section>
  }
}


class ScreenshotList extends React.Component {

  render() {
    const imageStyle = {
      boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.3)',
      marginBottom: 32,
      width: '100%',
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {screenshotsContent.map((screenshot, i) => {
        return <div style={Styles.CENTERED_COLUMN} key={i}>
          <img
              style={imageStyle}
              src={require(`images/${screenshot.imageName}`)} />
          <ScreenshotTextbox title={screenshot.title} description={screenshot.description} />
        </div>
      })}
    </div>
  }
}


class ScreenshotCarousel extends React.Component {

  state = {
    selectedIndex: 0,
  }

  componentDidMount() {
    this.setScreenshot(0)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  setScreenshot = (index, isStatic) => {
    this.setState({selectedIndex: index})
    if (isStatic) {
      clearTimeout(this.timeout)
      return
    }
    const nextIndex = (this.state.selectedIndex + 1) % screenshotsContent.length
    this.timeout = setTimeout(() => this.setScreenshot(nextIndex), SCREENSHOT_INTERVAL)
  }

  render() {
    const {selectedIndex} = this.state
    const imageStyle = {
      alignSelf: 'center',
      boxShadow: '0 4px 25px 0 rgba(0, 0, 0, 0.15)',
      marginLeft: 100,
    }
    return <div style={{display: 'flex'}}>
      <div style={{width: 400}}>
        {screenshotsContent.map((screenshot, i) => {
          return <ScreenshotTextbox
              isGrayedOut={i !== selectedIndex} key={i}
              title={screenshot.title} description={screenshot.description}
              onMouseOver={() => this.setScreenshot(i, true)}
              onMouseOut={() => this.setScreenshot(i, false)} />
        })}
      </div>
      {/* TODO(pascal): Style image to let it extent over the padding on the right */}
      <img
          style={imageStyle}
          src={require(`images/${screenshotsContent[selectedIndex].imageName}`)} />
    </div>
  }
}


class ScreenshotTextbox extends React.Component {
  static propTypes = {
    description: React.PropTypes.string.isRequired,
    isGrayedOut: React.PropTypes.bool,
    title: React.PropTypes.node.isRequired,
  }

  render() {
    const {description, isGrayedOut, title, ...otherProps} = this.props
    const boxStyle = {
      color: isGrayedOut ? Colors.COOL_GREY : Colors.DARK_TWO,
      cursor: 'pointer',
      fontSize: 16,
    }

    return <div {...otherProps} style={boxStyle}>
      <div><strong>{title}</strong></div>
      <div style={{lineHeight: 1.6, marginBottom: 50, marginTop: 16}}>
        {description}
      </div>
    </div>
  }
}


class BetaSection extends React.Component {
  render() {
    const style = {
      backgroundColor: Colors.SLATE,
      color: '#fff',
      fontSize: 22,
      lineHeight: 1.36,
      margin: 'auto',
      maxWidth: 1200,
      padding: '30px 20px',
      textAlign: 'center',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: 820}}>
        {config.productName} est actuellement en <strong>version bêta</strong>.<br />
        Ce qui veut dire que certaines fonctionnalités ne sont <strong>pas encore
        disponibles</strong> ou vont <strong>évoluer</strong> dans les prochaines
        semaines et que tout n'est pas parfait.
      </div>
    </section>
  }
}


class ContributeSection extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const sectionStyle = {
      backgroundColor: '#fff',
      margin: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '60px 30px' : '70px 100px 30px',

    }
    const style = {
      border: 'solid 1px ' + Colors.SILVER,
      borderRadius: 5,
      color: Colors.DARK_TWO,
      fontSize: isMobileVersion ? 15 : 16,
      lineHeight: 1.63,
      marginBottom: isMobileVersion ? 0 : 70,
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: isMobileVersion ? 20 : 30,
      padding: isMobileVersion ? 20 : 50,
      textAlign: 'center',
      ...this.props.style,
    }
    const headerStyle = {
      fontSize: 18,
      fontWeight: 'bold',
    }
    return <section style={sectionStyle}>
      <div style={style}>
        <header style={headerStyle}>Aidez la communauté&nbsp;!</header>
        <div style={{margin: 'auto', maxWidth: 780, padding: isMobileVersion ? '20px 0' : 30}}>
          En utilisant l'application vous améliorez la pertinence des
          recommandations qui vous seront faites, mais aussi pour tous les
          chercheurs d'emploi qui passeront après vous&nbsp;! Vous pouvez
          également proposer directement vos astuces et conseils.
        </div>
        <RoundButton
            style={{fontSize: 17}}
            onClick={() => browserHistory.push(Routes.CONTRIBUTION_PAGE)}>
          Contribuer
        </RoundButton>
      </div>
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
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 18,
      height: isMobileVersion ? 'initial' : 200,
      justifyContent: 'center',
      lineHeight: 1.44,
      maxWidth: 500,
      padding: isMobileVersion ? '30px 20px' : '0 50px',
      position: 'relative',
      ...this.props.style,
    }
    const quoteStyle = {
      color: Colors.SILVER,
      fontSize: 60,
      left: isMobileVersion ? 10 : 0,
      position: 'absolute',
      top: isMobileVersion ? 0 : 30,
    }
    const authorStyle = {
      bottom: isMobileVersion ? 10 : 25,
      fontSize: 14,
      fontWeight: 'bold',
      position: 'absolute',
      right: isMobileVersion ? 20 : 50,
    }
    return <div style={style}>
      <div style={quoteStyle}>“</div>
      {children}
      <div style={authorStyle}>{author}</div>
    </div>
  }
}


class TestimonialsSection extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      backgroundColor: '#fff',
      margin: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '45px 30px' : 100,
    }
    // TODO(pascal): Add a carousel to show more than one testimonial.
    return <section style={style}>
      <div style={sectionTitleStyle(isMobileVersion)}>
        Ils témoignent
      </div>
      <TestimonialCard author="Flamine, 30 ans" style={{margin: 'auto'}}>
        La force de cet outil c'est d'aider à remettre le pied à l'étrier.
        On se sent parfois un peu perdu dans sa recherche d'emploi mais là
        on est vraiment guidé et accompagné. C'est un super atout.
      </TestimonialCard>
      <TestimonialCard author="Jean, 43 ans" style={{margin: 'auto'}}>
        Avec cette application j'ai enfin eu l'impression d'être en contrôle de
        ma situation, et non un simple numéro.
      </TestimonialCard>
    </section>
  }
}


const partnersContent = [
  {
    description: 'Mise à disposition de leurs ressources dans la construction du projet',
    imageName: 'ple-emploi-ico.png',
    name: 'Pôle Emploi',
  },
  {
    description: "Label présidentiel \"projet d'innovation sociale\"",
    imageName: 'francengage-ico.png',
    name: "La France s'engage",
  },
  {
    description: 'Mise à disposition de volontaires et bénéficiaires pour des tests utilisateurs',
    imageName: 'snc-ico.png',
    name: 'Solidarités nouvelles contre le chômage',
  },
  {
    description: 'Mise à disposition de données de formation',
    imageName: 'rco-ico.png',
    name: 'Réseau des CARIF-OREF',
  },
  {
    description: "Soutien de la communauté de l'Échappée Volée",
    imageName: 'echappee-ico.png',
    name: "L'Échappée Volée",
  },
  {
    description: 'Co-développement de certaines fonctionnalités',
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
      padding: isMobileVersion ? '45px 30px' : '70px 100px',
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
              description={partner.description}
              imageName={partner.imageName} />
        })}
      </div>
    </section>
  }
}


class PartnerCard extends React.Component {
  static propTypes = {
    description: React.PropTypes.string.isRequired,
    imageName: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
  };
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
      width: 300,
    }
    const textContainerStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 16,
      lineHeight: 1.6,
      marginBottom: this.context.isMobileVersion ? 50 : 100,
      marginTop: 32,
      textAlign: 'center',
    }
    const {description, imageName, name} = this.props
    return <div style={containerStyle}>
      <div style={imageContainerStyle}>
        <img src={require(`images/${imageName}`)} />
      </div>
      <div style={textContainerStyle}>
        <div style={{fontWeight: 'bold'}}>{name}</div>
        <div>{description}</div>
      </div>
    </div>
  }
}


class LandingPage extends React.Component {
  static propTypes = {
    app: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
  }

  static childContextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  getChildContext() {
    const {isMobileVersion} = this.props.app
    return {isMobileVersion}
  }

  componentWillMount() {
    if (this.props.app.isMobileVersion) {
      document.getElementById('viewport').setAttribute('content', 'width=320')
    }
  }

  componentDidMount() {
    this.props.dispatch(loadLandingPageAction)
  }

  handleOpenLoginModal = () => {
    this.props.dispatch(openLoginModal())
  }

  render() {
    const {isMobileVersion} = this.props.app
    return <StaticPage page="landing">
      <ShortKey
          keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.handleOpenLoginModal} />

      {isMobileVersion ?
        <MobileTitleSection dispatch={this.props.dispatch} /> :
        <TitleSection style={{height: 535}} dispatch={this.props.dispatch} />}

      <DescriptionSection />

      <BigDataForYouSection />

      <ScreenshotsSection />

      <ContributeSection />

      <BetaSection />

      <TestimonialsSection />

      <PartnersSection />
    </StaticPage>
  }
}

export {LandingPage}
