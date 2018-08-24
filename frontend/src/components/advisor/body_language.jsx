import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import Picto from 'images/advices/picto-body-language.png'


class AdviceCard extends React.Component {
  static propTypes = {
    fontSize: PropTypes.number,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {fontSize, userYou} = this.props
    return <div style={{fontSize: fontSize || 'initial'}}>
      En entretien {userYou('ton', 'votre')} <strong>langage corporel</strong> parle autant
      que {userYou('tes', 'vos')} paroles.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {

  render() {
    const coverallStyle = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    // TODO(pascal): Call onExplore when embedded video is played.
    return <div style={{margin: 'auto', maxWidth: 854}}>
      <div style={{height: 0, paddingBottom: '56.25%', position: 'relative'}}>
        <iframe
          src="https://embed.ted.com/talks/lang/fr/amy_cuddy_your_body_language_shapes_who_you_are"
          width={isMobileVersion ? 300 : 854} height={isMobileVersion ? 200 : 480}
          style={coverallStyle} frameBorder={0} scrolling="no" allowFullScreen={true} />
      </div>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
