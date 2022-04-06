import type {TFunction} from 'i18next'
import _groupBy from 'lodash/groupBy'
import React from 'react'
import {useTranslation} from 'react-i18next'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import canalDesMetiersPreviewImage from 'images/advices/explore-other-jobs/canaldesmetiers.jpg'
import careerOneStopPreviewImage from 'images/advices/explore-other-jobs/careeronestop.jpg'
import careersBoxPreviewImage from 'images/advices/explore-other-jobs/careersbox.png'
import cultureDiversitePreviewImage from 'images/advices/explore-other-jobs/cultureetdiversite.jpg'
import deptOfEducationPreviewImage from 'images/advices/explore-other-jobs/deptofeducation.png'
import waitButWhyImage from 'images/advices/explore-other-jobs/waitbutwhy.png'
import monMetierEnVraiPreviewImage from 'images/advices/explore-other-jobs/monmetierenvrai.jpg'
import ohMyJobPreviewImage from 'images/advices/explore-other-jobs/ohmyjob.jpg'
import onisepPreviewImage from 'images/advices/explore-other-jobs/onisep.jpg'
import openClassroomsImage from 'images/advices/explore-other-jobs/openclassrooms.png'
import placeDesMetiersPreviewImage from 'images/advices/explore-other-jobs/placedesmetiers.jpg'
import semaineIndustriePreviewImage from 'images/advices/explore-other-jobs/semaineindustrie.jpg'
import wouldYouRatherBePreviewImage from 'images/advices/explore-other-jobs/wouldyouratherbe.jpg'
import zoomSurLesMetiersPreviewImage from 'images/advices/explore-other-jobs/zoomsurlesmetiers.jpg'
import Picto from 'images/advices/picto-explore-other-jobs.svg'

import type {CardProps} from './base'
import {CardWithImage, ExpandableAction, ActionWithHandyLink,
  MethodSuggestionList} from './base'


interface JobVideoSite {
  creator?: string
  description: string
  image: string
  language: string
  section: LocalizableString
  title: string
  url: string
}


interface JobVideoSectionProps {
  sites: readonly JobVideoSite[]
  t: TFunction
  title: LocalizableString
}


const JOB_VIDEO_SITES = [
  {
    creator: "l'ONISEP",
    description: 'Plus de 2000 vidéos pour explorer des métiers.',
    image: onisepPreviewImage,
    language: 'fr',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Ce sera moi\u00A0!',
    url: 'https://oniseptv.onisep.fr', // checkURL
  },
  {
    description:
      "Chaîne YouTube suisse avec des centaines de vidéos sur des métiers et sur l'orientation.",
    image: zoomSurLesMetiersPreviewImage,
    language: 'fr',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Zoom sur les métiers',
    url: 'https://www.youtube.com/user/zoomsurlesmetiers/videos', // checkURL
  },
  {
    description: 'Chaine YouTube avec plus de 2000 vidéos pour découvrir des métiers.',
    image: placeDesMetiersPreviewImage,
    language: 'fr',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'La Place des Métiers',
    url: 'https://www.youtube.com/channel/UCQ7LCRNS1os00PP7_WRZIAg/playlists', // checkURL
  },
  {
    description: "200 vidéos (en version gratuite) sur les métiers d'avenir.",
    image: canalDesMetiersPreviewImage,
    language: 'fr',
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Le Canal des Métiers',
    url: 'https://www.lecanaldesmetiers.tv', // checkURL
  },
  {
    creator: 'Welcome to the Jungle',
    description:
    "Dans cette série, celle ou celui qui pratique ce métier au quotidien vous l'explique.",
    image: ohMyJobPreviewImage,
    language: 'fr',
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Oh My Job!',
    url: 'https://www.welcometothejungle.co/collections/metiers', // checkURL
  },
  {
    description: "Des vidéos humoristiques sur 9 métiers d'avenir",
    image: monMetierEnVraiPreviewImage,
    language: 'fr',
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Mon métier en vrai',
    url: 'https://www.youtube.com/playlist?list=PL44SpMa9ShRDa9gcFfhHhSDdXUnR3YCkm', // checkURL
  },
  {
    creator: 'La Fondation Culture & Diversité',
    description: "Découverte des métiers de l'art et de la culture.",
    image: cultureDiversitePreviewImage,
    language: 'fr',
    section: prepareT('Vidéos sur des métiers de la culture'),
    title: "Je m'oriente",
    url: 'http://www.fondationcultureetdiversite.org/je-moriente', // checkURL
  },
  {
    creator: "La Semaine de l'Industrie",
    description: "Découverte des métiers de l'industrie par des Youtubeurs.",
    image: semaineIndustriePreviewImage,
    language: 'fr',
    section: prepareT("Vidéos sur des métiers de l'industrie"),
    title: 'Jobs inattendus',
    url: 'https://www.semaine-industrie.gouv.fr/jobsinattendus', // checkURL
  },
  {
    creator: 'Wait but Why',
    description:
    'A famous article by a blogger who explains how to pick a career with a balance ' +
    'between what you want and what is possible.',
    image: waitButWhyImage,
    language: 'en',
    section: prepareT('Articles et outils pour explorer les métiers et les carrières'),
    title: 'How to pick a career (that actually fits you)',
    url: 'https://waitbutwhy.com/2018/04/picking-career.html', // checkURL
  },
  {
    creator: 'Open Classrooms',
    description: 'A free online course that takes you through building a career step by step.',
    image: openClassroomsImage,
    language: 'en',
    section: prepareT('Articles et outils pour explorer les métiers et les carrières'),
    title: 'Developing a career plan',
    url: 'https://openclassrooms.com/fr/courses/5291411-develop-your-career-plan?archived-source=3848156', // checkURL
  },
  {
    creator: 'CareerOneStop',
    description: 'YouTube channel with hundreds of videos to discover jobs and careers.',
    image: careerOneStopPreviewImage,
    language: 'en',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Career Videos',
    url: 'https://www.youtube.com/user/CareerOneStop/playlists', // checkURL
  },
  {
    creator: 'CareersBox',
    description: 'Hundreds of videos from around the web showing real people doing real jobs.',
    image: careersBoxPreviewImage,
    language: 'en',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Career videos',
    url: 'https://www.careersbox.co.uk', // checkURL
  },
  {
    creator: 'UK Department of Education',
    description: '10 short videos showing a day in the life of different jobs.',
    image: deptOfEducationPreviewImage,
    language: 'en',
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Explore careers',
    url: 'https://www.youtube.com/playlist?list=PL6gGtLyXoeq-9N4CyXIJVhIIlseXKG5YT', // checkURL
  },
  {
    creator: 'Would You Rather Be',
    description:
    'A quiz tells you which careers you could thrive in, helping you build to-do lists with the ' +
    'time and cost to get into each career.',
    image: wouldYouRatherBePreviewImage,
    language: 'en',
    section: prepareT('Articles et outils pour explorer les métiers et les carrières'),
    title: 'Would You Rather be?',
    url: 'https://wouldyouratherbe.com/?utm_source=bob', // checkURL
  },
] as const


