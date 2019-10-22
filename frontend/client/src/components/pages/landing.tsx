import _memoize from 'lodash/memoize'
import ArrowRightThickIcon from 'mdi-react/ArrowRightThickIcon'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import LazyLoad from 'react-lazyload'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Link} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import {Swipeable} from 'react-swipeable'
import {TwitterTweetEmbed} from 'react-twitter-embed'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, landingPageSectionIsShown,
  loadLandingPage} from 'store/actions'

import bobBlueImage from 'images/bob-logo.svg?fill=#1888ff' // colors.BOB_BLUE
import step1Image from 'images/step-1.svg'
import step2Image from 'images/step-2.svg'
import step3Image from 'images/step-3.svg'
import franceEngageImage from 'images/francengage-ico.png'
import frenchImpactImage from 'images/french-impact-logo.png'
import googleOrgImage from 'images/google-org-ico.svg'
import poleEmploiImage from 'images/ple-emploi-ico.png'
import pressConsolabImage from 'images/press/consolab.png'
import pressEchoStartImage from 'images/press/echos.png'
import pressEurope1Image from 'images/press/europe1.png'
import pressFemmeActuelleImage from 'images/press/femme-actuelle.png'
import pressFranceInfoImage from 'images/press/franceinfo.png'
import pressLetudiantImage from 'images/press/letudiant.png'
import pressNouvelleVieImage from 'images/press/nouvellevie.png'
import pressPositivrImage from 'images/press/positivr.png'
import sncImage from 'images/snc-ico.png'

