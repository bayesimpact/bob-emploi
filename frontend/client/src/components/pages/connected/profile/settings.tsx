import React from 'react'
import PropTypes from 'prop-types'

import {COACHING_EMAILS_OPTIONS, ORIGIN_OPTIONS, userExample} from 'store/user'

import {FieldSet, Select} from 'components/pages/connected/form_utils'

import {ProfileStepProps, Step, ProfileUpdater} from './step'


const settingsUpdater = new ProfileUpdater({
  coachingEmailFrequency: true,
  origin: true,
})


interface StepState {
  isValidated?: boolean
}


class SettingsStep extends React.PureComponent<ProfileStepProps, StepState> {
  public static propTypes = {
    onChange: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      coachingEmailFrequency: PropTypes.string,
      email: PropTypes.string,
      origin: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state: StepState = {}

  private updater_ = settingsUpdater.attachToComponent(this)

  private isFormValid = (): boolean => {
    const {coachingEmailFrequency, email, origin} = this.props.profile
    return !!origin && (!email || !!coachingEmailFrequency)
  }

  // TODO(cyrille): Maybe factorize checks in updater to avoid having this code duplicated here.
  private handleSubmit = (): void => {
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      const {profile: {coachingEmailFrequency, origin}, onSubmit} = this.props
      onSubmit({coachingEmailFrequency, origin})
    }
  }

  private fastForward = (): void => {
    if (this.isFormValid()) {
      this.updater_.handleSubmit()
      return
    }
    const profileDiff: {-readonly [K in keyof bayes.bob.UserProfile]?: bayes.bob.UserProfile[K]} =
      {}
    const {onChange, profile: {coachingEmailFrequency, origin}} = this.props
    if (!origin) {
      profileDiff.origin = userExample.profile.origin
    }
    if (!coachingEmailFrequency) {
      profileDiff.coachingEmailFrequency = userExample.profile.coachingEmailFrequency
    }
    onChange && onChange({profile: profileDiff})
  }

  public render(): React.ReactNode {
    const {profile: {coachingEmailFrequency, email, origin}, userYou} = this.props
    const {isValidated} = this.state
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      origin,
      coachingEmailFrequency || !email,
    ]
    // TODO(pascal): If no email, ask users to give an email if they want coaching.
    return <Step
      title={`${config.productName} et ${userYou('toi', 'vous')}`}
      fastForward={this.fastForward}
      progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : null}
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


export {SettingsStep}
