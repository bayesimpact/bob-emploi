import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-motivation-email.png'

import {EmailTemplate} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    fontSize: PropTypes.number.isRequired,
  }

  render() {
    const {fontSize} = this.props
    return <div style={{display: 'flex'}}>
      <div style={{flex: 1}}>
        <div style={{fontSize: fontSize, lineHeight: 1.03}}>
          En <strong>30 à 60 secondes</strong> le recruteur doit être
          convaincu. Ça commence dès l'email de candidature.
        </div>
      </div>
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice: {adviceId}, onExplore, userYou} = this.props
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


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
