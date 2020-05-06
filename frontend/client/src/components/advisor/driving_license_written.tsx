import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import {ofPrefix} from 'store/french'

import {Trans} from 'components/i18n'
import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-driving-license.svg'

import {AdviceSuggestionList, CardProps} from './base'

const platforms = [
  {
    link: 'https://www.codedelaroute.fr',
    name: 'DigiSchool',
  },
  {
    link: 'https://www.ornikar.com/code',
    name: 'Ornikar',
    price: 30,
  },
  {
    link: 'https://www.auto-ecole.net/code-de-la-route',
    name: 'Auto-école.net',
    price: 58,
  },
]


const ofPlatformName = (name: string, t?: TFunction): string => {
  const {modifiedName, prefix} = ofPrefix(name, t)
  return `${prefix}${modifiedName}`
}


interface PlatformProps {
  onClick: () => void
  link: string
  name: string
  price?: number
  t: TFunction
}

const PlatformBase = (props: PlatformProps): React.ReactElement => {
  const {onClick, link, name, price, t} = props
  const handleClick = useCallback((): void => {
    window.open(link, '_blank')
    onClick()
  }, [link, onClick])
  return <div
    onClick={handleClick}>
    <span>{name} &mdash; {price ? `${price}\u00A0€` : t('GRATUIT')}</span>
    <span style={{flex: 1}} />
    <Trans parent="span" t={t} tOptions={{platform: name}}>
      Aller sur le site {{ofPlatform: ofPlatformName(name)}}
    </Trans>
  </div>
}
const Platform = React.memo(PlatformBase)


const DrivingLicenseWritten = (props: CardProps): React.ReactElement => {
  const {handleExplore, t} = props

  const handleExplorePlatform = useMemo(() => handleExplore('platform'), [handleExplore])

  return <div>
    <div style={{marginBottom: 35}}>
      <p>
        {t(
          'Attaquez-vous à la première étape du permis de conduire\u00A0: la révision du code ' +
          'en ligne.',
        )}
      </p>
      <Trans parent="p" t={t}>
        J'ai sélectionné <GrowingNumber
          style={{fontWeight: 'bold'}} number={3} isSteady={true} /> plateformes
        (j'ai aussi inclus des services payants, simplement parce que je les trouve
        bien et pas très chers comparés aux autres options).
      </Trans>
    </div>
    <AdviceSuggestionList>
      {platforms.map((platform): ReactStylableElement => <Platform
        key={`platform-${platform.name}`}
        onClick={handleExplorePlatform} {...platform} t={t} />)}
    </AdviceSuggestionList>
  </div>
}
DrivingLicenseWritten.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(DrivingLicenseWritten)


export default {ExpandedAdviceCardContent, Picto}
