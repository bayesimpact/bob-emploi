import React from 'react'

import isMobileVersion from 'store/mobile'

import {StaticPage} from 'components/static'
import {MAX_CONTENT_WIDTH} from 'components/theme'
// TODO(cyrille): Make this work with deployments.
import bookmarkletIcon from 'deployment/favicon.ico'


const bookmarkletStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.PALE_GREY,
  border: `1px solid ${colors.COOL_GREY}`,
  borderRadius: 3,
  color: 'inherit',
  display: 'inline-flex',
  fontSize: 13,
  padding: '2px 5px',
  textDecoration: 'none',
  verticalAlign: 'middle',
}


function removeExtraSpacesFromCode(codeString: string): string {
  // Convert multiple space in one: '   ' -> ' '
  return codeString.replace(/\s+/g, ' ')
}


const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const textStyle: React.CSSProperties = {
  color: colors.CHARCOAL_GREY,
  lineHeight: 1.63,
  marginBottom: 10,
  padding: isMobileVersion ? '0 20px' : '0 140px',
}
// TODO(florian): Make mobile friendly if necessary (not likely as i-milo is not
// mobile friendly).
const textSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 16,
  lineHeight: 1.63,
  paddingBottom: 50,
}
const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 'bold',
  lineHeight: 1,
  maxWidth: MAX_CONTENT_WIDTH,
  padding: '50px 0 40px',
  textAlign: 'center',
}
const sectionStyle: React.CSSProperties = {
  marginLeft: 'auto',
  marginRight: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
}
const imgStyle: React.CSSProperties = {
  border: '1px solid #000',
  display: 'block',
  margin: 5,
}

const imiloProductName = 'i-milo'
const makeBookmarklet = (entry: string, functionName: string): string => {
  const host = window.location.origin
  const publicPath = process.env.NODE_ENV === 'production' ? '/assets' : '/'
  const bookmarkletUrl = `${host}${publicPath}/${entry}.js`
  const bookmarkletCode = `
    !/^https:\\/\\/portail\\.i-milo\\.fr\\/dossier\\//.test(window.location.href) ?
    alert("Vous devez être sur le profil d'un jeune dans i-milo pour utiliser ce favori.
    Ex: https://portail.i-milo.fr/dossier/123456/consultation/identite") : (
    (typeof ${functionName} !== 'undefined') ? ${functionName}() : function() {
      var s = document.createElement('script');
      s.setAttribute('src', '${bookmarkletUrl}');
      document.getElementsByTagName('head')[0].appendChild(s);
    }())`
  const encodedBookmarkletCode = encodeURIComponent(removeExtraSpacesFromCode(bookmarkletCode))
  return `javascript:void(${encodedBookmarkletCode});`
}

interface InstallerProps {
  bookmarklet: {
    // The name of the JS file in Bob's assets folder, e.g. import-from-imilo.
    entry: string
    // The name of the function to call if the bookmarklet has already been loaded.
    functionName: string
    // An icon to show on the link (e.g. a favicon.). Defaults to Bob's favicon.
    icon?: string
    // The title of the Bookmark.
    title: string
  }
  children?: React.ReactNode
  goal: string
  installDemo?: string
  page: string
  usageDemo?: string
}
const BookmarkletInstallation = (props: InstallerProps): React.ReactElement => {
  const {bookmarklet: {entry, functionName, icon, title}, children, goal, installDemo, page,
    usageDemo} = props
  const bookmarklet = makeBookmarklet(entry, functionName)
  return <StaticPage page={page} style={{backgroundColor: '#fff'}}>
    <div style={pageStyle}>
      <div style={sectionStyle}>
        <div style={textSectionStyle}>
          <div style={titleStyle}>
            Comment {goal} depuis {imiloProductName}
          </div>
          <div style={textStyle}>
            <h2 style={{fontWeight: 'bold', marginTop: 25}}>
              1. Installer le bouton "{title}" dans votre navigateur
            </h2>
            <p>
              Faire glisser le bouton suivant dans la barre de favoris de votre
              navigateur&nbsp;:{' '}
              <a style={bookmarkletStyle} href={bookmarklet}>
                <img style={{marginRight: 5, width: 16}} alt="" src={icon || bookmarkletIcon} />
                {title}
              </a>
            </p>
            {installDemo ? <React.Fragment>
              Démonstration&nbsp;:
              <img
                src={installDemo} alt="Démonstration de l'intégration" style={imgStyle}
                width="800" />
            </React.Fragment> : null}
            (à faire une seule fois par navigateur)
            <h2 style={{fontWeight: 'bold', marginTop: 25}}>
              2. Cliquer sur le bouton "{title}" depuis une page de{' '}
              profil jeune dans {imiloProductName}
            </h2>
            {usageDemo ? <React.Fragment>
              Démonstration&nbsp;:
              <img
                src={usageDemo} alt="Démonstration de l'intégration" style={imgStyle}
                width="800" />
            </React.Fragment> : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  </StaticPage>
}


export default React.memo(BookmarkletInstallation)
