import React from 'react'

import {Colors, Icon} from 'components/theme'

import Organization from './advisor/organization'
import LongCDD from './advisor/long_cdd'
import NetworkApplication from './advisor/network'
import OtherWorkEnv from './advisor/other_work_env'
import Reorientation from './advisor/reorientation'
import SpontaneousApplication from './advisor/spontaneous'
import ImproveSuccess from './advisor/improve_success_rate'


// Map of advice recommendation modules keyed by advice module IDs.
const ADVICE_MODULES = {
  'improve-success': ImproveSuccess,
  'long-cdd': LongCDD,
  'network-application': NetworkApplication,
  organization: Organization,
  'other-work-env': OtherWorkEnv,
  reorientation: Reorientation,
  'spontaneous-application': SpontaneousApplication,
}
// TODO(pascal): Remove RecommendPage from those modules as it is not used anymore.


class AdviceCard extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    priority: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  renderPriority() {
    const {advice, priority} = this.props
    const numStars = advice.numStars || 1
    const backgroundColor = numStars >= 3 ? Colors.RED_PINK :
        numStars >= 2 ? Colors.SQUASH : Colors.SILVER
    const style = {
      backgroundColor,
      borderRadius: '4px 4px 0 0',
      color: '#fff',
      fontSize: 20,
      fontStyle: 'italic',
      fontWeight: 'bold',
      padding: 15,
      position: 'relative',
      textTransform: 'uppercase',
    }
    const notchContainerStyle = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      left: '100%',
      position: 'absolute',
      top: 0,
    }
    const notchStyle = {
      borderBottom: '8px solid transparent',
      borderLeft: `8px solid ${backgroundColor}`,
      borderTop: '8px solid transparent',
      height: 0,
      width: 0,
    }
    return <header style={style}>
      {(numStars >= 2) ? `Priorité n°${priority}` : 'À regarder'}
      <div style={notchContainerStyle}>
        <div style={notchStyle} />
      </div>
    </header>
  }

  renderStarsCard() {
    const {advice} = this.props
    const {isMobileVersion} = this.context
    const numStars = advice.numStars || 1
    const style = {
      backgroundColor: '#fff',
      borderRadius: 4,
      fontSize: 15,
      margin: '10px 30px',
      textAlign: 'center',
      width: isMobileVersion ? 'initial' : 270,
    }
    const separatorStyle = {
      backgroundColor: Colors.SILVER,
      border: 'none',
      height: 1,
      margin: '15px auto 0',
      width: 35,
    }
    const starColor = starIndex => (starIndex < numStars) ? Colors.SQUASH : Colors.SILVER
    return <div style={style}>
      {this.renderPriority()}
      <div style={{padding: 35}}>
        <div style={{color: Colors.GREYISH_BROWN, fontStyle: 'italic'}}>
          Importance selon Bob&nbsp;:
        </div>
        <hr style={separatorStyle} />
        {new Array(3).fill(null).map((_, starIndex) => <Icon
            key={`star-${starIndex}`} name="star"
            style={{color: starColor(starIndex), fontSize: 40, margin: '25px 5px'}} />)}
        <div style={{color: Colors.CHARCOAL_GREY, fontWeight: 'bold'}}>
          {numStars >= 3 ? 'Très important' : numStars >= 2 ? 'Important' : 'Utile'}
        </div>
      </div>
    </div>
  }

  render() {
    const {advice, style, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const module = ADVICE_MODULES[advice.adviceId] || null
    const CardComponent = module && module.FullAdviceCard || null
    if (!CardComponent) {
      return null
    }
    const containerStyle = {
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      ...style,
    }
    return <div style={containerStyle}>
      {this.renderStarsCard()}
      <CardComponent {...extraProps} advice={advice} style={{flex: 1}} />
    </div>
  }
}


export {AdviceCard}
