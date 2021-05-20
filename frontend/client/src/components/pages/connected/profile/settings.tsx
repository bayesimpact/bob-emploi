import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'
import {useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'

import {DispatchAllActions, RootState, commentIsShown, emailCheck,
  silentlyRegisterUser} from 'store/actions'
import {localizeOptions} from 'store/i18n'
import {useSafeDispatch} from 'store/promise'
import {COACHING_EMAILS_OPTIONS, ORIGIN_OPTIONS, getUniqueExampleEmail,
  useUserExample} from 'store/user'
import {validateEmail} from 'store/validations'

import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import Input from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import {LoginLink} from 'components/login'
import Select from 'components/select'

import {OnboardingCommentContent, ProfileStepProps, Step, useProfileChangeCallback,
  useProfileUpdater} from './step'


const alreadyUsedStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 13,
  fontStyle: 'italic',
  marginTop: 5,
}


const fieldsRequired = {
  coachingEmailFrequency: true,
  isNewsletterEnabled: false,
  origin: true,
} as const


const SettingsStep = (props: ProfileStepProps): React.ReactElement => {
  const {isShownAsStepsDuringOnboarding, onBack, onChange, onSubmit, profile, profile: {
    coachingEmailFrequency,
    email: profileEmail,
    gender,
    hasCompletedOnboarding,
    isNewsletterEnabled,
    origin,
  }} = props
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const {t} = useTranslation()
  const {isFormValid: areFieldsSet, isValidated, handleBack, handleSubmit: submitFields} =
    useProfileUpdater(fieldsRequired, profile, onSubmit, onBack)
  const hasSeenComment = useSelector(
    ({app: {hasSeenComment}}: RootState): RootState['app']['hasSeenComment'] => hasSeenComment,
  )
  const [email, setEmail] = useState(profileEmail)
  const [isEmailAlreadyUsed, setIsEmailAlreadyUsed] = useState(false)
  const isFormValid = areFieldsSet && (
    coachingEmailFrequency === 'EMAIL_NONE' || validateEmail(email))

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!isFormValid) {
      return
    }
    if (!email || email === profileEmail || coachingEmailFrequency === 'EMAIL_NONE') {
      submitFields()
      return
    }
    const checkedEmail = await dispatch(emailCheck(email))
    if (!checkedEmail) {
      return
    }
    if (!checkedEmail.isNewUser) {
      setIsEmailAlreadyUsed(true)
      return
    }
    await dispatch(silentlyRegisterUser(email))
    submitFields()
  }, [coachingEmailFrequency, dispatch, email, isFormValid, profileEmail, submitFields])

  const userExample = useUserExample()
  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
      return
    }
    const profileDiff: {-readonly [K in keyof bayes.bob.UserProfile]?: bayes.bob.UserProfile[K]} =
      {}
    if (!origin) {
      profileDiff.origin = userExample.profile.origin
    }
    if (!coachingEmailFrequency) {
      profileDiff.coachingEmailFrequency = config.isCoachingEnabled ?
        userExample.profile.coachingEmailFrequency : 'EMAIL_NONE'
    }
    if ((coachingEmailFrequency || profileDiff.coachingEmailFrequency) !== 'EMAIL_NONE' && !email) {
      setEmail(getUniqueExampleEmail())
    }
    onChange?.({profile: profileDiff})
  }, [coachingEmailFrequency, email, handleSubmit, isFormValid, onChange, origin, userExample])

  const handleEmailChange = useCallback((email: string): void => {
    setEmail(email.toLocaleLowerCase())
    setIsEmailAlreadyUsed(false)
  }, [])

  const handleCoachingEmailFrequencyChange =
    useProfileChangeCallback('coachingEmailFrequency', profile, onChange)

  useEffect((): void => {
    if (!config.isCoachingEnabled) {
      handleCoachingEmailFrequencyChange('EMAIL_NONE')
    }
  }, [handleCoachingEmailFrequencyChange])

  const handleOriginChange = useProfileChangeCallback('origin', profile, onChange)

  const handleNewsletterChange = useProfileChangeCallback('isNewsletterEnabled', profile, onChange)
  const toggleNewsletter = useCallback(
    (): void => handleNewsletterChange(!isNewsletterEnabled),
    [handleNewsletterChange, isNewsletterEnabled],
  )

  const handleEmailShownComment = useCallback(
    (): void => void dispatch(commentIsShown('email')),
    [dispatch],
  )
  const handleCoachingShownComment = useCallback(
    (): void => void dispatch(commentIsShown('coaching')),
    [dispatch],
  )

  const renderCoachingDetails = (): React.ReactNode => {
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
          onChange={handleCoachingEmailFrequencyChange}
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
          comment={comment} shouldWait={!hasSeenComment?.coaching}
          onShown={handleCoachingShownComment} /> : null}
      {hasEmailInput ? <React.Fragment>
        <FieldSet
          label={t('Saisissez votre email')} hasCheck={true}
          isValid={validateEmail(email) && !isEmailAlreadyUsed} isValidated={isValidated}>
          <Input style={inputStyle} onChange={handleEmailChange} value={email} />
          {isEmailAlreadyUsed ?
            <Trans style={alreadyUsedStyle}>
              Cet email est déjà lié à un compte, <LoginLink
                email={email} isSignUp={false} visualElement="onboarding-coaching">
                connectez-vous
              </LoginLink> pour continuer.
            </Trans> : null}
        </FieldSet>
        <OnboardingCommentContent
          comment={emailComment} shouldWait={hasSeenComment?.email}
          onShown={handleEmailShownComment} />
      </React.Fragment> : null}
    </React.Fragment>
  }

  const renderNotificationsFieldSet = (): React.ReactNode => {
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
        onClick={toggleNewsletter} />
    </FieldSet>
  }

  // Keep in sync with 'isValid' props from list of fieldset below.
  const checks = config.isCoachingEnabled ? [
    origin,
    coachingEmailFrequency,
    coachingEmailFrequency === 'EMAIL_NONE' || validateEmail(email) && !isEmailAlreadyUsed,
  ] : [origin]
  const title = isShownAsStepsDuringOnboarding ?
    t('{{productName}} et vous', {productName: config.productName}) :
    t('Notifications & coaching')
  return <Step
    title={title}
    fastForward={fastForward}
    progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    onPreviousButtonClick={handleBack}
    {...props}>
    {hasCompletedOnboarding && isShownAsStepsDuringOnboarding ? null : <FieldSet
      label={t(
        'Comment avez-vous connu {{productName}}\u00A0?', {productName: config.productName})}
      isValid={!!origin} isValidated={isValidated} hasCheck={true}>
      <Select
        onChange={handleOriginChange} value={origin}
        options={localizeOptions(t, ORIGIN_OPTIONS)}
        placeholder={t('choisissez une option')} />
    </FieldSet>}
    {isShownAsStepsDuringOnboarding ? null : renderNotificationsFieldSet()}
    {config.isCoachingEnabled && checks[0] ? renderCoachingDetails() : null}
  </Step>
}
SettingsStep.propTypes = {
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


export default React.memo(SettingsStep)
