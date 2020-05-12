import _memoize from 'lodash/memoize'
import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import LazyLoad from 'react-lazyload'
import {useDispatch, useSelector} from 'react-redux'
import {useLocation, useParams} from 'react-router'
import {Swipeable} from 'react-swipeable'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, landingPageSectionIsShown,
  loadLandingPage} from 'store/actions'
import {getLanguage, prepareT} from 'store/i18n'
import {parseQueryString} from 'store/parse'
import {makeCancelable} from 'store/promise'

import bobBlueImage from 'images/bob-logo.svg?fill=#1888ff' // colors.BOB_BLUE
import step1Image from 'images/landing_step_1.svg'
import step2Image from 'images/landing_step_2.svg'
import step3Image from 'images/landing_step_3.svg'
import franceEngageImage from 'images/lfse-logo.png'
import frenchImpactImage from 'images/french-impact-logo.png'
import googleOrgImage from 'images/google-logo.png'
import poleEmploiImage from 'images/pe-logo.png'
import pressConsolabImage from 'images/press/consolab.png'
import pressEchoStartImage from 'images/press/echos.png'
import pressEurope1Image from 'images/press/europe1.png'
import pressFemmeActuelleImage from 'images/press/femme-actuelle.png'
import pressFranceInfoImage from 'images/press/franceinfo.png'
import pressLetudiantImage from 'images/press/letudiant.png'
import pressNouvelleVieImage from 'images/press/nouvellevie.png'
import pressPositivrImage from 'images/press/positivr.png'
import sncImage from 'images/snc-logo.png'
import arthurImage from 'images/testimonials/arthur.png'
import catherineImage from 'images/testimonials/catherine.png'
import pierreAlainImage from 'images/testimonials/pierre-alain.png'

