import _memoize from 'lodash/memoize'
import _uniqueId from 'lodash/uniqueId'
import CloseIcon from 'mdi-react/CloseIcon'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import LazyLoad from 'react-lazyload'
import {useDispatch} from 'react-redux'
import {useLocation, useParams} from 'react-router'
import {useSwipeable} from 'react-swipeable'

import useOnScreen from 'hooks/on_screen'
import {useIsTabNavigationUsed} from 'hooks/tab_navigation'
import type {DispatchAllActions} from 'store/actions'
import {landingPageSectionIsShown,
  loadLandingPage} from 'store/actions'
import type {LocalizableString} from 'store/i18n'
import {prepareT, toLocaleString} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import {useAsynceffect} from 'store/promise'

import step1Image from 'images/landing_step_1.svg'
import step2Image from 'images/landing_step_2.svg'
import step3Image from 'images/landing_step_3.svg'
import franceEngageImage from 'images/lfse-logo.png'
import frenchImpactImage from 'images/french-impact-logo.png'
import googleOrgImage from 'images/google-logo.png'
import poleEmploiImage from 'images/pe-logo.png'
import sncImage from 'images/snc-logo.png'
import arthurImage from 'images/testimonials/arthur.png'
import catherineImage from 'images/testimonials/catherine.png'
import pierreAlainImage from 'images/testimonials/pierre-alain.png'

import {CookieMessageOverlay} from 'components/cookie_message'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import {fetchJobByName} from 'components/job_input'
import {LoginButton} from 'components/login'
import {RadiumExternalLink, useFocus} from 'components/radium'
import {StaticPage, TitleSection} from 'components/static'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'

import pressArticles from 'deployment/press'


const emStyle: React.CSSProperties = {
  color: colors.DARK_BLUE,
}


interface LandingPageContent {
  fontSize?: number
  match: RegExp
  subtitle?: string
  title: React.ReactNode
}


