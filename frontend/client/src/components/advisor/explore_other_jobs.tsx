import _groupBy from 'lodash/groupBy'
import React from 'react'

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


type CardWithImageProps = React.ComponentProps<typeof CardWithImage>


interface JobVideoSection {
  sites: CardWithImageProps[]
  title: string
}


const JOB_VIDEO_SITES = [
  {
    description: 'Plus de 2000 vidéos pour explorer des métiers.',
    image: onisepPreviewImage,
    section: 'Vidéos sur tous types de métiers',
    title: "Ce sera moi\u00A0! par l'ONISEP",
    url: 'https://oniseptv.onisep.fr',
  },
  {
    description: 'Chaîne YouTube suisse avec des centaines de vidéos sur des métiers et sur ' +
    "l'orientation.",
    image: zoomSurLesMetiersPreviewImage,
    section: 'Vidéos sur tous types de métiers',
    title: 'Zoom sur les métiers',
    url: 'https://www.youtube.com/user/zoomsurlesmetiers/videos',
  },
  {
    description: 'Chaine YouTube avec plus de 2000 vidéos pour découvrir des métiers.',
    image: placeDesMetiersPreviewImage,
    section: 'Vidéos sur tous types de métiers',
    title: 'La Place des Métiers',
    url: 'https://www.youtube.com/channel/UCQ7LCRNS1os00PP7_WRZIAg/playlists',
  },
  {
    description: "200 vidéos (en version gratuite) sur les métiers d'avenir.",
    image: canalDesMetiersPreviewImage,
    section: "Vidéos sur des métiers d'avenir",
    title: 'Le Canal des Métiers',
    url: 'https://www.lecanaldesmetiers.tv',
  },
  {
    description: 'Dans cette série, celle ou celui qui pratique ce métier au quotidien vous ' +
      "l'explique.",
    image: ohMyJobPreviewImage,
    section: "Vidéos sur des métiers d'avenir",
    title: 'Oh My Job! par Welcome to the Jungle',
    url: 'https://www.welcometothejungle.co/collections/metiers',
  },
  {
    descriptif: "Des vidéos humoristiques sur 9 métiers d'avenir",
    image: monMetierEnVraiPreviewImage,
    section: "Vidéos sur des métiers d'avenir",
    title: 'Mon métier en vrai',
    url: 'https://www.youtube.com/playlist?list=PL44SpMa9ShRDa9gcFfhHhSDdXUnR3YCkm',
  },
  {
    description: "Découverte des métiers de l'art et de la culture.",
    image: cultureDiversitePreviewImage,
    section: 'Vidéos sur des métiers de la culture',
    title: "Je m'oriente par La Fondation Culture & Diversité",
    url: 'http://www.fondationcultureetdiversite.org/je-moriente',
  },
  {
    description: "Découverte des métiers de l'industrie par des Youtubeurs.",
    image: semaineIndustriePreviewImage,
    section: "Vidéos sur des métiers de l'industrie",
    title: "Jobs inattendus par La Semaine de l'Industrie",
    url: 'https://www.semaine-industrie.gouv.fr/jobsinattendus',
  },
]


const JOB_VIDEO_SECTIONS = Object.entries(_groupBy(JOB_VIDEO_SITES, 'section')).
  map(([title, sites]): JobVideoSection =>
    ({sites: sites as CardWithImageProps[], title: title as string}))


class JobVideoCards extends React.Component<JobVideoSection & {style?: React.CSSProperties}> {
  public render(): React.ReactNode {
    const {sites, style, title} = this.props
    const titleStyle: React.CSSProperties = {
      fontSize: isMobileVersion ? 16 : 18,
      fontWeight: 'bold',
      marginBottom: 15,
    }
    return <div style={style}>
      <div style={titleStyle}>{title}</div>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between'}}>
        {sites.map((site): React.ReactNode => <CardWithImage
          key={site.url} {...site}
          // TODO(cyrille) avoid bottom margin on last row.
          style={{marginBottom: 40}} />)}
      </div>
    </div>
  }
}


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

const HandicapIdeas: React.FC<CardProps> = ({handleExplore, userYou}: CardProps):
React.ReactElement => {
  const title = <React.Fragment>
    <GrowingNumber number={4} isSteady={true} /> idées pour définir son projet
  </React.Fragment>
  return <MethodSuggestionList title={title} style={handicapIdeasStyle}>
    <ExpandableAction
      onContentShown={handleExplore('tip')} isMethodSuggestion={true}
      title="Se faire accompagner" contentName="l'astuce">
      <div style={actionContentStyle}>
        Nos amis chez Hanploi nous conseillent&nbsp;:
        <blockquote style={quoteStyle}>
          <p>
            Pas la peine de postuler tous azimuts, si {userYou("tu n'as", "vous n'avez")} pas
            défini {userYou('ton', 'votre')} nouveau projet professionnel.
          </p>
          <p>
            Pose{userYou('-toi', 'z-vous')} avec un conseiller
            et met{userYou('s tes', 'tez vos')} compétences à plat. Certaines sont transférables
            dans d'autres métiers.
          </p>
          <p>
            Hanploi<br />
            01 44 52 40 69<br />
            Du lundi au vendredi,<br />
            de 9h30 à 13h et de 14h à 17h30
          </p>
        </blockquote>
      </div>
    </ExpandableAction>
    <ActionWithHandyLink
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="h'UP" discoverUrl="https://h-up.fr/">
      Se renseigner sur l'entrepreunariat
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="ANDI" discoverUrl="https://andi.beta.gouv.fr/">
      Faire une immersion en entreprise
    </ActionWithHandyLink>
    <ActionWithHandyLink
      onClick={handleExplore('link')} isNotClickable={true}
      linkName="Salon Handicap" discoverUrl="https://www.salonhandicap.com/videos/">
      Se renseigner sur les parcours possibles
    </ActionWithHandyLink>
  </MethodSuggestionList>
}


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      {this.props.profile.hasHandicap ? <HandicapIdeas {...this.props} /> : null}
      {JOB_VIDEO_SECTIONS.map((section: JobVideoSection): React.ReactNode =>
        <JobVideoCards key={section.title} {...section} />)}
    </React.Fragment>
  }
}


export default {ExpandedAdviceCardContent, Picto}