import {CookieMessageOverlay} from 'components/cookie_message'
import {Trans} from 'components/i18n'
import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {StaticPage, TitleSection} from 'components/static'
import {fetchFirstSuggestedJob} from 'components/suggestions'
import {ExternalLink, Img, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  SmoothTransitions} from 'components/theme'
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
    title: '',
  },
  'coach': {
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
  'ease': {
    match: /ease|simplicity/,
    title: <span>
      Avancez <em style={emStyle}>plus facilement</em> dans votre recherche
      d'emploi
    </span>,
  },
  'personalization': {
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
  'prioritization': {
    match: /prioritization/,
    subtitle: `${config.productName} analyse votre situation et vous aide à ` +
      'savoir ce qui est vraiment important',
    title: <span>
      Que faire en <span style={emStyle}>priorité</span> pour <span
        style={emStyle}>trouver un emploi</span>&nbsp;?
    </span>,
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
  'speed': {
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


interface StepProps {
  children: React.ReactNode
  image: string
  step: number
  title: string
}

const stepHeight = isMobileVersion ? 250 : 325
const stepStyle: React.CSSProperties = {
  alignItems: isMobileVersion ? 'flex-start' : 'center',
  display: 'flex',
  height: isMobileVersion ? stepHeight : 'initial',
  padding: isMobileVersion ? 20 : 0,
}
const stepBigSquareStyle: React.CSSProperties = {
  backdropFilter: 'blur(10px)',
  backgroundColor: '#fff',
  borderRadius: 15,
  boxShadow: '0 40px 55px 0 rgba(0, 0, 0, 0.1)',
  display: 'flex',
  height: stepHeight,
  margin: '0 80px',
  padding: 40,
  transform: 'rotate(45deg)',
  width: stepHeight,
}
const stepSmallSquareStyle: React.CSSProperties = {
  alignItems: 'center',
  backdropFilter: 'blur(8px)',
  backgroundColor: '#fff',
  borderRadius: 15,
  boxShadow: '0 10px 50px 0 rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flex: 1,
  justifyContent: 'center',
  position: 'relative',
}
const stepImgStyle: React.CSSProperties = {
  left: '50%',
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
}
const bobScoreStepStyle: React.CSSProperties = {
  ...stepImgStyle,
  fontSize: 32,
  fontWeight: 900,
  // center of Bob score is lower than the center of the image.
  top: '53%',
}
const numberMargin = 10
const stepNumberStyle: React.CSSProperties = {
  backgroundColor: colors.BOB_BLUE,
  border: `${numberMargin}px solid #fff`,
  borderRadius: 15 + numberMargin,
  color: '#fff',
  display: 'flex',
  flex: 'none',
  fontSize: 20,
  fontWeight: 'bold',
  height: 30 + 2 * numberMargin,
  justifyContent: 'center',
  // TODO(cyrille): Fix Lato padding on MacOS.
  lineHeight: '30px',
  margin: -numberMargin,
  width: 30 + 2 * numberMargin,
  zIndex: 1,
}
const stepContentStyle: React.CSSProperties = {
  color: colors.WARM_GREY,
  fontSize: 16,
  height: 30,
  lineHeight: 1.25,
  maxWidth: 310,
  textAlign: 'initial',
}
const stepTitleStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: isMobileVersion ? 20 : 28,
  fontWeight: 900,
  lineHeight: '30px',
  marginTop: isMobileVersion ? 0 : 'initial',
}
const stepVerbStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  fontWeight: 'bolder',
}
const titleMainWord = [<span style={stepVerbStyle} key="0" />]

const StepBase = ({children, image, step, title}: StepProps): React.ReactElement => {
  const containerStyle = useMemo((): React.CSSProperties => ({
    ...stepStyle,
    flexDirection: step % 2 || isMobileVersion ? 'row' : 'row-reverse',
    marginTop: isMobileVersion ? 0 : 110,
  }), [step])
  const squareStyle = useMemo((): React.CSSProperties => (isMobileVersion ? {display: 'none'} : {
    ...stepBigSquareStyle,
    transform: step % 2 ? 'rotate(45deg)' : 'rotate(-45deg)',
  }), [step])
  const contentStyle = useMemo((): React.CSSProperties => ({
    ...stepContentStyle,
    margin: isMobileVersion ? '0 20px' : step % 2 ? '0 95px 0 80px' : '0 50px 0 125px',
  }), [step])
  return <div style={containerStyle}>
    {isMobileVersion ? null : <div style={{position: 'relative', zIndex: 0}}>
      <div style={squareStyle}>
        <div style={stepSmallSquareStyle} />
      </div>
      <img src={image} style={stepImgStyle} alt="" />
      {step === 2 ? <span style={bobScoreStepStyle}>+53%</span> : null}
    </div>}
    <div style={stepNumberStyle}>{step}</div>
    <div style={contentStyle}>
      {/* i18next-extract-disable-next-line */}
      <Trans parent="h3" style={stepTitleStyle} i18nKey={title} components={titleMainWord} />
      {children}
    </div>
  </div>
}
const Step = React.memo(StepBase)


const stepsSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: colors.SLATE,
  fontSize: 16,
  lineHeight: 1.69,
  minHeight: 365,
  padding: isMobileVersion ? '20px 0 50px' : '0 0 80px',
  textAlign: 'center',
}
const stepsLayoutStyle: React.CSSProperties = {
  ...isMobileVersion ? {
    display: 'inline-block',
    margin: '0 auto',
  } : {},
  position: 'relative',
  zIndex: 0,
}
const stepLoginButtonStyle: React.CSSProperties = {
  display: 'block',
  marginTop: isMobileVersion ? 0 : 130,
}

const steps = [
  {
    children: <Trans parent={null}>
      Profil, marché ou évolution du métier, {{productName: config.productName}} décortique
      tous les facteurs de la recherche d'emploi et dresse un diagnostic complet de votre
      situation.
    </Trans>,
    image: step1Image,
    title: prepareT('<0>Analyse</0> complète de votre situation'),
  },
  {
    children: <Trans parent={null}>
      {{productName: config.productName}} vous explique comment agir sur votre employabilité
      avec des stratégies claires et sur mesure. {{productName: config.productName}} s'adapte
      selon vos envies et vos disponibilités. C'est vous le chef&nbsp;!
    </Trans>,
    image: step2Image,
    title: prepareT('<0>Stratégies</0> adaptées à vos besoins'),
  },
  {
    children: <Trans parent={null}>
      Foncez vers votre futur emploi avec les conseils affutés
      de {{productName: config.productName}} pour agir sur vos meilleures stratégies.
    </Trans>,
    image: step3Image,
    title: prepareT('<0>Coaching</0> sur mesure et adaptatif'),
  },
]

const dashLineStyle: React.CSSProperties = {
  borderLeft: `1px dashed ${colors.PINKISH_GREY}`,
  height: `calc(100% - ${stepHeight}px)`,
  left: isMobileVersion ? 35 : '50%',
  position: 'absolute',
  top: isMobileVersion ? 15 : stepHeight / 2,
}
const StepsSectionBase = (): React.ReactElement => <section style={stepsSectionStyle}>
  <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
    <div style={stepsLayoutStyle}>
      {steps.map((step, index) => <Step key={index + 1} step={index + 1} {...step} />)}
      <div style={dashLineStyle} />
    </div>
    <LoginButton
      visualElement="diagnostic" isSignUp={true} type="validation" style={stepLoginButtonStyle}>
      <Trans parent={null}>Commencer tout de suite</Trans>
    </LoginButton>
  </div>
</section>
const StepsSection = React.memo(StepsSectionBase)


const iconTextStyle = {
  alignItems: 'center',
  display: 'flex',
}
// TODO(sil): Generalize and factorize with spontaneous stars.
const getFillPercentage = _memoize(
  (starIndex: number, score: number): number => {
    if (starIndex < Math.trunc(score)) {
      return 100
    }
    if (starIndex < score) {
      return Math.round(score % 1 * 100)
    }
    return 0
  },
  (starIndex: number, score: number): string => `${starIndex}-${score}`,
)

const StarBase: React.FC<{percentage: number}> =
({percentage}: {percentage: number}): React.ReactElement => {
  return <svg
    width="25"
    height="25"
    viewBox="0 0 25 25">
    <defs>
      <linearGradient id={`grad-${percentage}`} x1="0" x2="100%" y1="0" y2="0">
        <stop offset="0" stopColor={colors.DARK_YELLOW} />
        <stop offset={`${percentage}%`} stopColor={colors.DARK_YELLOW} />
        <stop offset={`${percentage}%`} stopColor={colors.PALE_GREY} />
        <stop offset="100%" stopColor={colors.PALE_GREY} />
      </linearGradient>
    </defs>
    <path
      stroke={colors.DARK_YELLOW}
      fill={`url(#grad-${percentage})`}
      d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,
      9.24L7.45,13.97L5.82,21L12,17.27Z" />
  </svg>
}
const Star = React.memo(StarBase)

const StarsBase: React.FC<{score: number}> =
  ({score}: {score: number}): React.ReactElement|null => {
    if (!score) {
      return null
    }
    return <span style={iconTextStyle}>
      {new Array(5).fill(null).map((unused, index): React.ReactNode =>
        <Star percentage={getFillPercentage(index, score)} key={index} />)}
    </span>
  }
StarsBase.propTypes = {
  score: PropTypes.number,
}
const Stars = React.memo(StarsBase)


const ratingContainerStyle: React.CSSProperties = {
  maxWidth: 120,
}
const ratingScoreStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
}
const ratingSubTextStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 13,
}

