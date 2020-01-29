import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, commentIsShown, emailCheck,
  silentlyRegisterUser} from 'store/actions'
import {localizeOptions} from 'store/i18n'
import {COACHING_EMAILS_OPTIONS, ORIGIN_OPTIONS, getUniqueExampleEmail,
  userExample} from 'store/user'
import {validateEmail} from 'store/validations'

import {Trans} from 'components/i18n'
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

interface ConnectedProps {
  hasSeenComment: RootState['app']['hasSeenComment']
}

interface StepProps extends ProfileStepProps, ConnectedProps {
  dispatch: DispatchAllActions
}


const alreadyUsedStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 13,
  fontStyle: 'italic',
  marginTop: 5,
}


class SettingsStepBase extends React.PureComponent<StepProps, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    hasSeenComment: PropTypes.shape({
      coaching: PropTypes.bool,
      email: PropTypes.bool,
    }),
    onChange: PropTypes.func,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      coachingEmailFrequency: PropTypes.string,
      email: PropTypes.string,
      origin: PropTypes.string,
    }).isRequired,
    t: PropTypes.func.isRequired,
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
    const {dispatch, profile: {coachingEmailFrequency, email: originalEmail}} = this.props
    const {email} = this.state
    if (!email || originalEmail || coachingEmailFrequency === 'EMAIL_NONE') {
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

  private handleShownComment = _memoize((commentKey: string): (() => void) => (): void => {
    this.props.dispatch(commentIsShown(commentKey))
  })

  private renderCoachingDetails(): React.ReactNode {
    const {hasSeenComment = {}, isShownAsStepsDuringOnboarding,
      profile: {coachingEmailFrequency, email: profileEmail}, t} = this.props
    const {email, isEmailAlreadyUsed, isValidated} = this.state
    const hasEmailInput = isShownAsStepsDuringOnboarding &&
      coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE' &&
      !profileEmail
    const comment = {stringParts: [t(
      'Je vous recommande de commencer en douceur avec un coaching occasionnel. Cela augmente ' +
      'fortement vos chances de trouver un emploi rapidement. 😊',
    )]}
    const emailComment = {stringParts: [t(
      "C'est grâce à votre email que je pourrai vous accompagner dans votre coaching 🙂",
    )]}
    const inputStyle = isEmailAlreadyUsed ? {
      border: `1px solid ${colors.RED_PINK}`,
    } : {}
    const label = isShownAsStepsDuringOnboarding ?
      t('Quel type de coaching souhaitez-vous\u00A0?') :
      t('Emails concernant le coaching')
    return <React.Fragment>
      <FieldSet
        label={label}
        isValid={!!coachingEmailFrequency} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('coachingEmailFrequency')}
          value={coachingEmailFrequency}
          options={localizeOptions(t, COACHING_EMAILS_OPTIONS)}
          placeholder={t('choisissez une option')} />
        {isShownAsStepsDuringOnboarding ?
          <Trans style={{color: colors.COOL_GREY, fontSize: 13, fontStyle: 'italic', marginTop: 5}}>
            Vous pouvez changer ce paramètre à tout moment
          </Trans> : null}
      </FieldSet>
      {isShownAsStepsDuringOnboarding ?
        <OnboardingCommentContent
          comment={comment} shouldWait={!hasSeenComment.coaching}
          onShown={this.handleShownComment('coaching')} /> : null}
      {hasEmailInput ? <React.Fragment>
        <FieldSet
          label={t('Saisissez votre email')} hasCheck={true}
          isValid={validateEmail(email) && !isEmailAlreadyUsed} isValidated={isValidated}>
          <Input style={inputStyle} onChange={this.handleEmailChange} value={email} />
          {isEmailAlreadyUsed ?
            <Trans style={alreadyUsedStyle}>
              Cet email est déjà lié à un compte, <LoginLink
                email={email} isSignUp={false} visualElement="onboarding-coaching">
                connectez-vous
              </LoginLink> pour continuer.
            </Trans> : null}
        </FieldSet>
        <OnboardingCommentContent
          comment={emailComment} shouldWait={hasSeenComment.email}
          onShown={this.handleShownComment('email')} />
      </React.Fragment> : null}
    </React.Fragment>
  }

  private handleToggleNewsletter = (): void =>
    this.updater_.handleChange('isNewsletterEnabled')(!this.props.profile.isNewsletterEnabled)

  private renderNotificationsFieldSet(): React.ReactNode {
    const {profile: {gender, isNewsletterEnabled}, t} = this.props
    const detailsStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    return <FieldSet
      label={t('Newsletter de {{productName}}', {productName: config.productName})}>
      <Trans style={detailsStyle} tOptions={{context: gender}}>
        Ces emails nous serviront à vous tenir informé·e des évolutions
        de {{productName: config.productName}}&nbsp;: nouvelles fonctionnalités, astuces, …
      </Trans>
      <LabeledToggle
        type="checkbox"
        label={t("Suivre l'actualité de {{productName}}", {productName: config.productName})}
        isSelected={isNewsletterEnabled}
        onClick={this.handleToggleNewsletter} />
    </FieldSet>
  }

  public render(): React.ReactNode {
    const {isShownAsStepsDuringOnboarding,
      profile: {coachingEmailFrequency, hasCompletedOnboarding, origin}, t} = this.props
    const {dispatch: omittedDispatch, ...baseProps} = this.props
    const {email, isEmailAlreadyUsed, isValidated} = this.state
    // Keep in sync with 'isValid' props from list of fieldset below.
    const checks = [
      origin,
      coachingEmailFrequency,
      coachingEmailFrequency === 'EMAIL_NONE' || validateEmail(email) && !isEmailAlreadyUsed,
    ]
    const title = isShownAsStepsDuringOnboarding ?
      t('{{productName}} et vous', {productName: config.productName}) :
      t('Notifications & coaching')
    return <Step
      title={title}
      fastForward={this.fastForward}
      progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
      onNextButtonClick={this.isFormValid() ? this.handleSubmit : undefined}
      onPreviousButtonClick={this.updater_.getBackHandler()}
      {...baseProps}>
      {hasCompletedOnboarding && isShownAsStepsDuringOnboarding ? null : <FieldSet
        label={t(
          'Comment avez-vous connu {{productName}}\u00A0?', {productName: config.productName})}
        isValid={!!origin} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('origin')} value={origin}
          options={localizeOptions(t, ORIGIN_OPTIONS)}
          placeholder={t('choisissez une option')} />
      </FieldSet>}
      {isShownAsStepsDuringOnboarding ? null : this.renderNotificationsFieldSet()}
      {checks[0] ? this.renderCoachingDetails() : null}
    </Step>
  }
}
const SettingsStep = connect(
  ({app: {hasSeenComment}}: RootState): ConnectedProps => ({hasSeenComment}),
)(SettingsStepBase)


export {SettingsStep}