const JOB_VIDEO_SECTIONS =
  Object.values(_groupBy(JOB_VIDEO_SITES, ({section: [sectionName]}) => sectionName)).
    map((sites): Omit<JobVideoSectionProps, 't'> =>
      ({sites: sites as readonly JobVideoSite[], title: sites[0].section}))


interface JobVideoCardsProps extends JobVideoSectionProps {
  style?: React.CSSProperties
}


const titleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 16 : 18,
  margin: '0 0 15px',
}
const cardsListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 30,
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}


const JobVideoCardsBase = (props: JobVideoCardsProps): React.ReactElement|null => {
  const {sites, style, t, t: translate, title} = props
  const {i18n} = useTranslation()
  const sitesInLang = sites.filter(({language}) => i18n.languages.includes(language))
  if (!sitesInLang.length) {
    return null
  }
  return <div style={style}>
    <h3 style={titleStyle}>{translate(...title)}</h3>
    <ul style={cardsListStyle}>
      {sitesInLang.map(({creator, description, title, ...site}): React.ReactNode => <CardWithImage
        key={site.url} description={description}
        title={creator ? t('{{title}} par {{creator}}', {creator, title}) : title} {...site} />)}
    </ul>
  </div>
}
const JobVideoCards = React.memo(JobVideoCardsBase)


const handicapIdeasStyle = {
  marginBottom: 40,
}

const actionContentStyle = {
  lineHeight: 1.5,
}

const quoteStyle = {
  borderLeft: `3px solid ${colors.MODAL_PROJECT_GREY}`,
  paddingLeft: 10,
}

const HandicapIdeas: React.FC<CardProps> = ({handleExplore, t}: CardProps): React.ReactElement => {
  const title = <Trans parent={null} t={t}>
    <GrowingNumber number={4} isSteady={true} /> idées pour définir son projet
  </Trans>
  return <MethodSuggestionList title={title} style={handicapIdeasStyle} isNotClickable={true}>
    <ExpandableAction
      onContentShown={handleExplore('tip')}
      title={t('Se faire accompagner')} contentName={t("l'astuce")}>
      <div style={actionContentStyle}>
        {t('Nos amis chez Hanploi nous conseillent\u00A0:')}
        <blockquote style={quoteStyle}>
          <Trans parent="p" t={t}>
            Pas la peine de postuler tous azimuts, si vous n'avez pas défini votre nouveau projet
            professionnel.
          </Trans>
          <Trans parent="p" t={t}>
            Posez-vous avec un conseiller et mettez vos compétences à plat. Certaines sont
            transférables dans d'autres métiers.
          </Trans>
          <Trans parent="p" t={t}>
            Hanploi<br />
            01 44 52 40 69<br />
            Du lundi au vendredi,<br />
            de 9h30 à 13h et de 14h à 17h30
          </Trans>
        </blockquote>
      </div>
    </ExpandableAction>
    <ActionWithHandyLink
      onClick={handleExplore('link')}
      linkName="h'UP" discoverUrl="https://h-up.fr/">
      {t("Se renseigner sur l'entrepreunariat")}
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')}
      linkName="ANDI" discoverUrl="https://andi.beta.gouv.fr/">
      {t('Faire une immersion en entreprise')}
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')}
      linkName="Salon Handicap" discoverUrl="https://www.salonhandicap.com/videos/">
      {t('Se renseigner sur les parcours possibles')}
    </ActionWithHandyLink>
  </MethodSuggestionList>
}

const jobVideoCardsStyle: React.CSSProperties = {
  marginBottom: 30,
}

const ExploreOtherJobsMethod = (props: CardProps): React.ReactElement => {
  return <React.Fragment>
    {props.profile.hasHandicap ? <HandicapIdeas {...props} /> : null}
    {JOB_VIDEO_SECTIONS.map((section: Omit<JobVideoSectionProps, 't'>): React.ReactNode =>
      <JobVideoCards key={section.title[0]} {...section} style={jobVideoCardsStyle} t={props.t} />)}
  </React.Fragment>
}
const ExpandedAdviceCardContent = React.memo(ExploreOtherJobsMethod)


export default {ExpandedAdviceCardContent, Picto}
