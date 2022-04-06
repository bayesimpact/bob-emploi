import React, {useMemo} from 'react'
import {useSelector} from 'react-redux'

import ExternalLink from 'components/external_link'
import aliLogo from '../images/logo-ali.svg'
import bobLogo from '../images/bob_blue_transparent.png'
import rmlLogo from '../images/RML_logo_verti_rvb.png'

import SaveButton from './save_button'
import type {MiniRootState} from '../store'


const getFooterLineStyle = (color: string, width: number): React.CSSProperties => ({
  border: `1px solid ${color}`,
  margin: '2px 0',
  width: `${width}%`,
})

const PageDecorationBase: React.FC = (): React.ReactElement => {
  return <div style={{marginBottom: 15, width: '100%'}}>
    <hr style={getFooterLineStyle(colors.LOGO_ORANGE, 70)} />
    <hr style={getFooterLineStyle(colors.LOGO_GREEN, 75)} />
    <hr style={getFooterLineStyle(colors.LOGO_BLUE, 82)} />
    <hr style={getFooterLineStyle(colors.LOGO_RED, 90)} />
    <hr style={getFooterLineStyle(colors.LOGO_PURPLE, 95)} />
  </div>
}
const PageDecoration = React.memo(PageDecorationBase)

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
  hasLargeDecoration?: boolean
  hasLogo?: boolean
  style?: React.CSSProperties
}


const GenericPage: React.FC<PageProps> = (props: PageProps): React.ReactElement => {
  const hasUserData = useSelector(
    ({user: {answers, priorities}}: MiniRootState): boolean =>
      !!(Object.keys(answers).length || Object.keys(priorities).length),
  )
  const {bottomButton, children, footerSize = 150, hasLargeDecoration, hasLogo, style} = props
  const pageStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: colors.BACKGROUND_GREY,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    ...style,
  }), [style])
  const bobLogoContainerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    ...!hasLargeDecoration && {marginBottom: 10},
  }), [hasLargeDecoration])
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
        {hasLargeDecoration ? null : <PageDecoration />}
      </div>
    </div>
    {hasLargeDecoration ? <PageDecoration /> : null}
  </div>
}


export default React.memo(GenericPage)
