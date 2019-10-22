import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'

import {ofPrefix} from 'store/french'

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


const ofPlatformName = (name): string => {
  const {modifiedName, prefix} = ofPrefix(name)
  return `${prefix}${modifiedName}`
}


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    handleExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private handleExplorePlatform = _memoize((link: string): (() => void) => (): void => {
    window.open(link, '_blank')
    this.props.handleExplore('platform')()
  })

  private renderPlatforms(): React.ReactNode {
    const platformStyle = {
    }
    return <AdviceSuggestionList>
      {platforms.map(({link, name, price}): ReactStylableElement => <div
        key={`platform-${name}`} style={platformStyle}
        onClick={this.handleExplorePlatform(link)}>
        <span>{name} &mdash; {price ? `${price}\u00A0€` : 'GRATUIT'}</span>
        <span style={{flex: 1}} />
        <span>Aller sur le site {ofPlatformName(name)}</span>
      </div>)}
    </AdviceSuggestionList>
  }

  public render(): React.ReactNode {
    const {userYou} = this.props
    return <div>
      <div style={{marginBottom: 35}}>
        <p>
          Attaque{userYou('-toi', 'z-vous')} à la première étape du permis de conduire&nbsp;: la
          révision du code en ligne.
        </p>
        <p>
          J'ai sélectionné <GrowingNumber
            style={{fontWeight: 'bold'}} number={3} isSteady={true} /> plateformes
          (j'ai aussi inclus des services payants, simplement parce que je les trouve
          bien et pas très chers comparés aux autres options).
        </p>
      </div>
      {this.renderPlatforms()}
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