import {CookieMessageOverlay} from 'components/cookie_message'
import {LoginButton, LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {StaticPage, TitleSection} from 'components/static'
import {fetchFirstSuggestedJob} from 'components/suggestions'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import {Button, CarouselArrow, ExternalLink, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  SmoothTransitions, colorToAlpha} from 'components/theme'
import {Routes} from 'components/url'


const emStyle: React.CSSProperties = {
  color: '#fff',
}


interface LandingPageContent {
  fontSize?: number
  match?: RegExp
  subtitle?: string
  title?: React.ReactNode
}


// Kinds of different landing page excluding the default kind.
const landingPageContentsRaw = {
  '': {
    fontSize: 42,
    match: /evaluation/,
    title: <span style={emStyle}>
      Évaluez votre recherche d'emploi en 10 minutes
    </span>,
  },
  coach: {
    match: /coach/,
    title: <span>
      Un <em style={emStyle}>plan d'accompagnement</em> sur-mesure pour
      <em style={emStyle}> accélérer</em> votre recherche d'emploi
    </span>,
  },
  'deploy-opportunities': {
    fontSize: 42,
    match: /deploy/,
    title: <span style={emStyle}>Déployons vos opportunités d'embauche</span>,
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
      un emploi</span>&nbsp;?
    </span>,
  },
  prioritization: {
    match: /prioritization/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui est vraiment important',
    title: <span>
      Que faire en <span style={emStyle}>priorité</span> pour <span
        style={emStyle}>trouver un emploi</span>&nbsp;?
    </span>,
  },
  'quick-diagnostic': {
    match: /quick-diagnostic/,
    title: "Évaluez votre recherche d'emploi en 10 minutes",
  },
  'rethink-search': {
    fontSize: 42,
    match: /rethink/,
    title: <span style={emStyle}>
      Repensons votre recherche d'emploi
    </span>,
  },
  'specific-job': {
    fontSize: 42,
    // 'title' is created and populated dynamically using the job name.
  },
  speed: {
    match: /speed/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui marche vraiment',
    title: <span>
      Quelle est <span style={emStyle}>la clé</span> pour <span
        style={emStyle}>trouver rapidement un emploi</span>&nbsp;?
    </span>,
  },
} as const
type LandingPageKind = keyof typeof landingPageContentsRaw
const kinds = Object.keys(landingPageContentsRaw) as LandingPageKind[]
const landingPageContents =
  landingPageContentsRaw as {readonly [P in LandingPageKind]: LandingPageContent}



const subtitleStyle: React.CSSProperties = {
  color: colors.SLATE,
  fontSize: 20,
  fontWeight: 'normal',
  textAlign: 'center',
}


class DiagnosticSection extends React.PureComponent<{children?: never}> {
  public render(): React.ReactNode {
    const style: React.CSSProperties = {
      backgroundColor: '#fff',
      fontSize: 16,
      lineHeight: 1.69,
      minHeight: 365,
      padding: isMobileVersion ? '50px 30px' : '100px 0',
      textAlign: 'center',
    }
    const headerStyle: React.CSSProperties = {
      fontSize: isMobileVersion ? 28 : 33,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 15,
      marginTop: 0,
    }
    const layoutStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
    }
    const cardStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: 10,
      boxShadow: '0 10px 30px 0 rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      height: 390,
      justifyContent: 'space-between',
      lineHeight: 1,
      margin: '0 15px',
      padding: 40,
      position: 'relative',
      width: 290,
    }
    const buttonStyle: React.CSSProperties = {
      fontSize: 15,
      padding: '15px 28px',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
        <h2 style={headerStyle}>
          Découvrez dès à présent <span style={{color: colors.BOB_BLUE}}>votre diagnostic</span>
        </h2>
        <div style={{...subtitleStyle, marginBottom: 35}}>
          Construit sur mesure et adapté pour vous&nbsp;!
        </div>
        <div style={layoutStyle}>
          {isMobileVersion ? null : <div style={{...cardStyle, height: 360, width: 260}}>
            <div>
              <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 6}}>
                Votre profil
              </div>
              <div>d'infirmier à Lille</div>
            </div>
            <svg
              fill="none" viewBox="-4 -4 93 93"
              style={{margin: '20px auto 30px', width: 97}}>
              <circle
                cx="42.154" cy="42.14" r="41.95" stroke={colors.GREENISH_TEAL}
                strokeOpacity=".2" strokeWidth="4" />
              <path
                stroke={colors.GREENISH_TEAL} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="8" d="M3.345 26.184A41.827 41.827 0 0 0 .204 42.14c0 23.168 18.781
                41.95 41.95 41.95 23.168 0 41.95-18.782 41.95-41.95C84.104 18.97 65.322.19
                42.154.19" />
              <text fill={colors.DARK_TWO} fontSize="22" fontWeight="600">
                <tspan x="20.297" y="50.716">81%</tspan>
              </text>
            </svg>
            <div>
              Votre profil est pertinent et répond aux attentes du marché.
            </div>
            <div style={{color: colors.BOB_BLUE, fontSize: 14}}>
              3 solutions à découvrir
            </div>
            <div style={{
              background: 'linear-gradient(to left, rgba(255, 255, 255, 0), #fff)',
              bottom: -40,
              left: -30,
              position: 'absolute',
              top: -40,
              width: 160,
            }} />
          </div>}
          <div style={cardStyle}>
            <div style={{fontSize: 20, fontWeight: 'bold'}}>
              Hélène vous avez un profil idéal&nbsp;!
            </div>
            <svg
              fill="none" style={{display: 'block', margin: '36px auto', width: 142}}
              viewBox="0 0 142 101">
              <path
                stroke={colors.RED_PINK} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="9.244"
                d="M7.997 50.462a66.074 66.074 0 0 0-3.19 20.346c0 8.962 1.783 17.507 5.014 25.3" />
              <path
                stroke={colors.SQUASH} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="9.244"
                d="M70.877 4.712c-19.833 0-37.626 8.743-49.736 22.586
                  a66.283 66.283 0 0 0-7.673 10.772" />
              <path
                stroke={colors.GREENISH_TEAL} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="9.244"
                d="M131.934 96.108c3.23-7.793 5.013-16.338 5.013-25.3 0-29.785-19.694-54.969
                  -46.765-63.23a65.563 65.563 0 0 0-5.288-1.376" />
              <g transform="translate(4.808 4.712)">
                <circle fill="#fff" cx="113.864" cy="19.748" r="11.344" />
                <circle
                  cx="113.864" cy="19.748" r="7.61" stroke={colors.GREENISH_TEAL}
                  strokeWidth="7.47" />
                <text fill={colors.DARK_TWO} fontSize="33" fontWeight="bold">
                  <tspan x="30.638" y="65.336">70%</tspan>
                </text>
              </g>
            </svg>
            <div>
              Vous avez toutes les qualités pour ce poste.<br /><br />
              Même si <strong>la concurrence est forte</strong>, ne vous laissez pas abattre nous
              avons des solutions pour vous&nbsp;!
            </div>
          </div>
          {isMobileVersion ? null : <div style={{...cardStyle, height: 360, width: 260}}>
            <div>
              <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 6}}>
                Votre projet
              </div>
              <div>de boulangère à Rennes</div>
            </div>
            <svg
              fill="none" viewBox="-4 -4 93 93"
              style={{margin: '20px auto 30px', width: 97}}>
              <circle
                cx="42.154" cy="42.14" r="41.95" stroke={colors.GREENISH_TEAL}
                strokeOpacity=".2" strokeWidth="4" />
              <path
                stroke={colors.GREENISH_TEAL} strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="8" d="M11.143 70.392c7.672 8.416 18.725 13.698 31.01 13.698 23.17 0
                  41.951-18.782 41.951-41.95C84.104 18.97 65.322.19 42.154.19" />
              <text
                fill={colors.DARK_TWO} fontSize="22" fontWeight="600">
                <tspan x="20.297" y="50.716">65%</tspan>
              </text>
            </svg>
            <div>
              Votre projet est réalisable. Vous avez une bonne carte à jouer.
            </div>
            <div style={{color: colors.BOB_BLUE, fontSize: 14}}>
              5 solutions à découvrir
            </div>
            <div style={{
              background: 'linear-gradient(to right, rgba(255, 255, 255, 0), #fff)',
              bottom: -40,
              position: 'absolute',
              right: -30,
              top: -40,
              width: 160,
            }} />
          </div>}
        </div>
        <div style={{
          backgroundColor: colors.BACKGROUND_GREY,
          borderRadius: 1,
          height: 2,
          margin: '45px auto',
          width: isMobileVersion ? 100 : 300,
        }} />
        <div>
          <LoginLink isSignUp={true} visualElement="diagnostic">
            <Button style={buttonStyle} type="validation">
              Commencez maintenant&nbsp;!
            </Button>
          </LoginLink>
        </div>
      </div>
    </section>
  }
}


