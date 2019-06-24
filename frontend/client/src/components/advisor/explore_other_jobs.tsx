import _groupBy from 'lodash/groupBy'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import canalDesMetiersPreviewImage from 'images/advices/explore-other-jobs/canaldesmetiers.jpg'
import cultureDiversitePreviewImage from 'images/advices/explore-other-jobs/cultureetdiversite.jpg'
import monMetierEnVraiPreviewImage from 'images/advices/explore-other-jobs/monmetierenvrai.jpg'
import ohMyJobPreviewImage from 'images/advices/explore-other-jobs/ohmyjob.jpg'
import onisepPreviewImage from 'images/advices/explore-other-jobs/onisep.jpg'
import placeDesMetiersPreviewImage from 'images/advices/explore-other-jobs/placedesmetiers.jpg'
import semaineIndustriePreviewImage from 'images/advices/explore-other-jobs/semaineindustrie.jpg'
import zoomSurLesMetiersPreviewImage from 'images/advices/explore-other-jobs/zoomsurlesmetiers.jpg'
import NewPicto from 'images/advices/picto-explore-other-jobs.svg'

import {CardProps, CardWithImage} from './base'


type CardWithImageProps = React.ComponentProps<typeof CardWithImage>


interface JobVideoSite extends CardWithImageProps {
  description: string
  image: string
  section: string
  title: string
  url: string
}


interface JobVideoSection {
  sites: CardWithImageProps[]
  title: string
}


const JOB_VIDEO_SITES = [
  {
    description: 'Plus de 2000 vidéos pour explorer des métiers.',
    image: onisepPreviewImage,
    section: 'Tous types de métiers',
    title: "Ce sera moi\u00A0! par l'ONISEP",
    url: 'https://oniseptv.onisep.fr',
  },
  {
    description: 'Chaîne YouTube suisse avec des centaines de vidéos sur des métiers et sur ' +
    "l'orientation.",
    image: zoomSurLesMetiersPreviewImage,
    section: 'Tous types de métiers',
    title: 'Zoom sur les métiers',
    url: 'https://www.youtube.com/user/zoomsurlesmetiers/videos',
  },
  {
    description: 'Chaine YouTube avec plus de 2000 vidéos pour découvrir des métiers.',
    image: placeDesMetiersPreviewImage,
    section: 'Tous types de métiers',
    title: 'La Place des Métiers',
    url: 'https://www.youtube.com/channel/UCQ7LCRNS1os00PP7_WRZIAg/playlists',
  },
  {
    description: "200 vidéos (en version gratuite) sur les métiers d'avenir.",
    image: canalDesMetiersPreviewImage,
    section: "Métiers d'avenir",
    title: 'Le Canal des Métiers',
    url: 'https://www.lecanaldesmetiers.tv',
  },
  {
    description: 'Dans cette série, celle ou celui qui pratique ce métier au quotidien vous ' +
      "l'explique.",
    image: ohMyJobPreviewImage,
    section: "Métiers d'avenir",
    title: 'Oh My Job! par Welcome to the Jungle',
    url: 'https://www.welcometothejungle.co/collections/metiers',
  },
  {
    descriptif: "Des vidéos humoristiques sur 9 métiers d'avenir",
    image: monMetierEnVraiPreviewImage,
    section: "Métiers d'avenir",
    title: 'Mon métier en vrai',
    url: 'https://www.youtube.com/playlist?list=PL44SpMa9ShRDa9gcFfhHhSDdXUnR3YCkm',
  },
  {
    description: "Découverte des métiers de l'art et de la culture.",
    image: cultureDiversitePreviewImage,
    section: 'Métiers de la culture',
    title: "Je m'oriente par La Fondation Culture & Diversité",
    url: 'http://www.fondationcultureetdiversite.org/je-moriente',
  },
  {
    description: "Découverte des métiers de l'industrie par des Youtubeurs.",
    image: semaineIndustriePreviewImage,
    section: "Métiers de l'industrie",
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


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      {JOB_VIDEO_SECTIONS.map((section: JobVideoSection): React.ReactNode =>
        <JobVideoCards key={section.title} {...section} />)}
    </React.Fragment>
  }
}


const TakeAway = '5000 vidéos trouvées'


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
