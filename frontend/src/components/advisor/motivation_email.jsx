import React from 'react'
import PropTypes from 'prop-types'

import {AppearingList, GrowingNumber, PaddedOnMobile} from 'components/theme'

import {EmailTemplate} from './base'
import emailTemplates from './data/email_templates.json'


class AdviceCard extends React.Component {
  render() {
    return <div style={{display: 'flex'}}>
      <div style={{flex: 1}}>
        <div style={{fontSize: 30, lineHeight: 1.03}}>
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
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {adviceId} = this.props.advice
    const templates = emailTemplates[adviceId] || []
    const boxStyle = index => ({
      marginTop: index ? -1 : 0,
    })
    return <div>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15}}>
        Nous avons trouvé <strong><GrowingNumber number={templates.length} /> exemples</strong> de
        structures d'email
      </PaddedOnMobile>

      <AppearingList>
        {templates.map((template, index) => <EmailTemplate
          {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </AppearingList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent}