interface RatingProps {
  score: number
  subText: React.ReactElement
}

const RatingBase: React.FC<RatingProps> = ({score, subText}: RatingProps): React.ReactElement => {
  return <div style={ratingContainerStyle}>
    <span style={ratingScoreStyle}>{(score).toLocaleString(getLanguage())}</span>
    <Stars score={score} />
    <span style={ratingSubTextStyle}>{subText}</span>
  </div>
}
const Rating = React.memo(RatingBase)


const testimonialsSectionStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_GREY,
  color: colors.DARK_TWO,
  padding: isMobileVersion ? '20px 30px' : '80px 0',
  position: 'relative',
}
const testimonialSubHeaderStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 18,
  lineHeight: '26px',
  marginBottom: 40,
  maxWidth: 405,
  ...isMobileVersion && {textAlign: 'center'},
}
const commitmentTextStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 330,
  paddingBottom: 40,
}
const testimonialContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'space-between',
  margin: 'auto',
  maxWidth: 1000,
}
const testimonialsStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 470,
}
const testimonialStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 0 60px 0 rgba(0, 0, 0, 0.1)',
  display: 'flex',
  fontSize: 15,
  marginBottom: 35,
  padding: 30,
}
const pictoStyle: React.CSSProperties = {
  flex: 'none',
  marginRight: 30,
  width: 70,
}
const strongTextStyle: React.CSSProperties = {
  fontWeight: 900,
}
const testimonialAuthorStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontStyle: 'italic',
  fontWeight: 'bold',
  paddingTop: 10,
}
const ratingsContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
}