// Kinds of different landing page excluding the default kind.
const landingPageContentsRaw = {
  '': {
    fontSize: 42,
    match: /evaluation/,
    title: '',
  },
  'action-plan': {
    match: /action-plan/,
    title: <span>
      Créez un plan d'action personnalisé et obtenez des ressources utiles pour votre recherche
      d'emploi&nbsp;!
    </span>,
  },
  'coach': {
    match: /coach/,
    title: <span>
      Un <em style={emStyle}>plan d'action</em> sur-mesure pour
      <em style={emStyle}> accélérer</em> votre recherche d'emploi
    </span>,
  },
  'common-questions': {
    match: /common-questions/,
    title: 'Find out the most common interview questions - and how to answer them',
  },
  'cover-letter': {
    match: /cover-letter/,
    title: 'Discover free cover letter templates',
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
  'easy-find-job': {
    match: /easy-find-job/,
    title: `Trouver un job plus facilement, avec ${config.productName}`,
  },
  'explain-in-five': {
    match: /explain-in-five/,
    title: "Ta recherche d'emploi expliquée en 5 minutes",
  },
  'forward-jobsearch': {
    match: /forward-jobsearch/,
    title: "En 5 minutes, découvrez comment avancer sur votre recherche d'emploi",
  },
  'free-tips': {
    match: /free-tips/,
    title: 'Get free tips to ace your job interview',
  },
  'fresh-resume': {
    match: /fresh-resume/,
    title: 'Find out how to refresh your resume. In 5 minutes.',
  },
  'job-vacancies': {
    match: /job-vacancies/,
    title: "Find out about job vacancies - before they're even posted",
  },
  'job-without-offers': {
    match: /job-without-offers/,
    title: 'En 5 minutes, découvrez comment trouver un job sans annonces',
  },
  'market-secret': {
    match: /market-secret/,
    title: "En 5 minutes, découvrez les secrets du marché de l'emploi au-delà du job étudiant",
  },
  'next-job': {
    match: /next-job/,
    title: 'Votre prochain job expliqué en 5 minutes',
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
  'quick-find-work': {
    match: /quick-find-work/,
    title: 'En 5 minutes, découvrez comment mieux trouver un emploi',
  },
  'rethink-search': {
    fontSize: 42,
    match: /rethink/,
    title: <span style={emStyle}>
      Repensons votre recherche d'emploi
    </span>,
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
export const landingPageContents =
  landingPageContentsRaw as {readonly [P in LandingPageKind]: LandingPageContent}


const sectionHeaderStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 31,
  margin: '0 auto 50px',
  maxWidth: MAX_CONTENT_WIDTH,
  textAlign: isMobileVersion ? 'center' : 'left',
}

interface StepProps {
  children: LocalizableString
  image: string
  // Callback to give back the margin between the top of the step and the top of the number bubble.
  onTopMarginToNumberUpdate?: (step: number, onTopMarginToNumber: number) => void
  step: number
  title: LocalizableString
}

const stepHeight = isMobileVersion ? 250 : 325
const stepStyle: React.CSSProperties = {
  alignItems: isMobileVersion ? 'flex-start' : 'center',
  display: 'flex',
  height: isMobileVersion ? stepHeight : 'initial',
  marginTop: isMobileVersion ? 0 : 110,
  padding: isMobileVersion ? 20 : 0,
}
const stepBigSquareStyle: React.CSSProperties = {
  backdropFilter: 'blur(10px)',
  backgroundColor: '#fff',
  borderRadius: 15,
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
  left: 0,
  // TODO(cyrille): Fix Lato padding on MacOS.
  lineHeight: '30px',
  margin: -numberMargin,
  position: 'absolute',
  top: 0,
  width: 30 + 2 * numberMargin,
  zIndex: 1,
}
const stepContentStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.25,
  maxWidth: isMobileVersion ? 360 : 485,
  padding: isMobileVersion ? '0 0 0 50px' : '0 95px 0 80px',
  position: 'relative',
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
const noMarginStyle: React.CSSProperties = {
  margin: 0,
}
const titleMainWord = [<span style={stepVerbStyle} key="0" />] as const

const StepBase = (props: StepProps): React.ReactElement => {
  const {children, image, onTopMarginToNumberUpdate, step, title} = props
  const [titleKey, tOptions] = title
  const {t: translate} = useTranslation('landing')
  const containerRef = useRef<HTMLLIElement>(null)
  const stepNumberRef = useRef<HTMLDivElement>(null)
  const updateTopMarginToNumber = useCallback((): void => {
    if (!stepNumberRef.current || !containerRef.current) {
      return
    }
    const containerTop = containerRef.current.getClientRects()?.[0]?.top || 0
    const stepNumberTop = stepNumberRef.current.getClientRects()?.[0]?.top || 0
    onTopMarginToNumberUpdate?.(step, stepNumberTop - containerTop)
  }, [onTopMarginToNumberUpdate, step])
  useEffect((): (() => void) => {
    if (!onTopMarginToNumberUpdate) {
      return () => void 0
    }
    const interval = window.setInterval(updateTopMarginToNumber, 500)
    return () => {
      window.clearInterval(interval)
    }
  }, [onTopMarginToNumberUpdate, updateTopMarginToNumber])
  const thisStepStyle = useMemo((): React.CSSProperties => step === 1 ? {
    ...stepStyle,
    marginTop: 0,
  } : stepStyle, [step])
  return <li style={thisStepStyle} ref={containerRef}>
    <div style={stepContentStyle}>
      <div style={stepNumberStyle} ref={stepNumberRef}>{step}</div>
      {/* i18next-extract-disable-next-line */}
      <Trans
        parent="h3" style={stepTitleStyle} i18nKey={titleKey} components={titleMainWord}
        tOptions={tOptions} ns="landing" />
      <p style={noMarginStyle}>
        {translate(...children)}
      </p>
    </div>
    {isMobileVersion ? null : <div style={{position: 'relative', zIndex: 0}}>
      <div style={stepBigSquareStyle}>
        <div style={stepSmallSquareStyle} />
      </div>
      <img src={image} style={stepImgStyle} alt="" />
      {step === 2 ? <span style={bobScoreStepStyle} aria-hidden={true}>+53%</span> : null}
    </div>}
  </li>
}
const Step = React.memo(StepBase)


const stepsSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: colors.SLATE,
  fontSize: 16,
  lineHeight: 1.69,
  minHeight: 365,
  padding: isMobileVersion ? '20px 0 50px' : '80px 0',
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
  display: 'inline-block',
  marginTop: isMobileVersion ? 0 : 130,
}

const steps = [
  {
    children: prepareT(
      'Profil, marché ou évolution du métier, {{productName}} décortique tous les facteurs de ' +
      "la recherche d'emploi et dresse un diagnostic complet de votre situation.",
      {productName: config.productName},
    ),
    image: step1Image,
    title: prepareT('<0>Analyse</0> complète de votre situation'),
  },
  {
    children: prepareT(
      '{{productName}} vous explique comment agir sur votre employabilité avec des stratégies ' +
      "claires et sur mesure. {{productName}} s'adapte selon vos envies et vos disponibilités. " +
      "C'est vous le chef\u00A0!",
      {productName: config.productName},
    ),
    image: step2Image,
    title: prepareT('<0>Stratégies</0> adaptées à vos besoins'),
  },
  {
    children: prepareT(
      'Foncez vers votre futur emploi avec les conseils affutés de {{productName}} pour agir ' +
      'sur vos meilleures stratégies.',
      {productName: config.productName},
    ),
    image: step3Image,
    title: prepareT('<0>Coaching</0> sur mesure et adaptatif'),
  },
] as const

const StepsSectionBase = (): React.ReactElement => {
  // Handle the position of the dashed line, which depends on the inner margins of the steps.
  const [marginToFirstNumber, setMarginToFirstNumber] = useState(78.5)
  const [marginToLastNumber, setMarginToLastNumber] = useState(88.5)
  const handleTopMarginToNumberUpdate = useCallback((step: number, topMargin: number): void => {
    if (step === 1) {
      setMarginToFirstNumber(topMargin)
      return
    }
    if (step === steps.length) {
      setMarginToLastNumber(topMargin)
    }
  }, [])
  const extraLineHeight = isMobileVersion ? 0 : (marginToLastNumber - marginToFirstNumber)
  const {t} = useTranslation('landing')

  const dashLineStyle = useMemo((): React.CSSProperties => ({
    borderLeft: `1px dashed ${colors.PINKISH_GREY}`,
    height: `calc(100% - ${stepHeight + extraLineHeight}px)`,
    left: isMobileVersion ? 35 : 15,
    position: 'absolute',
    top: isMobileVersion ? 15 : (15 + marginToFirstNumber),
  }), [extraLineHeight, marginToFirstNumber])
  return <section style={stepsSectionStyle}>
    <div style={{padding: '0 20px'}}>
      <h2 style={sectionHeaderStyle}>{t('Comment ça marche\u00A0?')}</h2>
    </div>
    <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
      <div style={stepsLayoutStyle}>
        <ol style={{margin: 0, padding: 0}}>
          {steps.map((step, index) => <Step
            key={index + 1} step={index + 1} {...step}
            onTopMarginToNumberUpdate={
              isMobileVersion || !index || index < steps.length - 1 ?
                undefined : handleTopMarginToNumberUpdate
            } />)}
        </ol>
        <div style={dashLineStyle} />
      </div>
      <LoginButton
        visualElement="diagnostic" isSignUp={true} type="navigation" style={stepLoginButtonStyle}>
        {t('Commencer tout de suite')}
      </LoginButton>
    </div>
  </section>
}
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
  const gradId = useMemo(_uniqueId, [])
  return <svg
    width="25"
    height="25"
    viewBox="0 0 25 25" aria-hidden={true} focusable={false}>
    <defs>
      <linearGradient id={`grad-${gradId}`} x1="0" x2="100%" y1="0" y2="0">
        <stop offset="0" stopColor={colors.DARK_YELLOW} />
        <stop offset={`${percentage}%`} stopColor={colors.DARK_YELLOW} />
        <stop offset={`${percentage}%`} stopColor={colors.PALE_GREY} />
        <stop offset="100%" stopColor={colors.PALE_GREY} />
      </linearGradient>
    </defs>
    <path
      stroke={colors.DARK_YELLOW}
      fill={`url(#grad-${gradId})`}
      d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,
      9.24L7.45,13.97L5.82,21L12,17.27Z" />
  </svg>
}
const Star = React.memo(StarBase)

const StarsBase: React.FC<{score: number}> =
  ({score}: {score: number}): React.ReactElement|null => {
    const {t} = useTranslation('landing')
    if (!score) {
      return null
    }
    return <span style={iconTextStyle} role="img" aria-label={t(' sur 5 étoiles')}>
      {Array.from(
        {length: 5},
        (unused, index): React.ReactNode =>
          <Star percentage={getFillPercentage(index, score)} key={index} />,
      )}
    </span>
  }
const Stars = React.memo(StarsBase)


const ratingContainerStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 120,
}
const ratingScoreStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
}
const ratingSubTextStyle: React.CSSProperties = {
  fontSize: 13,
}

