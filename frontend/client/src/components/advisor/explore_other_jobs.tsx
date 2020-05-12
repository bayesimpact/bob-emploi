import {TFunction} from 'i18next'
import _groupBy from 'lodash/groupBy'
import React from 'react'

import {LocalizableString, prepareT} from 'store/i18n'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {GrowingNumber} from 'components/theme'
import canalDesMetiersPreviewImage from 'images/advices/explore-other-jobs/canaldesmetiers.jpg'
import cultureDiversitePreviewImage from 'images/advices/explore-other-jobs/cultureetdiversite.jpg'
import monMetierEnVraiPreviewImage from 'images/advices/explore-other-jobs/monmetierenvrai.jpg'
import ohMyJobPreviewImage from 'images/advices/explore-other-jobs/ohmyjob.jpg'
import onisepPreviewImage from 'images/advices/explore-other-jobs/onisep.jpg'
import placeDesMetiersPreviewImage from 'images/advices/explore-other-jobs/placedesmetiers.jpg'
import semaineIndustriePreviewImage from 'images/advices/explore-other-jobs/semaineindustrie.jpg'
import zoomSurLesMetiersPreviewImage from 'images/advices/explore-other-jobs/zoomsurlesmetiers.jpg'
import Picto from 'images/advices/picto-explore-other-jobs.svg'

import {CardProps, CardWithImage, ExpandableAction, ActionWithHandyLink,
  MethodSuggestionList} from './base'


interface JobVideoSite {
  creator?: string
  description: LocalizableString
  image: string
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
    description: prepareT('Plus de 2000 vidéos pour explorer des métiers.'),
    image: onisepPreviewImage,
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Ce sera moi\u00A0!',
    url: 'https://oniseptv.onisep.fr',
  },
  {
    description: prepareT(
      "Chaîne YouTube suisse avec des centaines de vidéos sur des métiers et sur l'orientation.",
    ),
    image: zoomSurLesMetiersPreviewImage,
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'Zoom sur les métiers',
    url: 'https://www.youtube.com/user/zoomsurlesmetiers/videos',
  },
  {
    description: prepareT('Chaine YouTube avec plus de 2000 vidéos pour découvrir des métiers.'),
    image: placeDesMetiersPreviewImage,
    section: prepareT('Vidéos sur tous types de métiers'),
    title: 'La Place des Métiers',
    url: 'https://www.youtube.com/channel/UCQ7LCRNS1os00PP7_WRZIAg/playlists',
  },
  {
    description: prepareT("200 vidéos (en version gratuite) sur les métiers d'avenir."),
    image: canalDesMetiersPreviewImage,
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Le Canal des Métiers',
    url: 'https://www.lecanaldesmetiers.tv',
  },
  {
    creator: 'Welcome to the Jungle',
    description: prepareT(
      "Dans cette série, celle ou celui qui pratique ce métier au quotidien vous l'explique.",
    ),
    image: ohMyJobPreviewImage,
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Oh My Job!',
    url: 'https://www.welcometothejungle.co/collections/metiers',
  },
  {
    description: prepareT("Des vidéos humoristiques sur 9 métiers d'avenir"),
    image: monMetierEnVraiPreviewImage,
    section: prepareT("Vidéos sur des métiers d'avenir"),
    title: 'Mon métier en vrai',
    url: 'https://www.youtube.com/playlist?list=PL44SpMa9ShRDa9gcFfhHhSDdXUnR3YCkm',
  },
  {
    creator: 'La Fondation Culture & Diversité',
    description: prepareT("Découverte des métiers de l'art et de la culture."),
    image: cultureDiversitePreviewImage,
    section: prepareT('Vidéos sur des métiers de la culture'),
    title: "Je m'oriente",
    url: 'http://www.fondationcultureetdiversite.org/je-moriente',
  },
  {
    creator: "La Semaine de l'Industrie",
    description: prepareT("Découverte des métiers de l'industrie par des Youtubeurs."),
    image: semaineIndustriePreviewImage,
    section: prepareT("Vidéos sur des métiers de l'industrie"),
    title: 'Jobs inattendus',
    url: 'https://www.semaine-industrie.gouv.fr/jobsinattendus',
  },
] as const


const JOB_VIDEO_SECTIONS = Object.entries(_groupBy(JOB_VIDEO_SITES, 'section')).
  map(([title, sites]): Omit<JobVideoSectionProps, 't'> =>
    ({sites: sites as readonly JobVideoSite[], title: title as LocalizableString}))


interface JobVideoCardsProps extends JobVideoSectionProps {
  style?: React.CSSProperties
}


const titleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 16 : 18,
  fontWeight: 'bold',
  marginBottom: 15,
}
const cardStyle = {
  marginBottom: 40,
}


const JobVideoCardsBase = (props: JobVideoCardsProps): React.ReactElement => {
  const {sites, style, t, t: translate, title} = props
  return <div style={style}>
    <div style={titleStyle}>{translate(title)}</div>
    <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between'}}>
      {sites.map(({creator, description, title, ...site}): React.ReactNode => <CardWithImage
        key={site.url} description={translate(description)}
        title={creator ? t('{{title}} par {{creator}}', {creator, title}) : title} {...site}
        // TODO(cyrille) avoid bottom margin on last row.
        style={cardStyle} />)}
    </div>
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
  return <MethodSuggestionList title={title} style={handicapIdeasStyle}>
    <ExpandableAction
      onContentShown={handleExplore('tip')} isMethodSuggestion={true}
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
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="h'UP" discoverUrl="https://h-up.fr/">
      {t("Se renseigner sur l'entrepreunariat")}
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="ANDI" discoverUrl="https://andi.beta.gouv.fr/">
      {t('Faire une immersion en entreprise')}
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="Salon Handicap" discoverUrl="https://www.salonhandicap.com/videos/">
      {t('Se renseigner sur les parcours possibles')}
    </ActionWithHandyLink>
  </MethodSuggestionList>
}


const ExploreOtherJobsMethod = (props: CardProps): React.ReactElement => {
  return <React.Fragment>
    {props.profile.hasHandicap ? <HandicapIdeas {...props} /> : null}
    {JOB_VIDEO_SECTIONS.map((section: Omit<JobVideoSectionProps, 't'>): React.ReactNode =>
      <JobVideoCards key={section.title} {...section} t={props.t} />)}
  </React.Fragment>
}
const ExpandedAdviceCardContent = React.memo(ExploreOtherJobsMethod)


export default {ExpandedAdviceCardContent, Picto}
