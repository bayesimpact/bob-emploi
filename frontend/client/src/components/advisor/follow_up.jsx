import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-follow-up.png'

import {EmailTemplate} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice: {adviceId}, onExplore, userYou} = this.props
    const templates = getEmailTemplates(userYou)[adviceId] || []
    const boxStyle = index => ({
      marginTop: index ? -1 : 0,
    })
    return <div>
      <div style={{marginBottom: 15}}>
        Voilà <strong>
          <GrowingNumber number={templates.length} /> exemple
          {templates.length > 1 ? 's' : ''}
        </strong> d'email de relance
      </div>

      <AppearingList>
        {templates.map((template, index) => <EmailTemplate
          userYou={userYou} onContentShown={() => onExplore('email')}
          {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </AppearingList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