// TODO(sil): Make rating dynamics.
const TestimonialsSectionBase = (): React.ReactElement => {
  const numEmploiStoreReviews = 90
  const numInAppReviews = 3568
  const ratings = [
    {
      score: 3.5,
      subText: <Trans>
        Sur {{numEmploiStoreReviews: numEmploiStoreReviews}} avis donnés sur l'Emploi Store.
      </Trans>,
    },
    {
      score: 4.6,
      subText: <Trans>
        Sur {{numInAppReviews: numInAppReviews}} avis postés
        sur {{productName: config.productName}}.
      </Trans>,
    },
  ]
  return <section style={testimonialsSectionStyle}>
    <div style={testimonialContainerStyle}>
      <div>
        <Trans style={testimonialSubHeaderStyle}>
          {{productName: config.productName}} a déjà aidé plus de <span style={strongTextStyle}>
            {{userCount: (200000).toLocaleString(getLanguage())}} personnes
          </span> à mieux comprendre et appréhender la recherche d'emploi
        </Trans>
        <div style={ratingsContainerStyle}>
          {ratings.map((rating, index): React.ReactElement => <Rating {...rating} key={index} />)}
        </div>
      </div>
      <div style={testimonialsStyle}>
        <div style={testimonialStyle}>
          <Img style={pictoStyle} src={arthurImage} alt="Arthur" />
          <div>
            <Trans parent="">
              Je n'aurais jamais eu l'occasion d'avoir ces entretiens si je n'avais pas eu de
              contacts pour faire passer mon CV comme {{productName: config.productName}} me
              l'a dit.
            </Trans>
            <Trans style={testimonialAuthorStyle}>
              Arthur
            </Trans>
          </div>
        </div>
        <div style={testimonialStyle}>
          <Img style={pictoStyle} src={catherineImage} alt="Catherine" />
          <div>
            <Trans parent="">
              Comme recommandé dans un des mails, j'ai compris qu'il fallait que je me tourne
              prioritairement vers des entreprises qui me plaisent et non juste celles
              qui recrutent.
            </Trans>
            <Trans style={testimonialAuthorStyle}>
              Catherine
            </Trans>
          </div>
        </div>
        <div style={testimonialStyle}>
          <Img style={pictoStyle} src={pierreAlainImage} alt="Pierre-Alain" />
          <div>
            <Trans parent="">
              {{productName: config.productName}} m'a incité à mobiliser mon réseau en me
              donnant les outils appropriés. En fait, {{productName: config.productName}} m'a
              surtout appris à oser&nbsp;!
            </Trans>
            <Trans style={testimonialAuthorStyle}>
              Pierre-Alain
            </Trans>
          </div>
        </div>
      </div>
    </div>
    <div style={{padding: '35px 0 10px', textAlign: 'center'}}>
      <Trans style={commitmentTextStyle}>
        <span style={strongTextStyle}>Convaincus&nbsp;?</span> Laissez-vous guider
        par {{productName: config.productName}} et boostez votre recherche d'emploi&nbsp;!
      </Trans>
      <LoginButton isSignUp={true} visualElement="testimonials" type="validation">
        <Trans parent="">Commencer tout de suite</Trans>
      </LoginButton>
    </div>
  </section>
}
const TestimonialsSection = React.memo(TestimonialsSectionBase)


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


const partnerSectionStyle = {
  backgroundColor: colors.MARINE,
  paddingTop: 30,
} as const
const partnersStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-around',
  margin: '0 auto',
  maxWidth: 1000,
} as const


const PartnersSectionBase = (): React.ReactElement => <section style={partnerSectionStyle}>
  <div style={partnersStyle}>
    {partnersContent.map((partner): React.ReactNode =>
      <PartnerCard {...partner} key={partner.name} />)}
  </div>
</section>
const PartnersSection = React.memo(PartnersSectionBase)


interface PartnerProps {
  // TODO(cyrille): Replace with grey image.
  imageSrc: string
  name: string
}


const partnerCardContainerStyle: React.CSSProperties = {
  width: 200,
} as const
const parnerCardImgStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 auto 30px',
  maxHeight: 55,
  maxWidth: 130,
} as const

