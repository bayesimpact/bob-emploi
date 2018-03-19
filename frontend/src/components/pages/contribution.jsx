import GithubCircleIcon from 'mdi-react/GithubCircleIcon'
import React from 'react'
import PropTypes from 'prop-types'

import config from 'config'

import howtoContent from './contribution/howto.txt'
import roadmapContent from './contribution/roadmap.txt'

import {StaticPage, StrongTitle} from 'components/static'
import {Colors, Markdown, Button, Styles} from 'components/theme'

class ContributionPage extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const leftTitleStyle = {
      color: Colors.SLATE,
      flexShrink: 0,
      fontSize: 35,
      fontWeight: 'bold',
      lineHeight: 1.34,
      marginRight: isMobileVersion ? 'initial' : 80,
      marginTop: 18,
      width: 320,
    }
    const textSectionStyle = {
      display: 'flex',
      margin: '72px 100px 100px',
    }
    if (isMobileVersion) {
      Object.assign(textSectionStyle, {
        flexDirection: 'column',
        margin: '22px 20px 40px',
      })
    }
    const callOutStyle = {
      backgroundColor: Colors.SLATE,
      color: '#fff',
      fontSize: 30,
      fontWeight: 'bold',
      lineHeight: 1.33,
      padding: isMobileVersion ? 30 : 60,
      textAlign: 'center',
    }
    const githubLinkStyle = {
      alignItems: 'center',
      backgroundColor: Colors.SLATE,
      borderRadius: 5,
      color: '#fff',
      display: 'flex',
      fontSize: 15,
      margin: 15,
      padding: 9,
      position: isMobileVersion ? 'initial' : 'absolute',
      right: 0,
      textDecoration: 'none',
      top: 0,
    }
    return <StaticPage page="contribution" title={<span>
      Comment <StrongTitle>contribuer</StrongTitle>&nbsp;?
    </span>} style={{padding: 0}}>
      <a
        style={githubLinkStyle} href={config.githubSourceLink}
        target="_blank" rel="noopener noreferrer">
        <GithubCircleIcon style={{fill: '#fff', height: 29, marginRight: 9, width: 29}} />
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir le code source sur GitHub
        </span>
      </a>

      <div style={textSectionStyle}>
        <div style={leftTitleStyle}>
          Par la communauté,<br />
          pour la communauté
          <a href={config.donationUrl} target="_blank" rel="noopener noreferrer">
            <Button type="validation" style={{marginTop: 20}}>
              Faire un don
            </Button>
          </a>
        </div>
        <div style={{fontSize: 16, lineHeight: 1.44}}>
          <Markdown content={howtoContent} />
        </div>
      </div>

      <div style={callOutStyle}>
        <div style={{margin: 'auto', maxWidth: 400}}>
          Ensemble créons le service&nbsp;public de demain
        </div>
      </div>

      <div style={textSectionStyle}>
        <div style={leftTitleStyle}>
          Nos pistes d'améliorations
        </div>
        <div style={{fontSize: 16, lineHeight: 1.44}}>
          <Markdown content={roadmapContent} />
        </div>
      </div>
    </StaticPage>
  }
}

export {ContributionPage}
