import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-motivation-email.png'

import {EmailTemplate} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice: {adviceId}, onExplore, userYou} = this.props
    // TODO(cyrille): Rather use a wrapper to be defined in base.jsx to avoid calling on adviceId.
    const templates = getEmailTemplates(userYou)[adviceId] || []
    const boxStyle = index => ({
      marginTop: index ? -1 : 0,
    })
    const maybeS = templates.length <= 1 ? '' : 's'
    return <div>
      <div style={{marginBottom: 15}}>
        Nous avons trouvé <strong>
          <GrowingNumber number={templates.length} /> exemple{maybeS}
        </strong> de
        structures d'email
      </div>

      <AppearingList>
        {templates.map((template, index) => <EmailTemplate
          userYou={userYou} onContentShown={() => onExplore('template')}
          {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </AppearingList>
    </div>
  }
}


export default {ExpandedAdviceCardContent, Picto}
