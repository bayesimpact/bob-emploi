import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {useTranslation} from 'react-i18next'

import isMobileVersion from 'store/mobile'

import Button from 'components/button'


interface BannerProps {
  children?: React.ReactNode
  hasRoundButton?: boolean
  onClose: () => void
  style?: React.CSSProperties
}

const Banner: React.FC<BannerProps> = (props: BannerProps): React.ReactElement => {
  const {children, hasRoundButton = false, onClose, style} = props
  const {t} = useTranslation()
  const boxStyle: React.CSSProperties = {
    display: 'flex',
    fontSize: 14,
    textAlign: 'center',
    ...style,
  }
  const buttonStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    bottom: isMobileVersion ? 5 : 'initial',
    marginRight: isMobileVersion ? 5 : 15,
    marginTop: isMobileVersion ? 5 : 15,
    padding: hasRoundButton ? '6px 6px 6px' :
      isMobileVersion ? '6px 6px 4px' : '9px 22px 5px 16px',
  }
  const closeIconStyle: React.CSSProperties = {
    fill: '#fff',
    height: 24,
    paddingBottom: hasRoundButton ? 0 : 3,
    paddingRight: isMobileVersion ? 'initial' : 10,
    verticalAlign: 'middle',
    width: hasRoundButton ? 24 : 30,
  }
  return <aside style={boxStyle}>
    <div style={{flex: 1}}>
      <div style={{margin: 'auto', maxWidth: 900, padding: 15}}>
        {children}
      </div>
    </div>
    <Button
      type="navigationOnImage" style={buttonStyle} onClick={onClose}
      isNarrow={hasRoundButton} isRound={hasRoundButton}
      aria-label={t('Fermer')}>
      <CloseIcon style={closeIconStyle} /> {isMobileVersion ? null : t('Fermer')}
    </Button>
  </aside>
}
Banner.propTypes = {
  children: PropTypes.node,
  hasRoundButton: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  style: PropTypes.object,
}

export default React.memo(Banner)
