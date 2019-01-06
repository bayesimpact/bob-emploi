import PropTypes from 'prop-types'
import React from 'react'

import {LabeledToggle} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

import {ProfileUpdater, Step} from './step'


const notificationsUpdater = new ProfileUpdater({
  emailDays: false,
  isNewsletterEnabled: false,
  isWeeklySummaryEnabled: false,
})


class NotificationsStep extends React.Component {
  static propTypes = {
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = notificationsUpdater.getDerivedStateFromProps(this.props)

  updater_ = notificationsUpdater.attachToComponent(this)

  renderNewsletterFieldset(detailsStyle) {
    const {profile: {gender}, userYou} = this.props
    const {isNewsletterEnabled} = this.state
    const genderE = gender === 'FEMININE' ? 'e' : ''
    return <FieldSet label={<span style={{fontWeight: 500}}>
      Emails concernant {config.productName}
    </span>}>
      <div style={detailsStyle}>
        Ces emails nous serviront à {userYou('te', 'vous')} tenir informé{genderE} des évolutions
        de {config.productName}&nbsp;: nouvelles fonctionnalités, astuces, …
      </div>
      <LabeledToggle
        type="checkbox"
        label={`Suivre l'actualité de ${config.productName}`}
        isSelected={isNewsletterEnabled}
        onClick={() => this.updater_.handleChange('isNewsletterEnabled')(!isNewsletterEnabled)} />
    </FieldSet>
  }

  render() {
    const detailsStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    return <Step
      title={`${this.props.userYou('Tes', 'Vos')} notifications`}
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      {this.renderNewsletterFieldset(detailsStyle)}
    </Step>
  }
}


export {NotificationsStep}
