import CheckboxBlankCircleIcon from 'mdi-react/CheckboxBlankCircleIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import React, {useCallback, useMemo, useState} from 'react'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {Modal, useModal} from 'components/modal'
import ExternalLink from 'components/external_link'
import Input from 'components/input'
import logoTpro from 'deployment/bob-logo.svg'

import isMobileVersion from 'store/mobile'

const searchSvg = `M8.366 22.19a10.457 10.457 0 0 1-3.334-2.264 10.855 10.855 0 0
  1-2.243-3.341c-.55-1.27-.826-2.634-.826-4.092 0-1.457.275-2.82.826-4.09A10.855 10.855 0 0 1 5.032
  5.06a10.457 10.457 0 0 1 3.334-2.265 10.223 10.223 0 0 1 4.097-.827c1.434 0 2.79.276
  4.067.827a10.457 10.457 0 0 1 3.334 2.265 10.855 10.855 0 0 1 2.243 3.341c.55 1.27.826 2.634.826
  4.091 0 1.458-.275 2.821-.826 4.092a10.855 10.855 0 0 1-2.243 3.341 10.457 10.457 0 0 1-3.334
  2.264 10.146 10.146 0 0 1-4.067.828c-1.454 0-2.82-.276-4.097-.828zM22.03 20.5a12.985 12.985 0 0 0
  2.119-3.672c.52-1.364.779-2.807.779-4.328 0-1.73-.327-3.354-.982-4.875a12.494 12.494 0 0
  0-2.68-3.969A12.774 12.774 0 0 0 17.294.984 12.03 12.03 0 0 0 12.463 0C10.74 0 9.12.328
  7.603.984A12.774 12.774 0 0 0 3.63 3.656 12.284 12.284 0 0 0 .966 7.625C.322 9.145 0 10.771 0
  12.5c0 1.73.322 3.354.966 4.875a12.284 12.284 0 0 0 2.664 3.969 12.774 12.774 0 0 0 3.973
  2.672c1.516.656 3.136.984 4.86.984 1.558 0 3.033-.27 4.425-.812a12.616 12.616 0 0 0
  3.74-2.25l9.658 9.75a.984.984 0 0 0 .717.312c.27 0 .509-.104.717-.312a.955.955 0 0 0
  .28-.704.955.955 0 0 0-.28-.703z`

const hoverStyle = {
  backgroundColor: '#fff',
  color: colors.NAVIGATION_BUTTON_BACKGROUND,
}
const radiums: readonly (keyof RadiumCSSProperties)[] = [':focus', ':hover']

