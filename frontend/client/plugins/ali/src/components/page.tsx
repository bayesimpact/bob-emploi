import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {useSelector} from 'react-redux'

import ExternalLink from 'components/external_link'
import aliLogo from '../images/logo-ali.svg'
import bobLogo from '../images/bob_blue_transparent.png'
import rmlLogo from '../images/RML_logo_verti_rvb.png'

import SaveButton from './save_button'
import {MiniRootState} from '../store'


const saveButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 15,
  top: 15,
}
const logoContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 16,
  left: 15,
  position: 'absolute',
}
const rmlLogoStyle: React.CSSProperties = {
  height: 'auto',
  marginBottom: 8,
  width: 140,
}
const bobLogoContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
}
const bobLogoTextStyle: React.CSSProperties = {
  marginRight: '0.3em',
}
const bobLogoStyle: React.CSSProperties = {
  display: 'block',
  width: 35,
}

const logoStyle: React.CSSProperties = {
  left: 20,
  position: 'absolute',
  top: 20,
  width: 80,
}


interface PageProps {
  bottomButton?: React.ReactNode
  children?: React.ReactNode
  footerSize?: number
  hasLogo?: boolean
  style?: React.CSSProperties
}


const GenericPage: React.FC<PageProps> = (props: PageProps): React.ReactElement => {
  const hasUserData = useSelector(
    ({user: {answers, priorities}}: MiniRootState): boolean =>
      !!(Object.keys(answers).length || Object.keys(priorities).length),
  )
  const {bottomButton, children, footerSize = 150, hasLogo, style} = props
  const pageStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: colors.BACKGROUND_GREY,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    ...style,
  }), [style])
  const footerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: footerSize,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  }), [footerSize])
  return <div style={pageStyle}>
    {hasLogo ? <img style={logoStyle} src={aliLogo} alt="" /> : null}
    {hasUserData ? <SaveButton style={saveButtonStyle} /> : null}
    {children}
    <div style={footerStyle}>
      {bottomButton}
      <div style={logoContainerStyle}>
        <img style={rmlLogoStyle} src={rmlLogo} alt="" />
        <span style={bobLogoContainerStyle}>
          <div style={bobLogoTextStyle}>En partenariat avec</div>
          <ExternalLink
            href={`${config.canonicalUrl}/?utm_source=a-li&amp;utm_medium=app`}>
            <img src={bobLogo} style={bobLogoStyle} alt={config.productName} />
          </ExternalLink>
        </span>
      </div>
    </div>
  </div>
}
GenericPage.propTypes = {
  bottomButton: PropTypes.node,
  children: PropTypes.node,
  footerSize: PropTypes.number,
  hasLogo: PropTypes.bool,
  style: PropTypes.object,
}


export default React.memo(GenericPage)
