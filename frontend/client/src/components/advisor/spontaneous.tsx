import type {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import React, {useMemo, useCallback} from 'react'
import {useTranslation} from 'react-i18next'


import {closeToCity, lowerFirstLetter, ofJobName, toTitleCase} from 'store/french'
import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import {genderizeJob} from 'store/job'
import isMobileVersion from 'store/mobile'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {RadiumExternalLink} from 'components/radium'
import laBonneBoiteImage from 'images/labonneboite-picto.png'
import laBonneAlternanceImage from 'images/labonnealternance-picto.svg'
import poleEmploiImage from 'images/ple-emploi-ico.png'

import type {CardProps} from './base'
import {MethodSuggestionList, EmailTemplate, ToolCard, useAdviceData} from './base'


const emptyArray = [] as const


const utmTrackingQuery = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-rech&'


interface ValidCompany extends bayes.bob.Company {
  name: string
}
const noMarginStyle: React.CSSProperties = {
  margin: 0,
}

const createLink = (
  maxDistanceToCompaniesKm: number, isForAlternance?: boolean,
  cityId?: string, romeId?: string): string => {
  const baseUrl = isForAlternance ? 'https://labonnealternance.pole-emploi.fr/' : // checkURL
    config.spontaneousApplicationSource
  const distanceParam = maxDistanceToCompaniesKm ? `d=${maxDistanceToCompaniesKm}&` : ''
  return `${baseUrl}entreprises/commune` +
    `/${cityId}/rome/${romeId}?${utmTrackingQuery}${distanceParam}`
}

interface CompaniesProps {
  companies: readonly bayes.bob.Company[]
  handleExplore: (visualElement: string) => () => void
  maxDistanceToCompaniesKm: number
  isForAlternance?: boolean
  isAfterOther?: boolean
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
  t: TFunction
}

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const CompaniesBase: React.FC<CompaniesProps> =
(props: CompaniesProps): React.ReactElement|null => {
  const {companies, handleExplore, isForAlternance, isAfterOther, maxDistanceToCompaniesKm,
    profile: {gender}, project: {
      city: {cityId = '', name = ''} = {},
      targetJob,
    }, t} = props
  const handleExploreMore = useCallback((isForAlternance?: boolean): (() => void) => (): void => {
    handleExplore(`more ${isForAlternance ? 'alternances' : 'companies'}`)()
  }, [handleExplore])


  const {jobGroup: {romeId = ''} = {}} = targetJob || {}

  const appTitle = `La Bonne ${isForAlternance ? 'Alternance' : 'Boîte'}`

  const title = isForAlternance && isAfterOther ?
    <Trans t={t} parent={null} count={companies.length}>
      <GrowingNumber isSteady={true} number={companies.length} />
      {' '}structure susceptible de recruter en alternance
    </Trans> : <Trans t={t} parent={null} count={companies.length}>
      <GrowingNumber isSteady={true} number={companies.length} />
      {' '}structure à qui envoyer une candidature spontanée
    </Trans>
  const subtitle = isForAlternance && isAfterOther ? t(
    "Aujourd'hui, l'alternance est ouverte pas seulement aux jeunes, mais à toute personne " +
    'inscrite à Pôle emploi ou bénéficiaire des minimas sociaux.',
  ) : isForAlternance ? t(
    "Elles ont un fort potentiel d'embauche pour un·e {{jobName}} en alternance {{closeToCity}}",
    {
      closeToCity: closeToCity(name, t),
      context: gender,
      jobName: lowerFirstLetter(genderizeJob(targetJob, gender)),
    },
  ) : t(
    "Elles ont un fort potentiel d'embauche pour un·e {{jobName}} {{closeToCity}}",
    {
      closeToCity: closeToCity(name, t),
      context: gender,
      jobName: lowerFirstLetter(genderizeJob(targetJob, gender)),
    },
  )
  const footer = useMemo((): React.ReactElement =>
    <Trans t={t} parent="p" style={noMarginStyle}>
      <img
        src={poleEmploiImage} style={{height: 35, marginRight: 10, verticalAlign: 'middle'}}
        alt="Pôle emploi" />
      Voir d'autres entreprises sur <ExternalLink
        style={linkStyle}
        href={createLink(maxDistanceToCompaniesKm, isForAlternance, cityId, romeId)}
        onClick={handleExploreMore(isForAlternance)}>{{appTitle}}</ExternalLink>
    </Trans>,
  [appTitle, cityId, handleExploreMore, romeId, maxDistanceToCompaniesKm, isForAlternance, t])
  if (!companies || !companies.length) {
    return null
  }
  return <MethodSuggestionList
    title={title} subtitle={subtitle} footer={footer} style={isAfterOther ? {marginTop: 20} : {}}>
    {companies.filter((c: bayes.bob.Company): c is ValidCompany => !!c.name).
      map((company: ValidCompany, index: number): ReactStylableElement =>
        <CompanyLink
          key={`company-${index}`} {...company} {...{isForAlternance, romeId, t}}
          onClick={handleExplore(isForAlternance ? 'alternance' : 'company')} />)}
  </MethodSuggestionList>
}
const Companies = React.memo(CompaniesBase)


const SpontaneousMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {
    profile: {gender},
    project: {diagnostic, employmentTypes = [], targetJob},
    strategyId,
    t,
  } = props
  const {data: {
    alternanceCompanies,
    companies,
    maxDistanceToCompaniesKm = 10,
    maxDistanceToAlternanceCompaniesKm = 10,
  }, loading} = useAdviceData<bayes.bob.SpontaneousApplicationData>(props)
  const isMissingDiploma = diagnostic && diagnostic.categoryId === 'missing-diploma'
  const isLookingForAlternance = isMissingDiploma ?
    strategyId === 'get-alternance' :
    employmentTypes.includes('ALTERNANCE')
  const isOnlyLookingForAlternance = isMissingDiploma ?
    strategyId === 'get-alternance' :
    isLookingForAlternance && employmentTypes.length === 1
  const usefulCompanies = !isOnlyLookingForAlternance && companies || emptyArray
  const usefulAlternanceCompanies = isLookingForAlternance && alternanceCompanies || emptyArray
  if (loading) {
    return loading
  }
  if (usefulCompanies.length || usefulAlternanceCompanies.length) {
    return <React.Fragment>
      <Companies companies={usefulCompanies} {...{maxDistanceToCompaniesKm}} {...props} />
      <Companies
        isForAlternance={true} isAfterOther={!!usefulCompanies.length}
        maxDistanceToCompaniesKm={maxDistanceToAlternanceCompaniesKm}
        companies={usefulAlternanceCompanies} {...props} />
    </React.Fragment>
  }
  const title = isOnlyLookingForAlternance ?
    t('Trouver des entreprises qui recrutent en alternance') :
    t('Trouver des entreprises qui recrutent')
  const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
  const subtitle = t(
    'Faire des candidatures spontanées est un des meilleurs moyens de trouver un poste ' +
    '{{ofJobName}}', {ofJobName: ofJobName(jobName, t)},
  )
  return <MethodSuggestionList title={title} subtitle={subtitle}>
    {isOnlyLookingForAlternance ? null : <ToolCard
      imageSrc={laBonneBoiteImage} href={createLink(maxDistanceToCompaniesKm)}>
      La Bonne Boite
      <span style={{fontSize: 13, fontWeight: 'normal'}}>
        {t("pour trouver des entreprises à fort potentiel d'embauche")}
      </span>
    </ToolCard>}
    {isLookingForAlternance ? <ToolCard
      imageSrc={laBonneAlternanceImage}
      href={createLink(maxDistanceToAlternanceCompaniesKm, true)}>
      La Bonne Alternance
      <span style={{fontSize: 13, fontWeight: 'normal'}}>
        {t('pour trouver des entreprises qui embauchent en alternance')}
      </span>
    </ToolCard> : null}
  </MethodSuggestionList>
}


