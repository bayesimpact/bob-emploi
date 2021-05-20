import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {RadiumExternalLink, useRadium} from 'components/radium'
import OutsideClickHandler from 'components/outside_click_handler'


const wrapperStyle: React.CSSProperties = {
  display: 'inline-block',
  position: 'relative',
}
const buttonStyle: RadiumCSSProperties = {
  ':focus': {
    borderColor: '#fff',
  },
  ':hover': {
    borderColor: '#fff',
  },
  'alignItems': 'center',
  'borderColor': colors.GREYISH_BROWN_TWO,
  'borderRadius': 6,
  'borderStyle': 'solid',
  'borderWidth': 1,
  'color': '#fff',
  'display': 'inline-flex',
  'height': 36,
  'justifyContent': 'center',
  'width': 36,
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

const Menu = (): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false)
  const {t} = useTranslation()
  const handleClick = useCallback((): void => {
    setIsOpen(wasOpen => !wasOpen)
  }, [])
  const dropDownStyle = useMemo((): React.CSSProperties => ({
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
  const [buttonRadiumProps] = useRadium({style: buttonStyle})
  return <div style={wrapperStyle}>
    <button onClick={handleClick} {...buttonRadiumProps}>
      {isOpen ? <CloseIcon aria-label={t('Fermer')} /> : <MenuIcon aria-label={t('Menu')} />}
    </button>
    <OutsideClickHandler
      aria-hidden={!isOpen} style={dropDownStyle}
      onOutsideClick={isOpen ? handleClick : undefined}>
      <div>
        <RadiumExternalLink
          href="https://www.bayesimpact.org/about" style={linkStyle} tabIndex={isOpen ? 0 : -1}>
          {t('Équipe')}
        </RadiumExternalLink>
        <RadiumExternalLink
          href="https://www.bayesimpact.org" style={linkStyle} tabIndex={isOpen ? 0 : -1}>
          Bayes Impact
        </RadiumExternalLink>
        <RadiumExternalLink
          href="https://www.bayesimpact.org/about/partners-funders"
          style={linkStyle} tabIndex={isOpen ? 0 : -1}>
          {t('Partenaires')}
        </RadiumExternalLink>
      </div>
    </OutsideClickHandler>
  </div>
}


export default React.memo(Menu)
