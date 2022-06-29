import _uniqueId from 'lodash/uniqueId'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import isMobileVersion from 'store/mobile'
import {useOnGroupBlur} from 'hooks/focus'

import ExternalLink from 'components/external_link'
import HelpDeskLink from 'components/help_desk_link'
import {RadiumExternalLink, RadiumLink, useRadium} from 'components/radium'
import {Routes} from 'components/url'

import accountIcon from '../images/account-icon.svg'


const wrapperStyle: React.CSSProperties = {
  display: 'inline-block',
  position: 'relative',
}
const buttonStyle: RadiumCSSProperties = {
  ':focus': {
    borderColor: colors.NAVIGATION_MENU_BORDER_HOVER,
  },
  ':hover': {
    borderColor: colors.NAVIGATION_MENU_BORDER_HOVER,
  },
  'alignItems': 'center',
  'display': 'inline-flex',
  'justifyContent': 'center',
  ...config.isMenuProfile ? {
    color: 'inherit',
    flexDirection: 'column',
    fontSize: 10,
    fontWeight: 'bold',
    height: isMobileVersion ? 40 : 45,
    padding: isMobileVersion ? 0 : '0 5px',
    textDecoration: 'none',
    width: isMobileVersion ? 30 : 45,
  } : {
    borderColor: colors.NAVIGATION_MENU_BORDER,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1,
    color: colors.NAVIGATION_MENU_TEXT,
    height: 36,
    width: 36,
  },
}
const linkStyle: RadiumCSSProperties = {
  ':focus': {
    backgroundColor: colors.PINKISH_GREY_TWO,
  },
  ':hover': {
    backgroundColor: colors.PINKISH_GREY_TWO,
  },
  'color': 'inherit',
  'display': 'block',
  'minWidth': 200,
  'padding': 15,
  'textDecoration': 'none',
}
const noListStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}

const Menu = (): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false)
  const {t} = useTranslation()
  const handleClick = useCallback(() => setIsOpen(wasOpen => !wasOpen), [])
  const close = useCallback(() => setIsOpen(false), [])
  const dropDownStyle = useMemo((): React.CSSProperties => ({
    ...noListStyle,
    backgroundColor: '#fff',
    bottom: 0,
    color: colors.DARK_TWO,
    fontSize: 14,
    fontWeight: 'bold',
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? 'initial' : 'none',
    position: 'absolute',
    right: 0,
    textAlign: 'left',
    transform: `translateY(${isOpen ? 100 : 80}%) translateY(13px)`,
    transition: '450ms',
    zIndex: 1,
  }), [isOpen])
  const dropDownId = useMemo(_uniqueId, [])
  const iconForMenu = config.isMenuProfile ? <React.Fragment>
    <img src={accountIcon} alt="profile" aria-label={t('Profil')} />
    {isMobileVersion ? t('Profil') : null}
  </React.Fragment> : <MenuIcon aria-label={t('Accueil')} />
  const {onBlur: handleGroupBlur, onFocus: handleGroupFocus} = useOnGroupBlur(close)
  const [buttonRadiumProps] = useRadium({
    onBlur: handleGroupBlur,
    onFocus: handleGroupFocus,
    style: buttonStyle,
  })
  return <nav role="navigation" style={wrapperStyle}>
    {config.menuLink ?
      <ExternalLink href={config.menuLink} {...buttonRadiumProps}>
        {iconForMenu}
      </ExternalLink> : <React.Fragment>
        <button
          onClick={handleClick} type="button" {...buttonRadiumProps} aria-expanded={isOpen}
          aria-controls={dropDownId}>
          {isOpen ? <CloseIcon role="img" aria-label={t('Fermer le menu')} /> :
            <MenuIcon role="img" aria-label={t('Menu')} />}
        </button>
        {/* onFocus and onBlur are here to capture focuses on internal links when bubbling up. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <ul
          aria-hidden={!isOpen} style={dropDownStyle} onBlur={handleGroupBlur}
          onFocus={handleGroupFocus} id={dropDownId}>
          <li style={noListStyle}>
            <RadiumExternalLink
              href="https://www.bayesimpact.org/about" style={linkStyle}
              tabIndex={isOpen ? 0 : -1}>
              {t('Équipe')}
            </RadiumExternalLink>
          </li>
          <li style={noListStyle}>
            <RadiumExternalLink
              href="https://www.bayesimpact.org" style={linkStyle} tabIndex={isOpen ? 0 : -1}>
              Bayes Impact
            </RadiumExternalLink>
          </li>
          <li style={noListStyle}>
            <RadiumExternalLink
              href="https://www.bayesimpact.org/about/partners-funders"
              style={linkStyle} tabIndex={isOpen ? 0 : -1}>
              {t('Partenaires')}
            </RadiumExternalLink>
          </li>
          <li style={noListStyle}>
            <HelpDeskLink style={linkStyle} tabIndex={isOpen ? 0 : -1}>
              {t('Nous contacter')}
            </HelpDeskLink>
          </li>
          <li style={noListStyle}>
            <RadiumLink
              to={Routes.COOKIES_PAGE} target="_blank" style={linkStyle}
              tabIndex={isOpen ? 0 : -1}>
              {t('Cookies')}
            </RadiumLink>
          </li>
          <li style={noListStyle}>
            <RadiumLink
              to={Routes.TERMS_AND_CONDITIONS_PAGE}
              target="_blank" style={linkStyle} tabIndex={isOpen ? 0 : -1}>
              {t('CGU')}
            </RadiumLink>
          </li>
        </ul>
      </React.Fragment>
    }
  </nav>
}


export default React.memo(Menu)