class StepsSection extends React.PureComponent<{children?: never}> {
  private renderStep(content: React.ReactNode, image: string): React.ReactNode {
    return <div style={{maxWidth: 300, textAlign: 'center'}}>
      <img src={image} alt="" /><br />
      {content}
    </div>
  }

  public render(): React.ReactNode {
    const style: React.CSSProperties = {
      backgroundColor: '#fff',
      color: colors.SLATE,
      fontSize: 16,
      lineHeight: 1.69,
      minHeight: 365,
      padding: isMobileVersion ? '50px 0' : '100px 0',
      textAlign: 'center',
    }
    const headerStyle: React.CSSProperties = {
      color: colors.DARK_TWO,
      fontSize: isMobileVersion ? 28 : 33,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 15,
      marginTop: 0,
    }
    const layoutStyle: React.CSSProperties = isMobileVersion ? {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
    } : {
      display: 'flex',
      justifyContent: 'space-between',
    }
    const emStyle: React.CSSProperties = {
      backgroundColor: colorToAlpha(colors.BOB_BLUE, .1),
      color: colors.BOB_BLUE,
      fontStyle: 'normal',
    }
    return <section style={style}>
      <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
        <h2 style={headerStyle}>
          C'est gratuit et ça ne prend que <span style={{color: colors.BOB_BLUE}}>10 minutes</span>
        </h2>
        <div style={{fontSize: 20, marginBottom: 35}}>
          Trois étapes pour tout changer !
        </div>
        <div style={layoutStyle}>
          {this.renderStep(
            <h3 style={{fontSize: 'inherit', fontWeight: 'inherit', margin: 0}}>
              <strong>Analysez</strong> votre situation grâce à un diagnostic détaillé
              basé sur <em style={emStyle}>votre profil</em> et sur les données du marché.
            </h3>,
            step1Image)}
          {this.renderStep(
            <h3 style={{fontSize: 'inherit', fontWeight: 'inherit', margin: 0}}>
              <strong>Explorez</strong> une multitude de pistes pour mettre en avant vos atouts
              et faire de vos points faibles <em style={emStyle}>vos forces</em>.
            </h3>,
            step2Image)}
          {this.renderStep(
            <h3 style={{fontSize: 'inherit', fontWeight: 'inherit', margin: 0}}>
              <strong>Avancez</strong> avec {config.productName}. Vous n'êtes pas
              seul, {config.productName} vous accompagne pour travailler sur
              les pistes que <em style={emStyle}>vous avez choisies</em>.
            </h3>,
            step3Image)}
        </div>
        <div style={{marginTop: 25}}>
          <ArrowLink to={Routes.VISION_PAGE}>
            Découvrir notre mission
          </ArrowLink>
        </div>
      </div>
    </section>
  }
}


class TestimonialsSection extends React.PureComponent<{children?: never}> {
  public render(): React.ReactNode {
    const sectionStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      padding: isMobileVersion ? '20px 30px' : '20px 0',
      position: 'relative',
    }
    const headerStyle: React.CSSProperties = {
      fontSize: isMobileVersion ? 28 : 30,
      fontWeight: 'bold',
      marginTop: 0,
      padding: isMobileVersion ? '0 0 30px' : '70px 100px 0',
      textAlign: 'center',
    }
    const subHeaderStyle: React.CSSProperties = {
      fontSize: 16,
      lineHeight: '26px',
      margin: '20px 0 50px',
      textAlign: 'center',
    }
    return <section style={sectionStyle}>
      <h2 style={headerStyle}>
        Ils ont essayé et ça marche
      </h2>
      <div style={subHeaderStyle}>
        Déjà plus de <strong style={{fontSize: 23}}>130 000 personnes</strong> ont
        été aidées avec {config.productName}
      </div>
      <Testimonials>
        <TestimonialCard author={{age: 45, isMan: true, name: 'Jean'}}>
          Merci ! Grâce aux conseils simples mais avisés de votre site j'ai
          rapidement été contacté par un recruteur.
        </TestimonialCard>
        <TestimonialCard author={{age: 36, name: 'Laurie'}}>
          J'ai été bluffée par la pertinence du plan d'action proposé.
        </TestimonialCard>
        <TestimonialCard author={{age: 27, name: 'Sofiane'}}>
          Organisation, soutien, motivation, {config.productName} m'a aidée à savoir
          quoi faire et comment.
        </TestimonialCard>
      </Testimonials>
      <div style={{padding: '35px 0 50px', textAlign: 'center'}}>
        <LoginButton isSignUp={true} visualElement="testimonials" type="validation">
          Commencez maintenant&nbsp;!
        </LoginButton>
      </div>
    </section>
  }
}


