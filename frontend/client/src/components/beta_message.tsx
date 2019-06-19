import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import Storage from 'local-storage-fallback'

import {RootState} from 'store/actions'

import {Banner} from './banner'
import {isMobileVersion} from './mobile'
import {ExternalLink} from './theme'


const HAS_SEEN_BETA_BANNER = 'has-seen-2-beta-banner'


interface MessageConnectedProps {
  isLoggedIn: boolean
  registeredAt: string
}


interface MessageProps extends MessageConnectedProps {
  style?: React.CSSProperties
}


interface MessageState {
  isHidden: boolean
}


class BetaMessageBase extends React.PureComponent<MessageProps, MessageState> {
  public static propTypes = {
    isLoggedIn: PropTypes.bool,
    registeredAt: PropTypes.string,
    style: PropTypes.object,
  }

  public state = {
    isHidden: !!Storage.getItem(HAS_SEEN_BETA_BANNER),
  }

  private handleCloseClick = (): void => {
    Storage.setItem(HAS_SEEN_BETA_BANNER, '1')
    this.setState({isHidden: true})
  }

  public render(): React.ReactNode {
    const {isLoggedIn, registeredAt} = this.props
    const {isHidden} = this.state
    if (!isLoggedIn || isHidden || registeredAt > '2017-01-30') {
      return null
    }
    const betaMessageBoxStyle: React.CSSProperties = {
      background: colors.BOB_BLUE_HOVER,
      color: '#fff',
      ...this.props.style,
    }
    const linkStyle: React.CSSProperties = {
      color: '#fff',
      fontWeight: 'bold',
    }
    return <Banner
      hasRoundButton={isMobileVersion}
      style={betaMessageBoxStyle} onClose={this.handleCloseClick}>
      Grâce à vos retours la nouvelle version de {config.productName} est
      désormais disponible&nbsp;! Si certaines fonctionnalités de l'ancienne
      version vous manquent, n'hésitez pas à nous le signaler en <ExternalLink
        style={linkStyle} href="https://bayes.typeform.com/to/ZHuGiM"
      >cliquant ici</ExternalLink>.
    </Banner>
  }
}
const BetaMessage = connect(({user}: RootState): MessageConnectedProps => ({
  isLoggedIn: !!user.userId,
  registeredAt: user.registeredAt,
}))(BetaMessageBase)


export {BetaMessage}