const PartnerCardBase = ({imageSrc, name}: PartnerProps): React.ReactElement =>
  <div style={partnerCardContainerStyle}>
    <LazyLoad height={55} once={true} offset={200}>
      <img src={imageSrc} alt={name} title={name} style={parnerCardImgStyle} />
    </LazyLoad>
  </div>
PartnerCardBase.propTypes = {
  imageSrc: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}
const PartnerCard = React.memo(PartnerCardBase)


interface BulletProps {
  index: number
  isSelected: boolean
  onClick: (index: number) => void
}


const bulletContainerStyle = {
  cursor: 'pointer',
  display: 'inline-block',
}


const CarouselBullet = (props: BulletProps): React.ReactElement => {
  const {index, isSelected, onClick} = props
  const handleClick = useCallback((): void => onClick(index), [index, onClick])
  const bulletStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isSelected ? colors.BOB_BLUE : colors.PINKISH_GREY,
    borderRadius: 6,
    height: 6,
    margin: 5,
    width: 6,
  }), [isSelected])
  return <li
    style={bulletContainerStyle}
    onClick={handleClick}>
    <div style={bulletStyle} />
  </li>
}
const Bullet = React.memo(CarouselBullet)


interface PressArticleProps {
  imageAltText: string
  imageSrc: string
  title: string
  url: string
}


const mediaLinkWidth = isMobileVersion ? 280 : 320

const mediaLinkMargin = 20

const pressArticles = [
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
    title: "VIDÉO. Pour endiguer le chômage, il crée un site de recherche d'emplois personnalisé",
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
] as const

const numMediaElementsShown = isMobileVersion ? 1 : 3

function getNumMediaBullets(allMedia: readonly {}[]): number {
  return Math.round((allMedia.length + numMediaElementsShown - 1) / numMediaElementsShown)
}

const getSkipPixels = (skip: number): number => skip *
  (mediaLinkWidth + mediaLinkMargin) * numMediaElementsShown

const numPressArticlesBullets = getNumMediaBullets(pressArticles)

const SpeakingAboutBobSectionBase = (): React.ReactElement => {
  const [skipPress, setSkipPress] = useState(0)

  const nextPress = useCallback((): void => {
    setSkipPress(skipPress => Math.min(skipPress + 1, numPressArticlesBullets - 1))
  }, [])
  const previousPress = useCallback((): void => {
    setSkipPress(skipPress => Math.max(skipPress - 1, 0))
  }, [])

  const renderPress = (
    {url, title, imageSrc, imageAltText}: PressArticleProps, index: number,
    allPress: readonly PressArticleProps[]): React.ReactNode => {
    const isLast = index === allPress.length - 1
    const indexSkip = Math.floor(index / numMediaElementsShown)
    const isVisible = indexSkip === skipPress
    const style: React.CSSProperties = {
      borderRadius: 20,
      boxShadow: '0 0 60px 0 rgba(0, 0, 0, 0.1)',
      color: 'inherit',
      display: 'block',
      fontSize: 13,
      fontWeight: 900,
      height: 235,
      lineHeight: 1.46,
      marginRight: isLast ? 0 : mediaLinkMargin,
      opacity: isVisible ? 1 : 0,
      textDecoration: 'none',
      width: mediaLinkWidth,
      ...SmoothTransitions,
    }
    const imageStyle: React.CSSProperties = {
      borderRadius: '20px 20px 0 0',
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

  const carouselSectionStyle: React.CSSProperties = {
    margin: 'auto',
    maxWidth: MAX_CONTENT_WIDTH,
    width: numMediaElementsShown * mediaLinkWidth + mediaLinkMargin * (numMediaElementsShown - 1),
  }
  const skipPressPixels = getSkipPixels(skipPress)
  const allMediaLinksStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    transform: `translateX(-${skipPressPixels}px)`,
    width: (mediaLinkWidth + mediaLinkMargin) * pressArticles.length,
    ...SmoothTransitions,
  }), [skipPressPixels])
  return <section
    style={{backgroundColor: colors.PALE_GREY, padding: `70px ${MIN_CONTENT_PADDING}px 60px`}}>

    <div style={carouselSectionStyle}>
      <Swipeable
        onSwipedLeft={nextPress}
        onSwipedRight={previousPress}
        style={allMediaLinksStyle}>
        {pressArticles.map(renderPress)}
      </Swipeable>
    </div>
    <div style={{display: 'flex', justifyContent: 'center', marginTop: 30}}>
      {numPressArticlesBullets > 1 ? <ol style={{display: 'flex', margin: 0, padding: 0}}>
        {pressArticles.
          slice(0, numPressArticlesBullets).
          map((article, index): React.ReactNode => <Bullet
            index={index} isSelected={index === skipPress} onClick={setSkipPress}
            key={`bullet-${index}`} />)}
      </ol> : null}
    </div>
  </section>
}
const SpeakingAboutBobSection = React.memo(SpeakingAboutBobSectionBase)


const externaLinkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  fontWeight: 'bold',
  textDecoration: 'none',
}
const covidNameStyle: React.CSSProperties = {
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: colors.YELLOW_ORANGE_TWO,
  borderRadius: '4px 0 0 4px',
  color: '#fff',
  display: 'flex',
  padding: 20,
}
const closeIconStyle: React.CSSProperties = {
  backgroundColor: colors.SLATE,
  borderRadius: 15,
  color: '#fff',
  cursor: 'pointer',
  margin: 15,
  padding: 2,
}


const CovidBannerBase = (): React.ReactElement => {
  const [isShown, setIsShown] = useState(false)
  const hide = useCallback((): void => setIsShown(false), [])
  useEffect((): (() => void) => {
    const timeout = window.setTimeout((): void => setIsShown(true), 200)
    return (): void => clearTimeout(timeout)
  }, [])
  const covidBannerContainerStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 4,
    bottom: 50,
    boxShadow: '5px 3px 20px 0 rgba(0, 0, 0, 0.25)',
    color: colors.DARK_TWO,
    display: 'flex',
    fontSize: 13,
    fontWeight: 'bold',
    left: '50%',
    position: 'fixed',
    transform: `translate(-50%, ${isShown ? '0' : '200%'}`,
    width: 'fit-content',
    ...SmoothTransitions,
  }
  return <Trans style={covidBannerContainerStyle}>
    <strong style={covidNameStyle}>COVID19</strong>
    <span style={{flex: 1, paddingLeft: 22}}>
      Découvrez nos astuces pour continuer votre recherche d'emploi malgré le
      confinement. <ExternalLink href={Routes.COVID_PAGE} style={externaLinkStyle}>
        Lire l'article
      </ExternalLink>
    </span>
    <CloseIcon onClick={hide} style={closeIconStyle} />
  </Trans>
}
const CovidBanner = React.memo(CovidBannerBase)


interface LandingRouteParams {
  romeId?: string
  specificJobName?: string
}


interface FullLandingPageState extends LandingPageContent {
  kind: LandingPageKind
  title: React.ReactNode
}


const horizBarStyle: React.CSSProperties = {
  backgroundColor: colors.MINI_FOOTER_GREY,
  height: 1,
  margin: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
  width: '100%',
}