const partnersContent = [
  {
    imageSrc: poleEmploiImage,
    name: 'Pôle emploi',
  },
  {
    imageSrc: googleOrgImage,
    name: 'Fondation Google.org',
  },
  {
    imageSrc: franceEngageImage,
    name: "La France s'engage",
  },
  {
    imageSrc: frenchImpactImage,
    name: '#French IMPACT',
  },
  {
    imageSrc: sncImage,
    name: 'Solidarités nouvelles contre le chômage',
  },
]


class PartnersSubSection extends React.PureComponent<{chidren?: never}> {
  public render(): React.ReactNode {
    const style: React.CSSProperties = {
      margin: 'auto',
      maxWidth: 1200,
      padding: isMobileVersion ? '45px 30px 30px' : '70px 100px 55px',
    }
    const partnerBoxStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      marginTop: 50,
    }
    return <section style={{backgroundColor: '#fff'}}>
      <div style={style}>
        <h3 style={subtitleStyle}>
          avec le soutien de
        </h3>
        <div style={partnerBoxStyle}>
          {partnersContent.map((partner): React.ReactNode => {
            return <PartnerCard
              name={partner.name} key={partner.name}
              imageSrc={partner.imageSrc} />
          })}
        </div>
      </div>
    </section>
  }
}


interface PartnerProps {
  children?: never
  imageSrc: string
  name: string
}


class PartnerCard extends React.PureComponent<PartnerProps> {
  public static propTypes = {
    imageSrc: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      height: 60,
      marginBottom: 45,
    }
    const imageContainerStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      height: 100,
      justifyContent: 'center',
      width: 200,
    }
    const {imageSrc, name} = this.props
    return <div style={containerStyle}>
      <div style={imageContainerStyle}>
        <LazyLoad height={60} once={true} offset={200}>
          <img src={imageSrc} alt={name} title={name} style={{height: 60, maxWidth: 180}} />
        </LazyLoad>
      </div>
    </div>
  }
}


interface SpeakingAboutBobProps {
  carouselAutoRotationDurationMs?: number
  children?: never
}


interface SpeakingAboutBobState {
  skipPress: number
  skipTweet: number
}


