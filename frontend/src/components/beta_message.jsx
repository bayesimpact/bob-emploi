import React from 'react'
import {connect} from 'react-redux'
import Cookies from 'js-cookie'

import config from 'config'
import {setUserProfile} from 'store/actions'

import {Banner} from './banner'
import {Colors, RoundButton} from './theme'

const HAS_SEEN_BETA_BANNER = 'has-seen-beta-banner'

class BetaMessageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isLoggedIn: React.PropTypes.bool,
    style: React.PropTypes.object,
  }

  constructor(props) {
    super(props)
    this.state = {
      isExpanded: false,
      isHidden: Cookies.get(HAS_SEEN_BETA_BANNER),
    }
  }

  handleCloseClick = () => {
    Cookies.set(HAS_SEEN_BETA_BANNER, '1')
    this.setState({isHidden: true})
  }

  handleSubmitPhone = () => {
    const phoneNumber = this.refs.phoneNumber.value
    const feedbackMedium = this.refs.feedbackMedium.value
    this.props.dispatch(setUserProfile({feedbackMedium, phoneNumber}), true)
    this.handleCloseClick()
  }

  render() {
    const {isLoggedIn} = this.props
    const {isHidden, isExpanded} = this.state
    if (!isLoggedIn || isHidden) {
      return null
    }
    const betaMessageBoxStyle = {
      background: Colors.SKY_BLUE_HOVER,
      color: '#fff',
      ...this.props.style,
    }
    // TODO(pascal): Fix border color on hover.
    const inputStyle = {
      backgroundColor: 'transparent',
      color: '#fff',
      height: 40,
      lineHeight: '40px',
    }
    const optionStyle = {
      backgroundColor: Colors.SKY_BLUE_HOVER,
      color: '#fff',
    }
    return <Banner style={betaMessageBoxStyle} onClose={this.handleCloseClick}>
      Cette application est en version bêta : tout ne marche pas encore parfaitement !<br />
      {!isExpanded ? <span>
        Si vous êtes partant pour nous aider à améliorer {config.productName} en nous
        donnant votre avis par téléphone ou en personne, <a
            style={{cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}
            onClick={() => this.setState({isExpanded: true})}
            >laissez‑nous&nbsp;vos&nbsp;coordonnées</a>.
      </span> : <div style={{display: 'flex', margin: '40px 0'}}>
        <span style={{lineHeight: '41px'}}>
          Je suis disponible pour faire un retour
        </span>
        <div style={{display: 'flex', flexDirection: 'column', margin: '0 15px'}}>
          <select style={inputStyle} ref="feedbackMedium">
            <option value="PHONE" style={optionStyle}>par téléphone</option>
            <option value="ON_SITE" style={optionStyle}>en personne (à Paris ou Lyon)</option>
            <option value="PHONE_OR_ON_SITE" style={optionStyle}>
              par téléphone ou en personne
            </option>
          </select><br />
          <input style={inputStyle} ref="phoneNumber" />
        </div>
        <RoundButton
            type="navigationOnImage" style={{alignSelf: 'flex-end'}}
            onClick={this.handleSubmitPhone}>
          Valider
        </RoundButton>
      </div>}
    </Banner>
  }
}
const BetaMessage = connect(({user}) => ({isLoggedIn: !!user.userId}))(BetaMessageBase)

export {BetaMessage}
