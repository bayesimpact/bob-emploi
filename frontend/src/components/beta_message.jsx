import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import Cookies from 'js-cookie'

import {Banner} from './banner'
import {ExternalLink} from './theme'

const HAS_SEEN_BETA_BANNER = 'has-seen-2-beta-banner'

class BetaMessageBase extends React.Component {
  static propTypes = {
    isLoggedIn: PropTypes.bool,
    registeredAt: PropTypes.string,
    style: PropTypes.object,
  }

  state = {
    isHidden: Cookies.get(HAS_SEEN_BETA_BANNER),
  }

  handleCloseClick = () => {
    Cookies.set(HAS_SEEN_BETA_BANNER, '1')
    this.setState({isHidden: true})
  }

  render() {
    const {isLoggedIn, registeredAt} = this.props
    const {isHidden} = this.state
    if (!isLoggedIn || isHidden || registeredAt > '2017-01-30') {
      return null
    }
    const betaMessageBoxStyle = {
      background: colors.BOB_BLUE_HOVER,
      color: '#fff',
      ...this.props.style,
    }
    const linkStyle = {
      color: '#fff',
      fontWeight: 'bold',
    }
    return <Banner style={betaMessageBoxStyle} onClose={this.handleCloseClick}>
      Grâce à vos retours la nouvelle version de {config.productName} est
      désormais disponible&nbsp;! Si certaines fonctionnalités de l'ancienne
      version vous manquent, n'hésitez pas à nous le signaler en <ExternalLink
        style={linkStyle} href="https://bayes.typeform.com/to/ZHuGiM"
      >cliquant ici</ExternalLink>.
    </Banner>
  }
}
const BetaMessage = connect(({user}) => ({
  isLoggedIn: !!user.userId,
  registeredAt: user.registeredAt,
}))(BetaMessageBase)

export {BetaMessage}