class SpeakingAboutBobSection
  extends React.PureComponent<SpeakingAboutBobProps, SpeakingAboutBobState> {
  public static propTypes = {
    carouselAutoRotationDurationMs: PropTypes.number.isRequired,
  }

  public static defaultProps = {
    carouselAutoRotationDurationMs: 8000,
  }

  private static mediaLinkWidth = isMobileVersion ? 280 : 320

  private static mediaLinkMargin = 20

  private static pressArticles = [
    {
      imageAltText: 'PositivR',
      imageSrc: pressPositivrImage,
      title: "Développer le conseil à l'emploi grâce aux nouvelles technologies, avec Bob Emploi.",
      url: 'https://positivr.fr/humain-et-ia-bob-emploi-positiveimpact/',
    },
    {
      imageAltText: 'Les Échos Start',
      imageSrc: pressEchoStartImage,
      title: "Bob Emploi, l'algorithme qui s'attaque au chômage",
      url: 'https://start.lesechos.fr/entreprendre/actu-startup/bob-emploi-l-algorithme-qui-s-attaque-au-chomage-12226.php',
    },
    {
      imageAltText: 'Europe 1',
      imageSrc: pressEurope1Image,
      title: 'Cinq choses à savoir sur Bob Emploi, le site qui veut enrayer le chômage',
      url: 'http://www.europe1.fr/economie/cinq-choses-a-savoir-sur-bob-emploi-le-site-qui-veut-enrayer-le-chomage-2901977 ',
    },
    {
      imageAltText: 'Nouvelle Vie Pro',
      imageSrc: pressNouvelleVieImage,
      title: "Bob Emploi\u00A0: besoin d'aide dans vos recherches\u00A0? Demandez Bob\u00A0!",
      url: 'https://www.nouvelleviepro.fr/actualite/587/bob-emploi-besoin-daide-dans-vos-recherches-demandez-bob',
    },
    {
      imageAltText: 'Femme Actuelle',
      imageSrc: pressFemmeActuelleImage,
      title: 'Quel site choisir pour trouver un emploi\u00A0?',
      url: 'https://www.femmeactuelle.fr/actu/vie-pratique/quel-site-choisir-pour-trouver-un-emploi-48341',
    },
    {
      imageAltText: 'France Info',
      imageSrc: pressFranceInfoImage,
      title: "VIDEO. Pour endiguer le chômage, il crée un site de recherche d'emplois personnalisé",
      url: 'https://www.francetvinfo.fr/economie/emploi/chomage/video-pour-endiguer-le-chomage-il-cree-un-site-de-recherche-demplois-personnalise_2801901.html',
    },
    {
      imageAltText: 'Conso Collaborative',
      imageSrc: pressConsolabImage,
      title: 'Big Data et bonnes volontés, la recette de Bob Emploi pour lutter ' +
        'contre le chômage',
      url: 'http://consocollaborative.com/article/big-data-et-bonnes-volontes-la-recette-de-bob-emploi-pour-lutter-contre-le-chomage/ ',
    },
    {
      imageAltText: "L'Étudiant",
      imageSrc: pressLetudiantImage,
      title: "Bob Emploi, la meilleure façon de démarrer ta recherche d'emploi",
      url: 'https://www.letudiant.fr/metiers/bob-emploi-la-meilleure-facon-de-demarrer-ta-recherche-d-emploi.html',
    },
  ]

  // The selected tweets URLs:
  // https://twitter.com/Placealemploi/status/1011164654582861824
  // https://twitter.com/PaulHank_PE/status/966984390076174336
  // https://twitter.com/ol_ga7/status/957209195971047424
  // https://twitter.com/PascLagarde/status/945950782695858176
  private static tweetIds = [
    '1011164654582861824', '966984390076174336', '957209195971047424', '945950782695858176']

  private static numMediaElementsShown = isMobileVersion ? 1 : 3

  private static numPressArticlesBullets = SpeakingAboutBobSection.getNumMediaBullets(
    SpeakingAboutBobSection.pressArticles)

  private static numTweetBullets = SpeakingAboutBobSection.getNumMediaBullets(
    SpeakingAboutBobSection.tweetIds)

  private static getNumMediaBullets(allMedia): number {
    return Math.round(
      (allMedia.length + SpeakingAboutBobSection.numMediaElementsShown - 1) /
      SpeakingAboutBobSection.numMediaElementsShown)
  }

  private static getSkipPixels = (skip): number => skip *
    (SpeakingAboutBobSection.mediaLinkWidth + SpeakingAboutBobSection.mediaLinkMargin) *
    SpeakingAboutBobSection.numMediaElementsShown


  public state = {
    skipPress: 0,
    skipTweet: 0,
  }

  public componentDidMount(): void {
    this.resetTweetRotationTimer()
  }

  public componentWillUnmount(): void {
    clearInterval(this.interval)
  }

  private interval: number|undefined

  private moveCarousel(): void {
    const {skipTweet} = this.state
    const delta = 1
    this.setState(
      {skipTweet: (skipTweet + delta) % SpeakingAboutBobSection.numTweetBullets})
  }

  private resetTweetRotationTimer(): void {
    const {carouselAutoRotationDurationMs} = this.props
    clearInterval(this.interval)
    this.interval = window.setInterval(
      (): void => this.moveCarousel(),
      carouselAutoRotationDurationMs)
  }

  private createPressSwipeHandler = (delta: number): (() => void) => (): void => {
    this.setState(({skipPress: value}): Pick<SpeakingAboutBobState, 'skipPress'> => ({
      skipPress: Math.max(
        Math.min(value + delta, SpeakingAboutBobSection.numPressArticlesBullets - 1),
        0,
      ),
    }))
  }

  private handleSkipPress = _memoize((skipPress): (() => void) =>
    (): void => this.setState({skipPress}))

  private handleSkipTweet = _memoize((skipTweet): (() => void) =>
    (): void => this.setState({skipTweet}))

  private renderPress({url, title, imageSrc, imageAltText}, index, allPress): React.ReactNode {
    const isLast = index === allPress.length - 1
    const style: React.CSSProperties = {
      border: `solid 1px ${colors.SILVER}`,
      borderRadius: 3,
      color: 'inherit',
      display: 'block',
      fontSize: 13,
      fontWeight: 900,
      height: 235,
      lineHeight: 1.46,
      marginRight: isLast ? 0 : SpeakingAboutBobSection.mediaLinkMargin,
      textDecoration: 'none',
      width: SpeakingAboutBobSection.mediaLinkWidth,
    }
    const imageStyle: React.CSSProperties = {
      display: 'block',
      width: '100%',
    }
    const titleStyle: React.CSSProperties = {
      display: 'block',
      padding: 20,
    }
    return <ExternalLink style={style} href={url} key={`press-${index}`}>
      <img src={imageSrc} alt={imageAltText} style={imageStyle} />
      <span style={titleStyle}>
        {title}
      </span>
    </ExternalLink>
  }

  private renderTweet(tweetId, index, allTweets): React.ReactNode {
    const isLast = index === allTweets.length - 1
    const style = {
      borderRadius: 3,
      marginRight: isLast ? 0 : SpeakingAboutBobSection.mediaLinkMargin,
      width: SpeakingAboutBobSection.mediaLinkWidth,
    }

    return <div style={style} key={`tweet-${index}`} >
      <TwitterTweetEmbed options={{cards: 'hidden', conversation: 'none'}} tweetId={tweetId} />
    </div>
  }

  public render(): React.ReactNode {
    const {skipPress, skipTweet} = this.state
    const titleStyle: React.CSSProperties = {
      color: colors.DARK_BLUE,
      fontSize: 33,
      fontWeight: 900,
      margin: 0,
      paddingTop: 70,
      textAlign: 'center',
    }
    const sectionHeaderStyle: React.CSSProperties = {
      ...subtitleStyle,
      marginBottom: 20,
      marginTop: 55,
    }
    const bulletStyle = (isSelected): React.CSSProperties => ({
      backgroundColor: isSelected ? colors.BOB_BLUE : colors.PINKISH_GREY,
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-block',
      height: 6,
      margin: 5,
      width: 6,
    })
    const carouselSectionStyle: React.CSSProperties = {
      margin: 'auto',
      maxWidth: MAX_CONTENT_WIDTH,
      overflow: 'hidden',
      width: '100%',
    }
    const arrowStyle: React.CSSProperties = {
      alignSelf: 'center',
      flexShrink: 0,
      height: 24,
      width: 24,
    }
    const chevronSize = 22
    const skipPressPixels = SpeakingAboutBobSection.getSkipPixels(skipPress)
    const skipTweetPixels = SpeakingAboutBobSection.getSkipPixels(skipTweet)
    const allMediaLinksStyle = (skipMediaPixels): React.CSSProperties => ({
      display: 'flex',
      transform: `translateX(-${skipMediaPixels}px)`,
      width: (SpeakingAboutBobSection.mediaLinkWidth + SpeakingAboutBobSection.mediaLinkMargin) *
        SpeakingAboutBobSection.pressArticles.length,
      ...SmoothTransitions,
    })
    return <section
      style={{backgroundColor: '#fff', padding: `0 ${MIN_CONTENT_PADDING}px`}}>
      <h2 style={titleStyle}>
        Ils parlent de <span style={{color: colors.BOB_BLUE}}>{config.productName}</span>
      </h2>

      <h3 style={sectionHeaderStyle}>Dans la presse</h3>
      <div style={carouselSectionStyle}>
        <Swipeable
          onSwipedLeft={this.createPressSwipeHandler(1)}
          onSwipedRight={this.createPressSwipeHandler(-1,)}
          style={allMediaLinksStyle(skipPressPixels)}>
          {SpeakingAboutBobSection.pressArticles.map(this.renderPress)}
        </Swipeable>
      </div>
      <div style={{display: 'flex', justifyContent: 'center'}}>
        <CarouselArrow
          chevronSize={chevronSize}
          isLeft={true} isVisible={!!skipPress} style={{...arrowStyle, marginRight: 10}}
          handleClick={this.handleSkipPress(skipPress - 1)} />
        {SpeakingAboutBobSection.numPressArticlesBullets > 1 ? <ol
          style={{display: 'flex', padding: 0}}>
          {SpeakingAboutBobSection.pressArticles.
            slice(0, SpeakingAboutBobSection.numPressArticlesBullets).
            map((article, index): React.ReactNode => <li
              key={`press-bullet-${index}`} style={bulletStyle(index === skipPress)}
              onClick={this.handleSkipPress(index)} />)}
        </ol> : null}
        <CarouselArrow
          chevronSize={chevronSize}
          isVisible={skipPress !== SpeakingAboutBobSection.numPressArticlesBullets - 1}
          handleClick={this.handleSkipPress(skipPress + 1)}
          style={{...arrowStyle, marginLeft: 10}} />
      </div>

      <h3 style={sectionHeaderStyle}>Sur les réseaux sociaux</h3>
      <div style={carouselSectionStyle}>
        <div
          style={allMediaLinksStyle(skipTweetPixels)}>
          {SpeakingAboutBobSection.tweetIds.map(this.renderTweet)}
        </div>
      </div>
      {SpeakingAboutBobSection.numTweetBullets > 1 ? <ol
        style={{padding: 0, textAlign: 'center'}}>
        {SpeakingAboutBobSection.tweetIds.
          slice(0, SpeakingAboutBobSection.numTweetBullets).
          map((tweet, index): React.ReactNode => <li
            key={`tweet-bullet-${index}`} style={bulletStyle(index === skipTweet)}
            onClick={this.handleSkipTweet(index)} />)}
      </ol> : null}

      <PartnersSubSection />
    </section>
  }
}