interface RatingProps {
  numReviews: number
  platform: string
  score: number
}

const RatingBase = ({numReviews, platform, score}: RatingProps): React.ReactElement|null => {
  const {t} = useTranslation('landing')
  if (!numReviews) {
    return null
  }
  return <p style={ratingContainerStyle}>
    <span style={ratingScoreStyle}>{toLocaleString(score)}</span>
    <Stars score={score} />
    <span style={ratingSubTextStyle}>{t(
      'Sur {{numReviews}} avis donnés sur {{platform}}.', {numReviews, platform},
    )}</span>
  </p>
}
const Rating = React.memo(RatingBase)


const testimonialsSectionStyle: React.CSSProperties = {
  backgroundColor: colors.PALE_GREY,
  color: colors.DARK_TWO,
  padding: isMobileVersion ? '50px 30px' : '80px 0',
  position: 'relative',
}
const testimonialSubHeaderStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 18,
  lineHeight: '26px',
  margin: '0 0 40px',
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
  listStyleType: 'none',
  margin: 0,
  maxWidth: 470,
  padding: 0,
}
const testimonialStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 0 60px 0 rgba(0, 0, 0, 0.1)',
  display: 'flex',
  fontSize: 15,
  margin: '0 0 35px',
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
  const {t} = useTranslation('landing')
  const ratings = [
    {
      numReviews: config.isEmploiStoreEnabled ? numEmploiStoreReviews : 0,
      platform: t("l'Emploi Store"),
      score: 3.5,
    },
    {
      numReviews: numInAppReviews,
      platform: config.productName,
      score: 4.6,
    },
  ]
  return <section style={testimonialsSectionStyle}>
    <h2 style={sectionHeaderStyle}>{t('Ils parlent de nous')}</h2>
    <div style={testimonialContainerStyle}>
      <div>
        <Trans style={testimonialSubHeaderStyle} ns="landing" parent="p">
          {{productName: config.productName}} a déjà aidé plus de <span style={strongTextStyle}>
            {{userCount: toLocaleString(270_000)}} personnes
          </span> à mieux comprendre et appréhender la recherche d'emploi
        </Trans>
        <div style={ratingsContainerStyle}>
          {ratings.map((rating, index): React.ReactElement => <Rating {...rating} key={index} />)}
        </div>
      </div>
      <ul style={testimonialsStyle}>
        <li>
          <blockquote style={testimonialStyle}>
            <img style={pictoStyle} src={arthurImage} alt="" />
            <div>
              {t(
                "Je n'aurais jamais eu l'occasion d'avoir ces entretiens si je n'avais pas eu de " +
                "contacts pour faire passer mon CV comme {{productName}} me l'a dit.",
                {productName: config.productName},
              )}
              <div style={testimonialAuthorStyle}>
                {t('Arthur')}
              </div>
            </div>
          </blockquote>
        </li>
        <li>
          <blockquote style={testimonialStyle}>
            <img style={pictoStyle} src={catherineImage} alt="" />
            <div>
              {t(
                "Comme recommandé dans un des mails, j'ai compris qu'il fallait que je me tourne " +
                'prioritairement vers des entreprises qui me plaisent et non juste celles ' +
                'qui recrutent.',
                {productName: config.productName},
              )}
              <div style={testimonialAuthorStyle}>
                {t('Catherine')}
              </div>
            </div>
          </blockquote>
        </li>
        <li>
          <blockquote style={testimonialStyle}>
            <img style={pictoStyle} src={pierreAlainImage} alt="" />
            <div>
              {t(
                "{{productName}} m'a incité à mobiliser mon réseau en me donnant les outils " +
                "appropriés. En fait, {{productName}} m'a surtout appris à oser\u00A0!",
                {productName: config.productName},
              )}
              <div style={testimonialAuthorStyle}>
                {t('Pierre-Alain')}
              </div>
            </div>
          </blockquote>
        </li>
      </ul>
    </div>
    <div style={{padding: '35px 0 10px', textAlign: 'center'}}>
      <Trans style={commitmentTextStyle} ns="landing" parent="p">
        <span style={strongTextStyle}>Convaincus&nbsp;?</span> Laissez-vous guider
        par {{productName: config.productName}} et boostez votre recherche d'emploi&nbsp;!
      </Trans>
      <LoginButton isSignUp={true} visualElement="testimonials" type="navigation">
        {t('Commencer tout de suite')}
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
    name: 'Solidarités nouvelles face au chômage',
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
  padding: 0,
} as const


