import React from 'react'
import PropTypes from 'prop-types'
import {browserHistory} from 'react-router'

import content from './vision/content.txt'

import {StaticPage, StrongTitle} from 'components/static'
import {Routes} from 'components/url'
import {Colors, Icon, Markdown, Button} from 'components/theme'

class VisionPage extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const leftTitleStyle = {
      color: Colors.SLATE,
      fontSize: 35,
      fontWeight: 'bold',
      lineHeight: 1.34,
      marginRight: isMobileVersion ? 'initial' : 80,
      width: 320,
    }
    const style = {
      display: 'flex',
      margin: '72px 100px 100px',
      padding: 0,
    }
    if (isMobileVersion) {
      Object.assign(style, {
        flexDirection: 'column',
        margin: '22px 20px 40px',
      })
    }
    return <StaticPage page="vision" title={<span>
      Mettre la <StrongTitle>technologie</StrongTitle><br />
      au <StrongTitle>service</StrongTitle> de chacun
    </span>} style={style}>
      <div style={leftTitleStyle}>
        Technologie,<br />
        Big Data &<br />
        Bien commun
      </div>
      <div style={{fontSize: 16, lineHeight: 1.63, maxWidth: 600}}>
        <Markdown content={content} />

        <div style={{margin: '50px 0', textAlign: 'right'}}>
          <Button
            style={{fontSize: 17, padding: '10px 12px 8px 39px'}}
            onClick={() => browserHistory.push(Routes.CONTRIBUTION_PAGE)}>
            <span style={{paddingRight: '1em'}}>
              Contribuer
            </span>
            <Icon
              name="chevron-right"
              style={{fontSize: 24, paddingBottom: 2, verticalAlign: 'middle'}} />
          </Button>
        </div>

        <div style={{fontWeight: 'bold'}}>
          Regardez notre fondateur, Paul Duan, expliquer notre mission en vidéo&nbsp;:
          <iframe
            style={{marginTop: 10}}
            width={isMobileVersion ? 370 : 600} height={isMobileVersion ? 180 : 320}
            src="https://www.youtube.com/embed/6AdHZmTHHA8" frameBorder={0}
            allowFullScreen={true} />
        </div>
      </div>
    </StaticPage>
  }
}

export {VisionPage}