interface LinkState {
  isFocused?: boolean
  isHovered?: boolean
}


// A link with an arrow on the right.
// Move this to theme if it's used somewhere else.
class ArrowLink extends React.PureComponent<Link['props'], LinkState> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
    to: PropTypes.string.isRequired,
  }

  public state = {
    isFocused: false,
    isHovered: false,
  }

  private handleSetTrue = _memoize((field): (() => void) =>
    (): void => this.setState({[field]: true}))

  private handleSetFalse = _memoize((field): (() => void) =>
    (): void => this.setState({[field]: false}))

  public render(): React.ReactNode {
    const {children, style, to, ...extraProps} = this.props
    const {isFocused, isHovered} = this.state
    const isHighlighted = isFocused || isHovered
    const containerStyle: React.CSSProperties = {
      color: isHighlighted ? colors.BOB_BLUE_HOVER : colors.BOB_BLUE,
      fontSize: 16,
      fontWeight: 600,
      padding: 10,
      position: 'relative',
      textDecoration: 'none',
      ...SmoothTransitions,
      ...style,
    }
    const arrowContainerStyle: React.CSSProperties = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      left: '100%',
      position: 'absolute',
      top: 0,
    }
    const arrowStyle: React.CSSProperties = {
      fill: isHighlighted ? colors.BOB_BLUE_HOVER : colors.BOB_BLUE,
      height: 14,
      transform: `translateX(${isHighlighted ? -10 : 0}px)`,
      ...SmoothTransitions,
    }
    return <Link
      onMouseOver={this.handleSetTrue('isHovered')}
      onMouseLeave={this.handleSetFalse('isHovered')}
      onFocus={this.handleSetTrue('isFocused')}
      onBlur={this.handleSetFalse('isFocused')}
      to={to} style={containerStyle} {...extraProps}>
      {children}
      <div style={arrowContainerStyle}>
        <ArrowRightThickIcon style={arrowStyle} key="arrow" />
      </div>
    </Link>
  }
}


