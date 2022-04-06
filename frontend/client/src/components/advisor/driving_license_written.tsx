import type {TFunction} from 'i18next'
import React, {useMemo} from 'react'

import {ofPrefix} from 'store/french'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-driving-license.svg'

import type {CardProps} from './base'
import {MethodSuggestionList} from './base'

const platforms = [
  {
    link: 'https://www.codedelaroute.fr', // checkURL
    name: 'DigiSchool',
  },
  {
    link: 'https://www.ornikar.com/code', // checkURL
    name: 'Ornikar',
    price: 30,
  },
  {
    link: 'https://www.auto-ecole.net/code-de-la-route', // checkURL
    name: 'Auto-école.net',
    price: 58,
  },
] as const


const ofPlatformName = (name: string, t: TFunction): string => {
  const {modifiedName, prefix} = ofPrefix(name, t)
  return `${prefix}${modifiedName}`
}


const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'inherit',
} as const


interface PlatformLinkProps {
  onClick: () => void
  link: string
  name: string
  price?: number
  style?: React.CSSProperties
  t: TFunction
}

const PlatformLinkBase = (props: PlatformLinkProps): React.ReactElement => {
  const {onClick, link, name, price, style, t} = props
  return <ExternalLink href={link} onClick={onClick} style={style}>
    <span>{name} </span>
    <span style={{color: colors.WARM_GREY, fontStyle: 'italic', fontWeight: 'normal'}}>
      &mdash; {price ? `${price}\u00A0€` : t('GRATUIT')}
    </span>
    <span style={{flex: 1}} />
    <Trans parent="span" t={t} tOptions={{platform: name}}>
      Aller sur le site {{ofPlatform: ofPlatformName(name, t)}}
    </Trans>
  </ExternalLink>
}
const PlatformLink = React.memo(PlatformLinkBase)


const DrivingLicenseWritten = (props: CardProps): React.ReactElement => {
  const {handleExplore, t} = props

  const handleExplorePlatform = useMemo(() => handleExplore('platform'), [handleExplore])

  const title = <Trans parent={null} t={t}>
    <GrowingNumber number={3} isSteady={true} /> sites pour réviser le code en ligne
  </Trans>
  const subtitle = t(
    "J'ai aussi inclus des services payants, simplement parce que je les trouve bien et pas très " +
    'chers comparés aux autres options.',
  )
  return <div>
    <div style={{marginBottom: 35}}>
      <p>
        {t(
          'Attaquez-vous à la première étape du permis de conduire\u00A0: la révision du code ' +
          'en ligne.',
        )}
      </p>
    </div>
    <MethodSuggestionList title={title} subtitle={subtitle}>
      {platforms.map((platform): ReactStylableElement => <PlatformLink
        key={`platform-${platform.name}`}
        onClick={handleExplorePlatform} {...platform} t={t} style={linkStyle} />)}
    </MethodSuggestionList>
  </div>
}
const ExpandedAdviceCardContent = React.memo(DrivingLicenseWritten)


export default {ExpandedAdviceCardContent, Picto}
