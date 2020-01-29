import PropTypes from 'prop-types'
import React from 'react'
import {components} from 'react-select'

import {localizeOptions, prepareT} from 'store/i18n'
import {DEGREE_OPTIONS, GENDER_OPTIONS, FAMILY_SITUATION_OPTIONS, userExample} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {BirthYearSelector, FieldSet, Select} from 'components/pages/connected/form_utils'
import {RadioGroup} from 'components/theme'

import {ProfileStepProps, ProfileUpdater, Step} from './step'


const hasHandicapOptions = [
  {name: prepareT('oui'), value: true},
  {name: prepareT('non'), value: false},
]


const generalProfileUpdater = new ProfileUpdater({
  familySituation: true,
  gender: true,
  hasHandicap: false,
  highestDegree: true,
  yearOfBirth: true,
})


interface StepState {
  // TODO(pasca): Investigate if it is ever set.
  isValidated?: boolean
}


class GeneralStep extends React.PureComponent<ProfileStepProps, StepState> {
  public static propTypes = {
    featuresEnabled: PropTypes.object,
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    onChange: PropTypes.func,
    profile: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired,
  }

  public state: StepState = {}

  private updater_ = generalProfileUpdater.attachToComponent(this)

  private fastForward = (): void => {
    if (this.updater_.isFormValid()) {
      this.updater_.handleSubmit()
      return
    }

    const {familySituation, gender, highestDegree, yearOfBirth} = this.props.profile
    const profileDiff: {-readonly [K in keyof bayes.bob.UserProfile]?: bayes.bob.UserProfile[K]} =
      {}
    if (!gender) {
      profileDiff.gender = userExample.profile.gender
    }
    if (!familySituation) {
      profileDiff.familySituation = userExample.profile.familySituation
    }
    if (!highestDegree) {
      profileDiff.highestDegree = userExample.profile.highestDegree
    }
    if (!yearOfBirth) {
      profileDiff.yearOfBirth = userExample.profile.yearOfBirth
    }
    const {onChange} = this.props
    onChange && onChange({profile: profileDiff})
  }

  public render(): React.ReactNode {
    const {isShownAsStepsDuringOnboarding, profile: {familySituation, gender,
      hasCompletedOnboarding, hasHandicap, highestDegree, yearOfBirth}, t} = this.props
    const {isValidated} = this.state
    // Keep in sync with 'isValid' fields from fieldset below.
    const checks = [
      !!gender,
      !!familySituation,
      !!yearOfBirth,
      !!highestDegree,
    ]
    const radioGroupStyle = isShownAsStepsDuringOnboarding ? {
      display: 'flex',
      justifyContent: 'space-around',
    } : {
      display: 'grid',
      gridTemplate: '1fr / 1fr 1fr',
      maxWidth: 260,
    }
    return <Step
      title={t('Votre profil')}
      fastForward={this.fastForward}
      progressInStep={checks.filter((c): boolean => c).length / (checks.length + 1)}
      onNextButtonClick={this.updater_.isFormValid() ? this.updater_.handleSubmit : undefined}
      // Hide Previous button.
      onPreviousButtonClick={null}
      {...this.props}>
      {hasCompletedOnboarding ? null : <FieldSet
        label={t('Vous êtes\u00A0:')}
        isValid={!!gender} isValidated={isValidated}>
        <RadioGroup
          style={radioGroupStyle}
          onChange={this.updater_.handleChange('gender')}
          options={localizeOptions(t, GENDER_OPTIONS)} value={gender} />
      </FieldSet>}
      {checks[0] && !hasCompletedOnboarding ? <FieldSet
        label={t('Quelle est votre situation familiale\u00A0?')}
        isValid={!!familySituation}
        isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('familySituation')}
          options={localizeOptions(t, FAMILY_SITUATION_OPTIONS)}
          placeholder={t('choisissez une situation')}
          value={familySituation} />
      </FieldSet> : null}
      {checks.slice(0, 2).every((c): boolean => c) && !hasCompletedOnboarding ? <FieldSet
        label={t('En quelle année êtes-vous né·e\u00A0?', {context: gender})}
        isValid={!!yearOfBirth} isValidated={isValidated} hasCheck={true}>
        <BirthYearSelector
          onChange={this.updater_.handleChange('yearOfBirth')}
          placeholder={t('choisissez une année')}
          value={yearOfBirth} />
      </FieldSet> : null}
      {checks.slice(0, 3).every((c): boolean => c) ? <FieldSet
        label={t('Quel est le dernier diplôme que vous avez obtenu\u00A0?')}
        isValid={!!highestDegree} isValidated={isValidated} hasCheck={true}>
        <Select<bayes.bob.DegreeLevel>
          onChange={this.updater_.handleChange('highestDegree')} value={highestDegree}
          components={{Option:
            ({children, ...props}: GetProps<typeof components['Option']>): React.ReactElement => {
              return <components.Option {...props}>
                <span style={{display: 'flex'}}>
                  <span>{children}</span>
                  <span style={{flex: 1}} />
                  <span style={{color: colors.COOL_GREY, fontStyle: 'italic'}}>
                    {props.data.equivalent}
                  </span>
                </span>
              </components.Option>
            },
          }}
          options={DEGREE_OPTIONS}
          placeholder={t("choisissez un niveau d'études")} />
      </FieldSet> : null}
      {/* TODO(pasal): Please remove the left padding on the fieldset, I can't get rid of it */}
      {checks.slice(0, 4).every((c): boolean => c) ? <FieldSet
        label={t(
          'Êtes-vous reconnu·e comme travailleu·r·se handicapé·e\u00A0?', {context: gender})}
        isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
        <RadioGroup
          style={radioGroupStyle}
          onChange={this.updater_.handleChange('hasHandicap')}
          options={localizeOptions(t, hasHandicapOptions)} value={!!hasHandicap} />
      </FieldSet> : null}
    </Step>
  }
}


export {GeneralStep}
