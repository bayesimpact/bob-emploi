import PropTypes from 'prop-types'
import React from 'react'
import {useTranslation} from 'react-i18next'

import {StaticPage, TitleSection} from 'components/static'
import {ExternalLink, MAX_CONTENT_WIDTH} from 'components/theme'
import adieImage from 'images/partners/adie.svg'
import avrilImage from 'images/partners/avril.svg'
import hanploiImage from 'images/partners/hanploi.png'
import laBonneAlternanceImage from 'images/partners/la-bonne-alternance.png'
import laBonneBoiteImage from 'images/partners/la-bonne-boite.jpg'
import missionLocaleEpinaySurSeineImage from 'images/partners/mission-locale-epinay-sur-seine.png'
import sncImage from 'images/partners/snc.png'
import tousBenevolesImage from 'images/partners/tous-benevoles.png'
import viensVoirMonTafImage from 'images/partners/viens-voir-mon-taf.png'
import waltImage from 'images/partners/walt.png'


const partners = [
  {
    image: sncImage,
    name: 'SNC',
    url: 'https://snc.asso.fr/',
  },
  {
    image: waltImage,
    name: 'Walt',
    url: 'https://walt.community/home-alternant',
  },
  {
    image: tousBenevolesImage,
    name: 'Tous bénévoles',
    url: 'https://www.tousbenevoles.org/',
  },
  {
    image: viensVoirMonTafImage,
    name: 'Viens voir mon taf',
    url: 'https://www.viensvoirmontaf.fr/',
  },
  {
    image: hanploiImage,
    name: 'Hanploi',
    url: 'https://www.hanploi.com/',
  },
  {
    image: laBonneBoiteImage,
    name: 'La Bonne Boîte',
    url: 'https://labonneboite.pole-emploi.fr/',
  },
  {
    image: laBonneAlternanceImage,
    name: 'La Bonne Alternance',
    url: 'https://labonnealternance.pole-emploi.fr/',
  },
  {
    image: avrilImage,
    name: 'Avril la VAE facile',
    url: 'https://avril.pole-emploi.fr/',
  },
  {
    image: adieImage,
    name: "l'ADIE",
    url: 'https://www.adie.org/',
  },
  {
    image: missionLocaleEpinaySurSeineImage,
    name: 'Mission locale Épinay-sur-Seine',
    url: 'http://www.miij.fr/',
  },
]


interface PartnerProps {
  image: string
  name: string
  url: string
}


const partnerCardContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  boxShadow: '0 15px 35px 0 rgba(14, 58, 91, 0.1)',
  display: 'flex',
  height: 170,
  margin: '0 15px 30px',
  width: 220,
} as const
const parnerCardImgStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 auto',
  maxHeight: 150,
  maxWidth: 200,
} as const

const PartnerCardBase = ({image, name, url}: PartnerProps): React.ReactElement =>
  <ExternalLink style={partnerCardContainerStyle} href={url}>
    <img src={image} alt={name} title={name} style={parnerCardImgStyle} />
  </ExternalLink>
PartnerCardBase.propTypes = {
  image: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
}
const PartnerCard = React.memo(PartnerCardBase)


const pageStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: 50,
}
const partnersContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  margin: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
}


const PartnersPage = (): React.ReactElement => {
  const {t} = useTranslation()
  return <StaticPage page="partners" isContentScrollable={false}>
    <TitleSection pageContent={{title: t('Nos partenaires sont des experts du terrain')}} />
    <div style={pageStyle}>
      <div style={partnersContainerStyle}>
        {partners.map((partner): React.ReactNode =>
          <PartnerCard {...partner} key={partner.name} />)}
      </div>
    </div>
  </StaticPage>
}
export default React.memo(PartnersPage)