interface LandingRouteParams {
  romeId?: string
  specificJobName?: string
}


interface LandingPageProps extends RouteComponentProps<LandingRouteParams>{
  children?: never
  dispatch: DispatchAllActions
  hasLoadedApp?: boolean
}


interface FullLandingPageState extends LandingPageContent {
  kind: LandingPageKind
  title: React.ReactNode
}


interface LandingPageState {
  isForSpecificJob?: boolean
  isScrollNavBarShown: boolean
  landingPageContent: FullLandingPageState
}


class LandingPageBase extends React.PureComponent<LandingPageProps, LandingPageState> {
  // Figure out what landing page kind should be displayed and return the
  // corresponding state vars.
  private static getLandingPageContentState({
    location: {search},
    match: {params: {romeId, specificJobName}},
  }: LandingPageProps): Pick<LandingPageState, 'isForSpecificJob'|'landingPageContent'> {
    if (specificJobName) {
      return {
        isForSpecificJob: true,
        landingPageContent: LandingPageBase.getLandingPageContentForSpecificJob(
          romeId, specificJobName),
      }
    }
    const {utm_content: utmContent = ''} = parse(search)
    return {
      landingPageContent: LandingPageBase.getLandingPageContentForUtmContent(utmContent),
    }
  }

  private static getLandingPageContentForSpecificJob(romeId, specificJobName):
  FullLandingPageState {
    // Special langing pages for a specific job.
    const landingPageKind: LandingPageKind = 'specific-job'
    const landingPageContent = {
      ...landingPageContents[landingPageKind],
      kind: landingPageKind,
      // Customize title with job name.
      title: <span style={emStyle}>
        Obtenez des conseils personnalisés pour trouver un poste de {specificJobName}
      </span>,
    }
    return landingPageContent
  }

