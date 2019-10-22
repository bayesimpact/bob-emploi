import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, emailCheck, silentlyRegisterUser} from 'store/actions'
import {genderize} from 'store/french'
import {COACHING_EMAILS_OPTIONS, ORIGIN_OPTIONS, getUniqueExampleEmail,
  userExample} from 'store/user'
import {validateEmail} from 'store/validations'

import {LoginLink} from 'components/login'
import {FieldSet, Select} from 'components/pages/connected/form_utils'
import {Input, LabeledToggle} from 'components/theme'

import {OnboardingCommentContent, ProfileStepProps, Step, ProfileUpdater} from './step'


interface StepState {
  email?: string
  isCoachingConfirmShown?: boolean
  isEmailAlreadyUsed?: boolean
  isValidated?: boolean
}

interface StepProps extends ProfileStepProps {
  dispatch: DispatchAllActions
}


class SettingsStepBase extends React.PureComponent<StepProps, StepState> {
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

  public state: StepState = {
    email: this.props.profile.email,
  }

  private updater_ = new ProfileUpdater({
    coachingEmailFrequency: true,
    isNewsletterEnabled: false,
    origin: true,
  }).attachToComponent(this)

  private fastForward = (): void => {
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const profileDiff: {-readonly [K in keyof bayes.bob.UserProfile]?: bayes.bob.UserProfile[K]} =
      {}
    const {onChange, profile: {coachingEmailFrequency, email, origin}} = this.props
    if (!origin) {
      profileDiff.origin = userExample.profile.origin
    }
    if (!coachingEmailFrequency) {
      profileDiff.coachingEmailFrequency = userExample.profile.coachingEmailFrequency
    }
    if ((coachingEmailFrequency || profileDiff.coachingEmailFrequency) !== 'EMAIL_NONE' && !email) {
      this.setState({email: getUniqueExampleEmail()})
    }
    onChange && onChange({profile: profileDiff})
  }

  private handleEmailChange = (email: string): void => this.setState({
    email,
    isEmailAlreadyUsed: false,
  })

  private isFormValid = (): boolean => {
    return this.updater_.isFormValid() &&
      (this.props.profile.coachingEmailFrequency === 'EMAIL_NONE' ||
        validateEmail(this.state.email))
  }

  private handleSubmit = (): void => {
    if (!this.isFormValid()) {
      return
    }
    const {dispatch, profile: {email: originalEmail}} = this.props
    const {email} = this.state
    if (!email || originalEmail) {
      this.updater_.handleSubmit()
      return
    }
    dispatch(emailCheck(email)).then((response): void => {
      if (!response) {
        return
      }
      if (!response.isNewUser) {
        this.setState({isEmailAlreadyUsed: true})
        return
      }
      dispatch(silentlyRegisterUser(email)).then((): void => this.updater_.handleSubmit())
    })
  }

