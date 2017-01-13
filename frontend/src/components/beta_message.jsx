import React from 'react'
import {connect} from 'react-redux'
import Cookies from 'js-cookie'

import {setUserProfile} from 'store/actions'

import {Colors, Icon, RoundButton} from './theme'

const HAS_SEEN_BETA_BANNER = 'has-seen-beta-banner'

// TODO(pascal): Factorize with the CookieMessage banner.
class BetaMessageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isLoggedIn: React.PropTypes.bool,
    isMobileVersion: React.PropTypes.bool.isRequired,
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
    const {isLoggedIn, isMobileVersion} = this.props
    const {isHidden, isExpanded} = this.state
    if (!isLoggedIn || isHidden) {
      return null
    }
    const betaMessageBoxStyle = {
      background: Colors.SKY_BLUE_HOVER,
      color: '#fff',
      display: 'flex',
      fontSize: 15,
      textAlign: 'center',
      ...this.props.style,
    }
    // TODO: Make sure button is not covered by text on narrow screens (also on cookie message).
    const buttonStyle = {
      alignSelf: 'flex-start',
      bottom: isMobileVersion ? 5 : 'initial',
      marginRight: isMobileVersion ? 5 : 15,
      marginTop: isMobileVersion ? 'initial' : 15,
      padding: isMobileVersion ? '6px 6px 4px' : '8px 22px 6px 16px',
    }
    const closeIconStyle = {
      fontSize: 20,
      paddingBottom: 2,
      paddingRight: isMobileVersion ? 'initial' : '.5em',
      verticalAlign: 'middle',
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
    return <div style={betaMessageBoxStyle}>
      <div style={{flex: 1, margin: 'auto', maxWidth: 900, padding: 15}}>
        Cette application est en version bêta : tout ne marche pas encore parfaitement !<br />
        {!isExpanded ? <span>
          Si vous êtes partant pour nous aider à améliorer Bob Emploi en nous
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
      </div>
      <RoundButton
          type="navigationOnImage" style={buttonStyle}
          onClick={this.handleCloseClick}>
        <Icon style={closeIconStyle} name="close" /> {isMobileVersion ? null : 'Fermer'}
      </RoundButton>
    </div>
  }
}
const BetaMessage = connect(({app, user}) => ({
  isLoggedIn: !!user.userId,
  isMobileVersion: app.isMobileVersion,
}))(BetaMessageBase)

export {BetaMessage}