interface leadProps {
  emailExample?: LocalizableString
  name: LocalizableString
}
interface leadsProps {
  leadsList: readonly leadProps[]
  title: LocalizableString
}
const leads: readonly leadsProps[] = [
  {
    leadsList: [
      {
        emailExample: prepareT('Tu te rappelles je te disais que je cherchais un travail en ' +
          'tant que (intitulé de poste)\u00A0? Je fais une liste de structures où envoyer ' +
          "mon CV. Jusque là, j'ai pensé à (listez les structures que vous connaissez déjà). " +
          "Est-ce que tu en connais d'autres, qui recrutent éventuellement en ce moment\u00A0?"),
        name: prepareT('Demander à ses connaissances'),
      },
      {name: prepareT('Rechercher dans les actualités')},
      {name: prepareT('Rechercher sur les réseaux sociaux')},
      {name: prepareT('Rechercher sur LinkedIn')},
    ],
    title: prepareT('Étape 1\u00A0: Faire une liste de structures dans votre métier'),
  },
  {
    leadsList: [
      {name: prepareT('Regarder sur le site de la structure')},
      {name:
        prepareT('Regarder dans la rubrique "Personnes" sur la page de la structure sur LinkedIn'),
      },
      {
        emailExample: prepareT('Tu te rappelles ton ami.e dont tu me parlais qui travaille dans ' +
          "(votre domaine)\u00A0? Je me demande si elle/il connait quelqu'un qui travaille pour " +
          '(nom de la structure)\u00A0? Est-ce que tu pourrais nous mettre en relation\u00A0? ' +
          "J'aimerais bien lui parler parce que je pense à postuler chez eux."),
        name: prepareT("Demander à ses connaissances s'ils connaissent quelqu'un qui y travaille"),
      },
      {name: prepareT('Se rendre sur place et demander à parler à un gérant')},
    ],
    title: prepareT('Étape 2\u00A0: Trouver les bonnes personnes à contacter'),
  },
  {
    leadsList: [
      {
        emailExample: prepareT(`**Objet\u00A0:** Candidature spontanée\u00A0: (intitulé du poste)

**Corps du message\u00A0:**

J'ai récemment appris, via mon réseau professionnel, que vous recherchiez un (intitulé du poste).

Ayant plus de (...) années d'expertise dans le domaine de (...) et étant passionné depuis toujours
par (secteur de l'entreprise), je vous contacte afin de vous rencontrer pour envisager une
collaboration.

Quand seriez-vous disponible pour échanger\u00A0?`),
        name: prepareT('Candidature spontanée - exemple 1'),
      },
      {
        emailExample: prepareT(`**Objet\u00A0:** Candidature à l'offre [intitulé de l'offre]

**Corps du message\u00A0:**

J'ai pris connaissance de votre offre d'emploi pour le poste de (nom du poste).
Je suis vraiment intéressé par cette opportunité, car elle correspond parfaitement à mes
compétences, mais surtout parce que l'esprit de votre entreprise me plaît tout particulièrement.
Les valeurs de (2 ou 3 valeurs de l'entreprise) que vous avez adoptées et qui ont fait votre
succès, me correspondent exactement et j'aimerais mettre mes compétences au service d'une entreprise
comme la vôtre.

Au cours de mes précédentes expériences j'ai pu développer mes capacités de (2 ou 3 compétences).
Aujourd'hui j'ai envie de me consacrer à (...) et je suis convaincu que je pourrais également
participer à la croissance de votre équipe et contribuer à la réalisation de vos objectifs.


En espérant que ma candidature saura retenir votre attention, je vous adresse, ci-joint, mon CV.`),
        name: prepareT('Candidature spontanée - exemple 2'),
      },
    ],
    title: prepareT('Étape 3\u00A0: Contacter les recruteurs'),
  },
]

