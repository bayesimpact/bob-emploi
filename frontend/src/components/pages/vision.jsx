import React from 'react'
import PropTypes from 'prop-types'

import content from './vision/content.txt'

import {StaticPage} from 'components/static'
import {Routes} from 'components/url'
import {Colors, Icon, Markdown, Button} from 'components/theme'

class VisionPage extends React.Component {
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion, history} = this.context
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
    return <StaticPage page="vision" title={<strong>Notre mission</strong>} style={style}>
      <div style={leftTitleStyle}>
        Mettre la technologie au service de chacun
      </div>
      <div style={{fontSize: 16, lineHeight: 1.63, maxWidth: 600}}>
        <Markdown content={content} />

        <div style={{margin: '50px 0', textAlign: 'right'}}>
          <Button
            style={{fontSize: 17, padding: '10px 12px 8px 39px'}}
            onClick={() => history.push(Routes.CONTRIBUTION_PAGE)}>
            <span style={{paddingRight: '1em'}}>
              Contribuer
            </span>
            <Icon
              name="chevron-right"
              style={{fontSize: 24, paddingBottom: 2, verticalAlign: 'middle'}} />
          </Button>
        </div>

        <div style={{fontWeight: 'bold'}}>
          Écoutez notre fondateur, Paul Duan, expliquer notre mission&nbsp;:
          <iframe
            style={{marginTop: 10}}
            width={isMobileVersion ? 370 : 600} height={isMobileVersion ? 180 : 320}
            scrolling="no" frameBorder={0}
            src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/326192410&amp;color=%23ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true" />
        </div>
      </div>
    </StaticPage>
  }
}

export {VisionPage}