  private renderCoachingDetails(): React.ReactNode {
    const {isShownAsStepsDuringOnboarding, profile: {coachingEmailFrequency, email: profileEmail},
      userYou} = this.props
    const {email, isEmailAlreadyUsed, isValidated} = this.state
    const hasEmailInput = isShownAsStepsDuringOnboarding &&
      coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE' &&
      !profileEmail
    const comment = {stringParts: [
      `Je ${userYou('te', 'vous')} recommande de commencer en douceur avec un coaching occasionnel.
      Cela augmente fortement ${userYou('tes', 'vos')} chances ` +
      'de trouver un emploi rapidement. 😊'],
    }
    const emailComment = {stringParts: [
      `C'est grâce à ${userYou('ton', 'votre')} email que je pourrai
      ${userYou("t'", 'vous ')}accompagner dans ${userYou('ton', 'votre')} coaching 🙂`,
    ]}
    const inputStyle = isEmailAlreadyUsed ? {
      border: `1px solid ${colors.RED_PINK}`,
    } : {}
    const label = isShownAsStepsDuringOnboarding ?
      `Quel type de coaching souhaite${userYou('s-tu', 'z-vous')}\u00A0?` :
      'Emails concernant le coaching'
    return <React.Fragment>
      <FieldSet
        label={label}
        isValid={!!coachingEmailFrequency} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('coachingEmailFrequency')}
          value={coachingEmailFrequency}
          options={COACHING_EMAILS_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} une option`} />
        {isShownAsStepsDuringOnboarding ?
          <div style={{color: colors.COOL_GREY, fontSize: 13, fontStyle: 'italic', marginTop: 5}}>
            {userYou('Tu peux', 'Vous pouvez')} changer ce paramètre à tout moment
          </div> : null}
      </FieldSet>
      {isShownAsStepsDuringOnboarding ? <OnboardingCommentContent comment={comment} /> : null}
      {hasEmailInput ? <React.Fragment>
        <FieldSet
          label={`Saisis${userYou(' ton', 'sez votre')} email`} hasCheck={true}
          isValid={validateEmail(email) && !isEmailAlreadyUsed} isValidated={isValidated}>
          <Input style={inputStyle} onChange={this.handleEmailChange} value={email} />
          {isEmailAlreadyUsed ?
            <div style={{color: colors.COOL_GREY, fontSize: 13, fontStyle: 'italic', marginTop: 5}}>
              Cet email est déjà lié à un compte, <LoginLink
                email={email} isSignUp={false} visualElement="onboarding-coaching">
                connecte{userYou('-toi', 'z-vous')}
              </LoginLink> pour continuer.
            </div> : null}
        </FieldSet>
        <OnboardingCommentContent comment={emailComment} />
      </React.Fragment> : null}
    </React.Fragment>
  }

  private handleToggleNewsletter = (): void =>
    this.updater_.handleChange('isNewsletterEnabled')(!this.props.profile.isNewsletterEnabled)

  private renderNotificationsFieldSet(): React.ReactNode {
    const {profile: {gender, isNewsletterEnabled}, userYou} = this.props
    const detailsStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    const genderE = genderize('·e', 'e', '', gender)
    return <FieldSet label={`Emails concernant ${config.productName}`}>
      <div style={detailsStyle}>
        Ces emails nous serviront à {userYou('te', 'vous')} tenir informé{genderE} des évolutions
        de {config.productName}&nbsp;: nouvelles fonctionnalités, astuces, …
      </div>
      <LabeledToggle
        type="checkbox"
        label={`Suivre l'actualité de ${config.productName}`}
        isSelected={isNewsletterEnabled}
        onClick={this.handleToggleNewsletter} />
    </FieldSet>
  }

  public render(): React.ReactNode {
    const {isShownAsStepsDuringOnboarding, profile: {coachingEmailFrequency, origin},
      userYou} = this.props
    const {dispatch: omittedDispatch, ...baseProps} = this.props
    const {email, isEmailAlreadyUsed, isValidated} = this.state
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      origin,
      coachingEmailFrequency,
      coachingEmailFrequency === 'EMAIL_NONE' || validateEmail(email) && !isEmailAlreadyUsed,
    ]
    const title = isShownAsStepsDuringOnboarding ?
      `${config.productName} et ${userYou('toi', 'vous')}` :
      'Notifications & coaching'
    return <Step
      title={title}
      fastForward={this.fastForward}
      progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : undefined}
      onPreviousButtonClick={this.updater_.getBackHandler()}
      {...baseProps}>
      <FieldSet
        label={`Comment a${userYou('s-tu', 'vez vous')} connu ${config.productName} ?`}
        isValid={!!origin} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('origin')} value={origin}
          options={ORIGIN_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} une option`} />
      </FieldSet>
      {isShownAsStepsDuringOnboarding ? null : this.renderNotificationsFieldSet()}
      {checks[0] ? this.renderCoachingDetails() : null}
    </Step>
  }
}
const SettingsStep = connect()(SettingsStepBase)


export {SettingsStep}