const PartnersSectionBase = (): React.ReactElement => <section style={partnerSectionStyle}>
  <ul style={partnersStyle}>
    {partnersContent.map((partner): React.ReactNode =>
      <PartnerCard {...partner} key={partner.name} />)}
  </ul>
</section>
const PartnersSection = React.memo(PartnersSectionBase)


interface PartnerProps {
  // TODO(cyrille): Replace with grey image.
  imageSrc: string
  name: string
}


const partnerCardContainerStyle: React.CSSProperties = {
  display: 'block',
  width: 200,
} as const
const parnerCardImgStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 auto 30px',
  maxHeight: 55,
  maxWidth: 130,
} as const

const PartnerCardBase = ({imageSrc, name}: PartnerProps): React.ReactElement => {
  const placeholder = useMemo(() => <span>{name}</span>, [name])
  return <li style={partnerCardContainerStyle}>
    <LazyLoad height={55} once={true} offset={200} placeholder={placeholder}>
      <img src={imageSrc} alt={name} title={name} style={parnerCardImgStyle} />
    </LazyLoad>
  </li>
}
const PartnerCard = React.memo(PartnerCardBase)


interface BulletProps {
  ['aria-label']?: string
  index: number
  isSelected: boolean
  onClick: (index: number) => void
}


