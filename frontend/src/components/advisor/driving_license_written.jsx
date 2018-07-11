import PropTypes from 'prop-types'
import React from 'react'

import {ofPrefix} from 'store/french'

import {GrowingNumber, PaddedOnMobile} from 'components/theme'
import Picto from 'images/advices/picto-driving-license-written.png'

import {AdviceSuggestionList} from './base'

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


const ofPlatformName = (name) => {
  const {modifiedName, prefix} = ofPrefix(name)
  return `${prefix}${modifiedName}`
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderPlatforms() {
    const platformStyle = {
    }
    return <AdviceSuggestionList>
      {platforms.map(({link, name, price}) => <div key={`platform-${name}`} style={platformStyle}
        onClick={() => {
          window.open(link, '_blank')
          this.props.onExplore('platform')
        }}>
        <span>{name} &mdash; {price ? `${price}\u00A0€` : 'GRATUIT'}</span>
        <span style={{flex: 1}} />
        <span>Aller sur le site {ofPlatformName(name)}</span>
      </div>)}
    </AdviceSuggestionList>
  }

  render() {
    const {userYou} = this.props
    return <div style={{fontSize: 16}}>
      <PaddedOnMobile style={{marginBottom: 35}}>
        <p>
          Attaque{userYou('-toi', 'z-vous')} à la première étape du permis de conduire, grâce à des
          plateformes en ligne pour réviser le code.
        </p>
        <p>
          Nous avons sélectionné <GrowingNumber style={{fontWeight: 'bold'}}
            number={3} isSteady={true} /> plateformes (nous avons aussi inclus des services payants,
          simplement parce que nous les trouvons bien et pas très chers comparés aux autres
          options).
        </p>
      </PaddedOnMobile>
      {this.renderPlatforms()}
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
