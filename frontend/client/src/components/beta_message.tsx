import React, {useCallback, useState} from 'react'
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
  registeredAt?: string
}


interface MessageProps extends MessageConnectedProps {
  style?: React.CSSProperties
}


const BetaMessageBase: React.FC<MessageProps> = (props: MessageProps): React.ReactElement|null => {
  const {isLoggedIn, registeredAt, style} = props
  const [isHidden, setIsHidden] = useState(!!Storage.getItem(HAS_SEEN_BETA_BANNER))
  const handleCloseClick = useCallback((): void => {
    Storage.setItem(HAS_SEEN_BETA_BANNER, '1')
    setIsHidden(true)
  }, [setIsHidden])
  if (!isLoggedIn || isHidden || !registeredAt || registeredAt > '2017-01-30') {
    return null
  }
  const betaMessageBoxStyle: React.CSSProperties = {
    background: colors.BOB_BLUE_HOVER,
    color: '#fff',
    ...style,
  }
  const linkStyle: React.CSSProperties = {
    color: '#fff',
    fontWeight: 'bold',
  }
  return <Banner
    hasRoundButton={isMobileVersion}
    style={betaMessageBoxStyle} onClose={handleCloseClick}>
    Grâce à vos retours la nouvelle version de {config.productName} est
    désormais disponible&nbsp;! Si certaines fonctionnalités de l'ancienne
    version vous manquent, n'hésitez pas à nous le signaler en <ExternalLink
      style={linkStyle} href="https://bayes.typeform.com/to/ZHuGiM"
    >cliquant ici</ExternalLink>.
  </Banner>
}
BetaMessageBase.propTypes = {
  isLoggedIn: PropTypes.bool,
  registeredAt: PropTypes.string,
  style: PropTypes.object,
}
const BetaMessage = connect(({user}: RootState): MessageConnectedProps => ({
  isLoggedIn: !!user.userId,
  registeredAt: user.registeredAt,
}))(React.memo(BetaMessageBase))


export {BetaMessage}
