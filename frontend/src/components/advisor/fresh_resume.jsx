import React from 'react'

import {Colors, Styles} from 'components/theme'

import {AdviceCard, GrowingNumber} from './base'
import {ResumeAdvicePageContent} from './improve_success_rate'


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  renderNumber(number, style) {
    const containerStyle = {
      alignItems: 'center',
      border: 'solid 12px',
      borderRadius: 100,
      color: Colors.SKY_BLUE,
      display: 'flex',
      fontSize: 70,
      fontWeight: 'bold',
      height: 120,
      justifyContent: 'center',
      width: 120,
      ...Styles.CENTER_FONT_VERTICALLY,
      ...style,
    }
    return <div style={containerStyle}>
      <GrowingNumber number={number} />
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
    }
    const textStyle = {
      flex: 1,
      fontSize: 20,
      lineHeight: 1.4,
      marginLeft: 50,
    }
    const reasons = ['RESUME', 'ATYPIC_PROFILE', 'FIRST_JOB_SEARCH', 'JUST_STARTED_SEARCHING']
    return <AdviceCard reasons={reasons} {...this.props}>
      <div style={style}>
        {this.renderNumber(3)}
        <div style={textStyle}>
          C'est le nombre d'entretiens que vous pouriez obtenir avec votre
          profil.
        </div>
      </div>
    </AdviceCard>
  }
}


export default {AdvicePageContent: ResumeAdvicePageContent, FullAdviceCard}
