import React from 'react'
import PropTypes from 'prop-types'

import {genderize, getEmailTemplates} from 'store/french'

import {AppearingList, GrowingNumber, PaddedOnMobile} from 'components/theme'
import Picto from 'images/advices/picto-follow-up.png'

import {EmailTemplate} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    fontSize: PropTypes.number.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
  }

  render() {
    const {fontSize, profile: {gender}} = this.props
    return <div style={{fontSize: fontSize}}>
      Plutôt que de dire que vous êtes motivé{genderize('.e', 'e', '', gender)},
      montrez-le&nbsp;!<br />
      <strong>Relancez les recruteurs</strong> par mail, par téléphone ou en personne.
    </div>
  }
}


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
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15}}>
        Voilà <strong>
          <GrowingNumber number={templates.length} /> exemple
          {templates.length > 1 ? 's' : ''}
        </strong> d'email de relance
      </PaddedOnMobile>

      <AppearingList>
        {templates.map((template, index) => <EmailTemplate
          userYou={userYou} onContentShown={() => onExplore('email')}
          {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </AppearingList>
    </div>
  }
}


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
