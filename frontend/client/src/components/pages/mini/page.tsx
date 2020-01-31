import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {connect} from 'react-redux'

import {ExternalLink} from 'components/theme'
import aliLogo from 'images/mini/logo-ali.svg'
import bobLogo from 'images/mini/bob_blue_transparent.png'
import rmlLogo from 'images/mini/RML_logo_verti_rvb.png'

import {SaveButton} from './save'
import {MiniRootState} from './store'


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


interface GenericPageProps {
  bottomButton?: React.ReactNode
  children?: React.ReactNode
  footerSize?: number
  hasLogo?: boolean
  style?: React.CSSProperties
}

interface ConnectedGenericPageProps {
  hasUserData: boolean
}

type PageProps = GenericPageProps & ConnectedGenericPageProps


const GenericPageBase: React.FC<PageProps> = (props: PageProps): React.ReactElement => {
  const {bottomButton, children, footerSize = 150, hasLogo, hasUserData, style} = props
  const pageStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: colors.MINI_BACKGROUND_GREY,
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
            href="https://www.bob-emploi.fr/?utm_source=a-li&amp;utm_medium=app">
            <img src={bobLogo} style={bobLogoStyle} alt={config.productName} />
          </ExternalLink>
        </span>
      </div>
    </div>
  </div>
}
GenericPageBase.propTypes = {
  bottomButton: PropTypes.node,
  children: PropTypes.node,
  footerSize: PropTypes.number,
  hasLogo: PropTypes.bool,
  hasUserData: PropTypes.bool.isRequired,
  style: PropTypes.object,
}
const GenericPage = connect(({user: {answers, priorities}}: MiniRootState):
ConnectedGenericPageProps => ({
  hasUserData: !!(Object.keys(answers).length || Object.keys(priorities).length),
}))(React.memo(GenericPageBase))


export {GenericPage}