function getLandingPageContentForSpecificJob(
  romeId: string|undefined, specificJobName: string,
): FullLandingPageState {
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


function getLandingPageContentForUtmContent(utmContent?: string): FullLandingPageState {
  // Special wording for the landing page depending on the utm_content value.
  const landingPageKind: LandingPageKind = kinds.find(
    (landingPageKind: LandingPageKind): boolean => {
      const {match} = landingPageContents[landingPageKind]
      return !!match && !!utmContent && match.test(utmContent)
    },
  ) || ''
  const landingPageContent = {
    ...landingPageContents[landingPageKind],
    kind: landingPageKind,
  }
  return landingPageContent as FullLandingPageState
}


// Figure out what landing page kind should be displayed and return the
// corresponding state vars.
function getLandingPageContentState(
  search: string,
  {romeId, specificJobName}: LandingRouteParams,
): FullLandingPageState {
  if (specificJobName) {
    return getLandingPageContentForSpecificJob(romeId, specificJobName)
  }
  const {utm_content: utmContent = ''} = parseQueryString(search)
  return getLandingPageContentForUtmContent(utmContent)
}


interface SectionProps {
  children: React.ReactNode
  name: string
  onChange: (name: string, isVisible: boolean) => void
}


const VisibilitySectionBase = (props: SectionProps): React.ReactElement => {
  const {children, name, onChange} = props
  const handleChange = useCallback((isVisible: boolean): void => {
    onChange(name, isVisible)
  }, [name, onChange])
  return <VisibilitySensor onChange={handleChange} partialVisibility={true} intervalDelay={250}>
    {children}
  </VisibilitySensor>
}
const VisibilitySection = React.memo(VisibilitySectionBase)


const LandingPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const {search} = useLocation()
  const params = useParams<LandingRouteParams>()
  const landingPageContent = getLandingPageContentState(search, params)
  const landingPageKind = landingPageContent.kind

  const [isScrollNavBarShown, setIsScrollNavBarShown] = useState(false)
  const hasLoadedApp = useSelector(
    ({app: {hasLoadedApp = false}}: RootState): boolean => hasLoadedApp,
  )

  useEffect((): (() => void) => {
    // Fetch job info if this is a landing page about a specific job.
    const maybeFetchSpecificJob: Promise<bayes.bob.Job|null> = params.specificJobName ?
      fetchFirstSuggestedJob(params.specificJobName).
        // Return null for the fetched job if any error happens.
        catch((): bayes.bob.Job|null => null) :
      Promise.resolve(null)

    const cancelablePromise = makeCancelable(maybeFetchSpecificJob)
    cancelablePromise.promise.then((specificJob): void => {
      hasLoadedApp || dispatch(loadLandingPage(landingPageKind, specificJob))
    })
    return cancelablePromise.cancel
  }, [dispatch, hasLoadedApp, landingPageKind, params.specificJobName])

  const handleVisibility = useCallback((sectionName: string, isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    dispatch(landingPageSectionIsShown(sectionName))
  }, [dispatch])

  const topSpaceRef = useRef<HTMLDivElement>(null)
  const handleTopVisibilityChange = useCallback((isTopShown?: boolean): void => {
    // When first loading the page, isTopShown is false because the div has no height yet.
    setIsScrollNavBarShown(!isTopShown && !!topSpaceRef.current?.clientHeight)
  }, [])

  const scrollNavBarStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.2)',
    color: colors.DARK,
    fontSize: 14,
    height: 70,
    left: 0,
    opacity: isScrollNavBarShown ? 1 : 0,
    padding: '0 20px',
    position: 'fixed',
    right: 0,
    top: isScrollNavBarShown ? 0 : -80,
    zIndex: 2,
    ...SmoothTransitions,
  }
  const scrollNavBarContentStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    height: scrollNavBarStyle.height,
    margin: '0 auto',
    maxWidth: MAX_CONTENT_WIDTH,
  }
  const scrollNavBar = <div style={scrollNavBarStyle}>
    <div style={scrollNavBarContentStyle}>
      <img src={bobBlueImage} height={30} alt={config.productName} />
      <span style={{flex: 1}} />

      <LoginButton isSignUp={true} visualElement="scrolling-nav-bar" type="validation">
        <Trans parent="">Commencer</Trans>
      </LoginButton>
    </div>
  </div>

  // TODO(pascal): Add a language toggler.
  return <StaticPage
    page="landing" isContentScrollable={false} isNavBarTransparent={true}
    style={{backgroundColor: '#fff', overflow: 'hidden'}} isChatButtonShown={true}
    isCookieDisclaimerShown={!!isMobileVersion}>

    {/* NOTE: The beginning of the DOM is what Google use in its snippet,
      make sure it's important. */}

    <VisibilitySensor
      onChange={handleTopVisibilityChange}
      intervalDelay={250} partialVisibility={true}>
      <div style={{height: 70, position: 'absolute', width: '100%'}} ref={topSpaceRef} />
    </VisibilitySensor>

    <TitleSection isLoginButtonShown={true} pageContent={landingPageContent} />

    <VisibilitySection onChange={handleVisibility} name="steps">
      <StepsSection />
    </VisibilitySection>

    <VisibilitySection onChange={handleVisibility} name="testimonials">
      <TestimonialsSection />
    </VisibilitySection>

    <div style={{backgroundColor: colors.PALE_GREY}}>
      <div style={horizBarStyle} />
    </div>

    <VisibilitySection onChange={handleVisibility} name="speaking-about">
      <SpeakingAboutBobSection />
    </VisibilitySection>

    <VisibilitySection onChange={handleVisibility} name="partners">
      <PartnersSection />
    </VisibilitySection>

    {isMobileVersion ? null : <CookieMessageOverlay />}

    <CovidBanner />

    {scrollNavBar}
  </StaticPage>
}
const LandingPage = React.memo(LandingPageBase)


export default LandingPage