const bulletContainerStyle: React.CSSProperties = {
  display: 'inline-block',
}
const bulletButtonStyle: React.CSSProperties = {
  borderRadius: 4,
  display: 'flex',
  outline: 'none',
}


const CarouselBullet = (props: BulletProps): React.ReactElement => {
  const {index, isSelected, onClick, ...otherProps} = props
  const {isFocused, ...focusHandlers} = useFocus<HTMLButtonElement>()
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const handleClick = useCallback((): void => onClick(index), [index, onClick])
  const color = isSelected ? colors.BOB_BLUE : colors.PINKISH_GREY
  const bulletStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: color,
    borderRadius: 6,
    color: color,
    display: 'inline-block',
    height: 10,
    margin: 7,
    padding: 0,
    width: 10,
    ...(isFocused && isTabNavigationUsed) ? {outline: 'solid 2px'} : undefined,
    outlineOffset: 2,
  }), [isFocused, color, isTabNavigationUsed])
  return <li style={bulletContainerStyle}>
    <button
      style={bulletButtonStyle} onClick={handleClick} {...focusHandlers} type="button"
      {...otherProps} aria-current={isSelected}>
      <span style={bulletStyle} />
    </button>
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

const numMediaElementsShown = isMobileVersion ? 1 : 3

function getNumMediaBullets(allMedia: readonly unknown[]): number {
  return Math.round((allMedia.length + numMediaElementsShown - 1) / numMediaElementsShown)
}

