import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {COACHING_EMAILS_OPTIONS, ORIGIN_OPTIONS, youForUser} from 'store/user'

import {FieldSet, Select} from 'components/pages/connected/form_utils'

import {Step, ProfileUpdater} from './step'


const settingsUpdater = new ProfileUpdater({
  coachingEmailFrequency: true,
  origin: true,
})

class SettingsStepBase extends React.Component {
  static propTypes = {
    onChange: PropTypes.func,
    profile: PropTypes.shape({
      coachingEmailFrequency: PropTypes.string,
      email: PropTypes.string,
      origin: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  updater_ = settingsUpdater.attachToComponent(this)

  fastForward = () => {
    if (this.updater_.isFormValid()) {
      this.updater_.handleSubmit()
      return
    }
    const profileDiff = {}
    const {onChange, profile: {coachingEmailFrequency, origin}} = this.props
    if (!origin) {
      const origins = ORIGIN_OPTIONS
      profileDiff.origin = origins[Math.floor(Math.random() * origins.length)].value
    }
    if (!coachingEmailFrequency) {
      const options = COACHING_EMAILS_OPTIONS
      profileDiff.coachingEmailFrequency = options[Math.floor(Math.random() * options.length)].value
    }
    onChange && onChange({profile: profileDiff})
  }

  render() {
    const {profile: {coachingEmailFrequency, email, origin}, userYou} = this.props
    const {isValidated} = this.state
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      origin,
      coachingEmailFrequency || !email,
    ]
    // TODO(pascal): If no email, ask users to give an email if they want coaching.
    return <Step
      title={`${config.productName} et vous`}
      fastForward={this.fastForward}
      progressInStep={checks.filter(c => c).length / (checks.length + 1)}
      onNextButtonClick={this.updater_.isFormValid() ? this.updater_.handleSubmit : null}
      onPreviousButtonClick={this.updater_.getBackHandler()}
      {...this.props}>
      <FieldSet
        label={`Comment a${userYou('s-tu', 'vez vous')} connu ${config.productName} ?`}
        isValid={!!origin} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('origin')} value={origin}
          options={ORIGIN_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} une option`} />
      </FieldSet>

      {checks[0] && email ? <FieldSet
        label={`Souhaite${userYou('s-tu', 'z-vous')} activer
          le coaching mail de ${config.productName} ?`}
        isValid={!!coachingEmailFrequency} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('coachingEmailFrequency')}
          value={coachingEmailFrequency}
          options={COACHING_EMAILS_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} une option`} />
        <div style={{color: colors.COOL_GREY, fontSize: 13, fontStyle: 'italic', marginTop: 5}}>
          {userYou('Tu peux', 'Vous pouvez')} changer ce paramètre à tout moment
        </div>
      </FieldSet> : null}
    </Step>
  }
}
const SettingsStep = connect(({user}) => ({
  userYou: youForUser(user),
}))(SettingsStepBase)


export {SettingsStep}
