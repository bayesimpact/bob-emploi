import React from 'react'

import config from 'config'

import {StaticPage, StrongTitle} from 'components/static'
import {Colors, Markdown, RoundButton, Styles} from 'components/theme'

class ContributionPage extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
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
      <a style={githubLinkStyle} href={config.githubSourceLink} target="_blank">
        <img src={require('images/github.png')} style={{marginRight: 9}} alt="" />
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir le code source sur GitHub
        </span>
      </a>

      <div style={textSectionStyle}>
        <div style={leftTitleStyle}>
          Par la communauté,<br />
          pour la communauté
          <a href={config.donationUrl} target="_blank">
            <RoundButton type="validation" style={{marginTop: 20}}>
              Faire un don
            </RoundButton>
          </a>
        </div>
        <div style={{fontSize: 16, lineHeight: 1.44}}>
          <Markdown content={require('./contribution/howto.txt')} />
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
          <Markdown content={require('./contribution/roadmap.txt')} />
        </div>
      </div>
    </StaticPage>
  }
}

export {ContributionPage}
