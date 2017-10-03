import React from 'react'

import config from 'config'
import {ProfileUpdater, Step} from 'components/pages/profile/step'
import {Colors, FieldSet, LabeledToggle} from 'components/theme'
import {USER_PROFILE_SHAPE} from 'store/user'


class NotificationsStep extends React.Component {
  static propTypes = {
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  componentWillMount() {
    this.updater_ = new ProfileUpdater(
      {
        emailDays: false,
        isNewsletterEnabled: false,
        isWeeklySummaryEnabled: false,
      },
      this,
      this.props,
    )
  }

  renderNewsletterFieldset(detailsStyle) {
    const {gender} = this.props.profile
    const {isNewsletterEnabled} = this.state
    const genderE = gender === 'FEMININE' ? 'e' : ''
    return <FieldSet label={<span style={{fontWeight: 500}}>
      Emails concernant {config.productName}
    </span>}>
      <div style={detailsStyle}>
        Ces emails nous serviront à vous tenir informé{genderE} des évolutions
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
      color: Colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    return <Step
      title="Vos notifications"
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      {this.renderNewsletterFieldset(detailsStyle)}
    </Step>
  }
}


export {NotificationsStep}