  private static getLandingPageContentForUtmContent(utmContent): FullLandingPageState {
    // Special wording for the landing page depending on the utm_content value.
    const landingPageKind: LandingPageKind = kinds.find(
      (landingPageKind: LandingPageKind): boolean => {
        const {match} = landingPageContents[landingPageKind]
        return !!match && match.test(utmContent)
      }
    ) || ''
    const landingPageContent = {
      ...landingPageContents[landingPageKind],
      kind: landingPageKind,
    }
    return landingPageContent as FullLandingPageState
  }

  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    // eslint-disable-next-line react/no-unused-prop-types
    location: ReactRouterPropTypes.location.isRequired,
    match: ReactRouterPropTypes.match.isRequired,
  }

  public state: LandingPageState = {
    ...LandingPageBase.getLandingPageContentState(this.props),
    isScrollNavBarShown: false,
  }

  public static getDerivedStateFromProps(
    props: LandingPageProps, {landingPageContent: {kind = undefined} = {}}):
    Pick<LandingPageState, 'isForSpecificJob'|'landingPageContent'>|null {
    const newContent = LandingPageBase.getLandingPageContentState(props)
    if (newContent.landingPageContent && newContent.landingPageContent.kind !== kind) {
      return newContent
    }
    return null
  }

  public componentDidMount(): void {
    const landingPageKind = this.state.landingPageContent.kind
    this.maybeFetchSpecificJob().then((specificJob): void => {
      this.props.dispatch(loadLandingPage(landingPageKind, specificJob))
    })
  }

  // Fetch job info if this is a landing page about a specific job.
  private maybeFetchSpecificJob(): Promise<bayes.bob.Job|null> {
    const {specificJobName} = this.props.match.params
    if (!specificJobName) {
      return Promise.resolve(null)
    }
    // Return null for the fetched job if any error happens.
    return fetchFirstSuggestedJob(specificJobName).catch((): bayes.bob.Job|null => null)
  }

  private handleVisibility = _memoize((sectionName): ((v) => void) => (isVisible): void => {
    if (!isVisible) {
      return
    }
    this.props.dispatch(landingPageSectionIsShown(sectionName))
  })

  private handleTopVisibilityChange = (isTopShown): void =>
    this.setState({isScrollNavBarShown: !isTopShown})

  private renderScrollNavBar(isVisible: boolean): React.ReactNode {
    const style: React.CSSProperties = {
      backgroundColor: '#fff',
      boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.2)',
      color: colors.DARK,
      fontSize: 14,
      height: 70,
      left: 0,
      opacity: isVisible ? 1 : 0,
      padding: '0 20px',
      position: 'fixed',
      right: 0,
      top: isVisible ? 0 : -80,
      zIndex: 2,
      ...SmoothTransitions,
    }
    const contentStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      height: style.height,
      margin: '0 auto',
      maxWidth: MAX_CONTENT_WIDTH,
    }
    return <div style={style}>
      <div style={contentStyle}>
        <img src={bobBlueImage} height={30} alt={config.productName} />
        <span style={{flex: 1}} />

        <LoginButton isSignUp={true} visualElement="scrolling-nav-bar" type="validation">
          Commencer
        </LoginButton>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {isScrollNavBarShown, landingPageContent} = this.state
    return <StaticPage
      page="landing" isContentScrollable={false} isNavBarTransparent={true}
      style={{backgroundColor: '#fff', overflow: 'hidden'}} isChatButtonShown={true}
      isCookieDisclaimerShown={!!isMobileVersion}>

      {/* NOTE: The beginning of the DOM is what Google use in its snippet,
        make sure it's important. */}

      <VisibilitySensor
        onChange={this.handleTopVisibilityChange}
        intervalDelay={250} partialVisibility={true}>
        <div style={{height: 70, position: 'absolute', width: '100%'}} />
      </VisibilitySensor>

      <TitleSection isLoginButtonShown={true} pageContent={landingPageContent} />

      <VisibilitySensor
        onChange={this.handleVisibility('diagnostic')} partialVisibility={true}
        intervalDelay={250}>
        <DiagnosticSection />
      </VisibilitySensor>

      <VisibilitySensor
        onChange={this.handleVisibility('steps')} partialVisibility={true}
        intervalDelay={250}>
        <StepsSection />
      </VisibilitySensor>

      <VisibilitySensor
        onChange={this.handleVisibility('testimonials')} partialVisibility={true}
        intervalDelay={250}>
        <TestimonialsSection />
      </VisibilitySensor>

      <VisibilitySensor
        onChange={this.handleVisibility('speaking-about')} partialVisibility={true}
        intervalDelay={250}>
        <SpeakingAboutBobSection />
      </VisibilitySensor>

      {isMobileVersion ? null : <CookieMessageOverlay />}

      {this.renderScrollNavBar(isScrollNavBarShown)}
    </StaticPage>
  }
}
const LandingPage = connect(({app: {hasLoadedApp = false}}: RootState): {hasLoadedApp: boolean} =>
  ({
    hasLoadedApp,
  }))(withRouter(LandingPageBase))


export default LandingPage