const methodStyle: React.CSSProperties = {
  marginBottom: 20,
}
const tipStyle: React.CSSProperties = {
  fontWeight: 'bold',
}

const SpontaneousTipsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore} = props
  const {t, t: translate} = useTranslation('advisor')
  return <div>
    <div style={{marginBottom: 20}}>{t('3 étapes pour envoyer des candidatures spontanées')}</div>
    {
      leads.map(({leadsList, title}, indexLead): ReactStylableElement|null =>
        <MethodSuggestionList
          key={`list-${indexLead}`} title={translate(...title)}
          style={methodStyle} isNotClickable={true}>
          {
            leadsList.map((lead, indexTip): ReactStylableElement|null => lead.emailExample ?
              <EmailTemplate
                content={translate(...lead.emailExample)}
                title={translate(...lead.name)}
                key={`lead-${indexLead}-${indexTip}`}
                onContentShown={handleExplore('email template')} />
              : <div key={`tip-${indexLead}-${indexTip}`} style={tipStyle}>
                <strong><Markdown content={translate(...lead.name)} /></strong>
              </div>)}
        </MethodSuggestionList>,
      )}
  </div>
}

const ExpandedAdviceCardContent = config.spontaneousApplicationSource ?
  React.memo(SpontaneousMethod) : React.memo(SpontaneousTipsMethod)