const linkStyle: RadiumCSSProperties = {
  ...Object.fromEntries(radiums.map(key => [key, hoverStyle])),
  display: 'inline-block',
  fontSize: 14,
  marginRight: 10,
  textDecoration: 'none',
  ...isMobileVersion ? {
    color: colors.NAVIGATION_TEXT,
    fontFamily: config.font,
    fontWeight: 500,
    padding: '10px 20px',
    width: '100%',
  } : {
    backgroundColor: colors.NAVIGATION_BUTTON_BACKGROUND,
    border: `1px solid ${colors.NAVIGATION_BUTTON_BACKGROUND}`,
    borderRadius: 3,
    color: '#fff',
    fontFamily: config.titleFont,
    fontWeight: 700,
    letterSpacing: '1.3px',
    padding: 15,
    textTransform: 'uppercase',
    transition: 'all .15s ease-in-out',
  },
}
const invertedLinkStyle = {
  ...linkStyle,
  backgroundColor: '#fff',
  color: colors.NAVIGATION_BUTTON_BACKGROUND,
  ...Object.fromEntries(radiums.map(key => [key, {
    ...hoverStyle,
    transform: 'scale(1.1)',
  }])),
}
const submenuStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 30,
  ...isMobileVersion ? {flexDirection: 'column'} : {},
}
const submenuHoverStyle: React.CSSProperties = {
  color: colors.NAVIGATION_BUTTON_BACKGROUND,
  transform: 'scale(1.1)',
}
const submenuLinkStyle: RadiumCSSProperties = {
  ...Object.fromEntries(radiums.map(key => [key, submenuHoverStyle])),
  color: 'inherit',
  display: 'inline-block',
  fontFamily: config.font,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: '20px',
  padding: 10,
  textAlign: 'center',
  textDecoration: 'none',
  transition: 'all .15s ease-in-out',
}
const submenuHeaderStyle: React.CSSProperties = {
  color: colors.NAVIGATION_BUTTON_BACKGROUND,
  display: 'block',
}
const searchStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  padding: 10,
  width: 640,
}
const searchButtonStyle: React.CSSProperties = {
  margin: '20px 0',
  ...isMobileVersion ? {display: 'none'} : {},
}
const searchInputStyle: React.CSSProperties = {
  marginRight: 10,
}
const titlesSectionStyle: React.CSSProperties = {
  alignItems: 'center',
  borderBottom: `1px solid ${colors.NAVIGATION_BUTTON_BACKGROUND}`,
  display: 'flex',
  margin: '0 auto 20px',
  padding: '10px 0',
  ...isMobileVersion ? {flexDirection: 'column', justifyContent: 'center'} : {},
}
const titleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '25px',
  padding: '0 10px',
  textTransform: 'uppercase',
  ...isMobileVersion ? {textAlign: 'center'} : {},
}
const titleLinksStyle: React.CSSProperties = {
  ...isMobileVersion ? {
    display: 'block',
    flexDirection: 'column',
    fontSize: 13,
    justifyContent: 'flex-start',
    padding: '0 10px',
    transition: 'all .15s ease-in-out',
  } : {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
}
const menuIconStyle: React.CSSProperties = {
  backgroundColor: colorToAlpha('#000', 0.05),
  borderRadius: 3,
  color: colors.NAVIGATION_BUTTON_BACKGROUND,
  padding: '0.25rem',
}

const circleStyle: React.CSSProperties = {
  ...isMobileVersion ? {display: 'none'} : {},
}

interface LinkProps extends Omit<React.ComponentProps<typeof ExternalLink>, 'style'> {
  isInverted?: boolean
}
const MenuLinkBase = ({children, isInverted, ...props}: LinkProps) =>
  <ExternalLink style={isInverted ? invertedLinkStyle : linkStyle} {...props}>
    {children}
  </ExternalLink>
const MenuLink = React.memo(MenuLinkBase)

const submenuHereStyle: React.CSSProperties = {
  ...submenuLinkStyle,
  fontWeight: 700,
}


const SubmenuLinkBase = ({children, ...props}: Omit<LinkProps, 'isInverted'>) =>
  <ExternalLink style={submenuLinkStyle} {...props}>
    {children}
  </ExternalLink>
const SubmenuLink = React.memo(SubmenuLinkBase)
// TODO(cyrille): Handle mobile.
const TProHeader = () => {
  const [isSearchShown, showSearch, hideSearch] = useModal()
  const [search, setSearch] = useState('')
  const [isMenuDisplayed, setIsMenuDisplayed] = useState(!isMobileVersion)

  const handleMenuDisplay = useCallback((): void => {
    setIsMenuDisplayed(!isMenuDisplayed)
  }, [isMenuDisplayed, setIsMenuDisplayed])
  const finalTitleLinksStyle = useMemo((): React.CSSProperties => ({
    ...titleLinksStyle,
    ...isMenuDisplayed ?
      isMobileVersion ? {display: 'block'} : {display: 'flex'} :
      {display: 'none'},
  }), [isMenuDisplayed])

  return <React.Fragment>
    <Modal style={searchStyle} isShown={isSearchShown} onClose={hideSearch}>
      <Input
        style={searchInputStyle} name="search" placeholder="Rechercher"
        value={search} onChange={setSearch} />
      <ExternalLink href={`https://www.transitionspro-ara.fr/?s=${search}`}>
        <Button type="navigation">Rechercher</Button>
      </ExternalLink>
    </Modal>
    <div style={{margin: '32px auto 0', maxWidth: 1250}}>
      <section style={titlesSectionStyle}>
        <img
          alt="Transitions Pro" src={logoTpro} width={192} height={87} style={{height: 'auto'}} />
        <p style={titleStyle}>
          Salariés du privé, concrétisons<br />
          vos projets de reconversion professionnelle&nbsp;!
        </p>
        {isMobileVersion ?
          isMenuDisplayed ?
            <CloseIcon
              aria-label="Fermer" style={menuIconStyle} size={33} onClick={handleMenuDisplay} /> :
            <MenuIcon
              aria-label="Accueil" style={menuIconStyle} size={33} onClick={handleMenuDisplay} /> :
          null}
        <div style={finalTitleLinksStyle}>
          <MenuLink href="https://www.transitionspro-ara.fr/tout-savoir-sur-transitions-pro">
            Qui sommes-nous&nbsp;?
          </MenuLink>
          <MenuLink href="https://www.transitionspro-ara.fr/blog">Actualités</MenuLink>
          <MenuLink href="https://www.transitionspro-ara.fr/prenons-contact">
            Prenons contact
          </MenuLink>
          <MenuLink isInverted={!isMobileVersion} href="https://www.transitionspro-ara.fr/connexion">
            Mon espace personnel
          </MenuLink>
          <button style={searchButtonStyle} onClick={showSearch} type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <g><g><path d={searchSvg} />
              </g></g>
            </svg>
          </button>
        </div>
      </section>
      <section style={submenuStyle}>
        <SubmenuLink
          href="https://www.transitionspro-ara.fr/identifions-votre-parcours-de-reconversion/">
          <span style={submenuHeaderStyle}>Les parcours de</span> reconversion possibles
        </SubmenuLink>
        <CheckboxBlankCircleIcon
          style={circleStyle} size={12} color={colors.NAVIGATION_BUTTON_BACKGROUND} />
        <SubmenuLink
          href="https://www.transitionspro-ara.fr/les-services-pour-faciliter-vos-demarches/">
          <span style={submenuHeaderStyle}>Les services pour</span> faciliter vos démarches
        </SubmenuLink>
        <CheckboxBlankCircleIcon
          style={circleStyle} size={12} color={colors.NAVIGATION_BUTTON_BACKGROUND} />
        <SubmenuLink
          href="https://www.transitionspro-ara.fr/les-dispositifs-et-les-financements-pour-votre-reconversion/">
          <span style={submenuHeaderStyle}>Les dispositifs et les financements</span>
          pour votre reconversion
        </SubmenuLink>
        <CheckboxBlankCircleIcon
          style={circleStyle} size={12} color={colors.NAVIGATION_BUTTON_BACKGROUND} />
        <div style={submenuHereStyle}>
          <span style={submenuHeaderStyle}>Les métiers pour vous reconvertir</span> et
            à côté de chez vous
        </div>
      </section>
    </div>
  </React.Fragment>
}
export default React.memo(TProHeader)
