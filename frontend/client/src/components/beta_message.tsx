import React, {useCallback, useState} from 'react'
import PropTypes from 'prop-types'
import {useSelector} from 'react-redux'
import Storage from 'local-storage-fallback'

import {RootState} from 'store/actions'

import {Banner} from './banner'
import {isMobileVersion} from './mobile'
import {ExternalLink} from './theme'


const HAS_SEEN_BETA_BANNER = 'has-seen-2-beta-banner'


interface MessageProps {
  style?: React.CSSProperties
}


const BetaMessageBase: React.FC<MessageProps> = ({style}: MessageProps):
React.ReactElement|null => {
  const [isHidden, setIsHidden] = useState(!!Storage.getItem(HAS_SEEN_BETA_BANNER))
  const isLoggedIn = useSelector(({user}: RootState): boolean => !!user.userId)
  const registeredAt = useSelector(({user}: RootState): string|undefined => user.registeredAt)
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
  style: PropTypes.object,
}
const BetaMessage = React.memo(BetaMessageBase)


export {BetaMessage}