const titleStyle = {
  color: colors.COOL_GREY,
}

const iconTextStyle = {
  alignItems: 'center',
  display: 'flex',
}

const getStarStyle = _memoize(
  (starIndex: number, hiringPotential: number): React.CSSProperties => ({
    fill: starIndex < hiringPotential ? colors.GREENISH_TEAL : colors.PINKISH_GREY,
    height: 20,
    width: 20,
  }),
  (starIndex: number, hiringPotential: number): string => `${starIndex}-${hiringPotential}`,
)

interface StarsProps {
  hiringPotential: number
  t: TFunction
}

const maxStars = 5


const StarsBase = ({hiringPotential, t}: StarsProps): React.ReactElement|null => {
  if (!hiringPotential) {
    return null
  }
  return <span style={iconTextStyle}>
    {isMobileVersion ? null : <Trans parent="span" style={titleStyle} t={t}>
      Potentiel d'embauche&nbsp;:
    </Trans>}
    {Array.from({length: maxStars}, (unused, index): React.ReactNode =>
      <StarIcon
        style={getStarStyle(index, hiringPotential)} key={`star-${index}`}
        aria-label={index === maxStars - 1 ?
          t('{{numStars}} sur 5', {numStars: hiringPotential}) : undefined}
        aria-hidden={index !== maxStars - 1} focusable={false} />)}
  </span>
}
const Stars = React.memo(StarsBase)


interface CompanyLinkProps extends ValidCompany {
  isForAlternance?: boolean
  onClick: () => void
  romeId: string
  style?: React.CSSProperties
  t: TFunction
}


const createLBBUrl = (siret: string|undefined, tracking: string): string => {
  if (!siret) {
    return ''
  }
  return `${config.spontaneousApplicationSource}${siret}/details?${tracking}`
}


const createLBAUrl = (siret: string|undefined, tracking: string, romeId: string): string => {
  if (!siret) {
    return ''
  }
  const baseUrl = '${config.spontaneousApplicationSource}details-entreprises/'
  return `${baseUrl}${siret}?${tracking}&rome=${romeId}`
}


const tracking = 'utm_medium=web&utm_source=bob&utm_campaign=bob-conseil-ent'


const CompanyLinkBase: React.FC<CompanyLinkProps> =
  (props: CompanyLinkProps): React.ReactElement => {
    const {
      cityName, hiringPotential, isForAlternance, onClick, name, romeId, siret, style, t,
    } = props
    const url = useMemo(() => {
      if (siret) {
        return isForAlternance ? createLBAUrl(siret, tracking, romeId) :
          createLBBUrl(siret, tracking)
      }
      return `https://${config.googleTopLevelDomain}/search?q=${
        encodeURIComponent(name + ' ' + cityName)}`
    }, [isForAlternance, siret, romeId, name, cityName])

    const containerStyle: React.CSSProperties = {
      color: 'inherit',
      textDecoration: 'none',
      ...style,
      fontWeight: 'normal',
    }
    if (isMobileVersion) {
      containerStyle.paddingRight = 0
    }
    const chevronStyle: React.CSSProperties = {
      fill: colors.CHARCOAL_GREY,
      flex: 'none',
      height: 25,
      opacity: 1,
      padding: '0 10px',
      width: 45,
    }
    return <RadiumExternalLink style={containerStyle} onClick={onClick} href={url}>
      <span style={{flex: 1}}><strong>{toTitleCase(name)}</strong>
        {cityName && !isMobileVersion ?
          <span style={{paddingLeft: '.3em'}}>
            - {toTitleCase(cityName)}
          </span> : null}
      </span>
      <Stars hiringPotential={hiringPotential || 0} t={t} />
      <ChevronRightIcon style={chevronStyle} aria-hidden={true} focusable={false} />
    </RadiumExternalLink>
  }
const CompanyLink = React.memo(CompanyLinkBase)


export default {ExpandedAdviceCardContent, pictoName: 'knightChess' as const}