const getSkipPixels = (skip: number): number => skip *
  (mediaLinkWidth + mediaLinkMargin) * numMediaElementsShown

const numPressArticlesBullets = getNumMediaBullets(pressArticles)

const SpeakingAboutBobSectionBase = (): React.ReactElement|null => {
  const [skipPress, setSkipPress] = useState(0)

  const nextPress = useCallback((): void => {
    setSkipPress(skipPress => Math.min(skipPress + 1, numPressArticlesBullets - 1))
  }, [])
  const previousPress = useCallback((): void => {
    setSkipPress(skipPress => Math.max(skipPress - 1, 0))
  }, [])

  const articlesRef = useRef<readonly React.RefObject<HTMLAnchorElement>[] | undefined>()
  if (!articlesRef.current || articlesRef.current.length !== pressArticles.length) {
    articlesRef.current = Array.from(
      {length: pressArticles.length},
      (): React.RefObject<HTMLAnchorElement> => React.createRef(),
    )
  }
  const handleBulletClick = useCallback((bulletIndex: number) => {
    setSkipPress(bulletIndex)
    articlesRef.current?.[bulletIndex * numMediaElementsShown]?.current?.focus()
  }, [])

  const renderPress = (
    {url, title, imageSrc, imageAltText}: PressArticleProps, index: number,
    allPress: readonly PressArticleProps[]): React.ReactNode => {
    const isLast = index === allPress.length - 1
    const indexSkip = Math.floor(index / numMediaElementsShown)
    const isVisible = indexSkip === skipPress
    const style: RadiumCSSProperties = {
      ':focus': {
        boxShadow: '0 0 60px 0 rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(0, 0, 0, 0.7)',
      },
      'borderRadius': 20,
      'boxShadow': '0 0 60px 0 rgba(0, 0, 0, 0.1)',
      'color': 'inherit',
      'display': 'block',
      'fontSize': 13,
      'fontWeight': 900,
      'height': 235,
      'lineHeight': 1.46,
      'marginRight': isLast ? 0 : mediaLinkMargin,
      'opacity': isVisible ? 1 : 0,
      'textDecoration': 'none',
      'width': mediaLinkWidth,
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
    return <li key={`press-${index}`} style={style}><RadiumExternalLink
      style={style} href={url} tabIndex={isVisible ? 0 : -1} ref={articlesRef.current?.[index]}>
      <img src={imageSrc} alt={imageAltText} style={imageStyle} />
      <span style={titleStyle}>
        {title}
      </span>
    </RadiumExternalLink></li>
  }

  const carouselSectionStyle: React.CSSProperties = {
    margin: 'auto',
    maxWidth: MAX_CONTENT_WIDTH,
    width: numMediaElementsShown * mediaLinkWidth + mediaLinkMargin * (numMediaElementsShown - 1),
  }
  const skipPressPixels = getSkipPixels(skipPress)
  const allMediaLinksStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    margin: 0,
    padding: 0,
    transform: `translateX(-${skipPressPixels}px)`,
    width: (mediaLinkWidth + mediaLinkMargin) * pressArticles.length,
    ...SmoothTransitions,
  }), [skipPressPixels])
  const swipeHandlers = useSwipeable({onSwipedLeft: nextPress, onSwipedRight: previousPress})
  const {t} = useTranslation('landing')
  if (!pressArticles.length) {
    return null
  }
  return <section
    style={{backgroundColor: colors.PALE_GREY, padding: `70px ${MIN_CONTENT_PADDING}px 60px`}}>

    <div style={carouselSectionStyle}>
      <ul {...swipeHandlers} style={allMediaLinksStyle}>
        {pressArticles.map(renderPress)}
      </ul>
    </div>
    <div style={{display: 'flex', justifyContent: 'center', marginTop: 30}}>
      {numPressArticlesBullets > 1 ? <ol style={{display: 'flex', margin: 0, padding: 0}}>
        {pressArticles.
          slice(0, numPressArticlesBullets).
          map((article, index): React.ReactNode => <Bullet
            index={index} isSelected={index === skipPress} onClick={handleBulletClick}
            key={`bullet-${index}`}
            aria-label={t('Articles de presse - {{pageNumber}}', {pageNumber: index + 1})} />)}
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
const resetButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: 'none',
  display: 'flex',
  padding: 0,
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
  const {t} = useTranslation('landing')
  const [isShown, setIsShown] = useState(false)
  const hide = useCallback((): void => setIsShown(false), [])
  useEffect((): (() => void) => {
    const timeout = window.setTimeout((): void => setIsShown(true), 200)
    return (): void => window.clearTimeout(timeout)
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
    zIndex: 1,
    ...SmoothTransitions,
  }
  return <Trans
    style={covidBannerContainerStyle} parent="aside" aria-hidden={!isShown} ns="landing">
    <strong style={covidNameStyle}>COVID19</strong>
    <span style={{flex: 1, paddingLeft: 22}}>
      Découvrez nos astuces pour continuer votre recherche d'emploi malgré le
      confinement. <ExternalLink
        href={Routes.COVID_PAGE} style={externaLinkStyle} tabIndex={isShown ? 0 : -1}>
        Lire l'article
      </ExternalLink>
    </span>
    <button disabled={!isShown} onClick={hide} style={resetButtonStyle} type="button">
      <CloseIcon aria-label={t('Fermer')} style={closeIconStyle} />
    </button>
  </Trans>
}
const CovidBanner = React.memo(CovidBannerBase)


interface LandingRouteParams {
  romeId?: string
  specificJobName?: string
}


interface FullLandingPageState extends Omit<LandingPageContent, 'match'> {
  kind: LandingPageKind | 'specific-job'
  title: React.ReactNode
}


const horizBarStyle: React.CSSProperties = {
  backgroundColor: colors.FOOTER_GREY,
  height: 1,
  margin: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
  width: '100%',
}


function getLandingPageContentForSpecificJob(
  romeId: string|undefined, specificJobName: string,
): FullLandingPageState {
  // Special landing pages for a specific job.
  return {
    fontSize: 42,
    kind: 'specific-job',
    // Customize title with job name.
    title: <span style={emStyle}>
      Obtenez des conseils personnalisés pour trouver un poste de {specificJobName}
    </span>,
  }
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
  const ref = useRef<HTMLDivElement>(null)
  const handleVisibilityChange =
    useCallback((isVisible: boolean) => onChange(name, isVisible), [name, onChange])
  useOnScreen(ref, {onChange: handleVisibilityChange})
  return <div ref={ref}>
    {children}
  </div>
}
const VisibilitySection = React.memo(VisibilitySectionBase)


const fetchSpecificJob = async (jobName?: string): Promise<null|bayes.bob.Job> => {
  if (!jobName) {
    return null
  }
  try {
    return await fetchJobByName(jobName) || null
  } catch {
    return null
  }
}

const LandingPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const {search} = useLocation()
  const params = useParams<LandingRouteParams>()
  const landingPageContent = getLandingPageContentState(search, params)
  const landingPageKind = landingPageContent.kind

  useAsynceffect(async (checkIfCanceled) => {
    // Fetch job info if this is a landing page about a specific job.
    const specificJob = await fetchSpecificJob(params.specificJobName)
    if (checkIfCanceled()) {
      return
    }
    dispatch(loadLandingPage(landingPageKind, specificJob))
  }, [dispatch, landingPageKind, params.specificJobName])

  const handleVisibility = useCallback((sectionName: string, isVisible: boolean): void => {
    if (!isVisible) {
      return
    }
    dispatch(landingPageSectionIsShown(sectionName))
  }, [dispatch])

  // TODO(pascal): Add a language toggler.
  return <StaticPage
    page="landing" isContentScrollable={false} isNavBarTransparent={true}
    style={{backgroundColor: '#fff', overflow: 'hidden'}} isChatButtonShown={false}
    isCookieDisclaimerShown={!!isMobileVersion}>

    {/* NOTE: The beginning of the DOM is what Google use in its snippet,
      make sure it's important. */}
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

    {config.hasCovidBanner ? <CovidBanner /> : null}
  </StaticPage>
}
const LandingPage = React.memo(LandingPageBase)


export default LandingPage
