import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React from 'react'
import {components} from 'react-select'

import {DEGREE_OPTIONS, getFamilySituationOptions, youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {FieldSet, RadioGroup, Select} from 'components/pages/connected/form_utils'

import {Step, ProfileUpdater} from './step'


const genders = [
  {name: 'une femme', value: 'FEMININE'},
  {name: 'un homme', value: 'MASCULINE'},
]

const addresses = [
  {name: 'oui', value: true},
  {name: 'non', value: false},
]

const hasHandicapOptions = [
  {name: 'oui', value: true},
  {name: 'non', value: false},
]


const generalProfileUpdater = new ProfileUpdater({
  canTutoie: false,
  familySituation: true,
  gender: true,
  hasHandicap: false,
  highestDegree: true,
  yearOfBirth: true,
})


class GeneralStep extends React.Component {
  static propTypes = {
    featuresEnabled: PropTypes.object,
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    onChange: PropTypes.func,
    profile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  updater_ = generalProfileUpdater.attachToComponent(this)

  userYou = youForUser({profile: this.props.profile})

  fastForward = () => {
    if (this.updater_.isFormValid()) {
      this.updater_.handleSubmit()
      return
    }

    const {familySituation, gender, highestDegree, yearOfBirth} = this.props.profile
    const profileDiff = {}
    if (!gender) {
      profileDiff.gender = Math.random() > .5 ? 'FEMININE' : 'MASCULINE'
    }
    if (!familySituation) {
      const familySituations = getFamilySituationOptions()
      const familySituationIndex = Math.floor(Math.random() * familySituations.length)
      profileDiff.familySituation = familySituations[familySituationIndex].value
    }
    if (!highestDegree) {
      const degrees = DEGREE_OPTIONS
      profileDiff.highestDegree = degrees[Math.floor(Math.random() * degrees.length)].value
    }
    if (!yearOfBirth) {
      profileDiff.yearOfBirth = Math.round(1950 + 50 * Math.random())
    }
    this.props.onChange({profile: profileDiff})
  }

  render() {
    const {isShownAsStepsDuringOnboarding, profile: {canTutoie, familySituation, gender,
      hasHandicap, highestDegree, yearOfBirth}, userYou} = this.props
    const {isValidated} = this.state
    const isFeminine = gender === 'FEMININE'
    // Keep in sync with 'isValid' fields from fieldset below.
    const checks = [
      gender,
      familySituation,
      yearOfBirth,
      highestDegree,
    ]
    return <Step
      title={`${userYou('Ton', 'Votre')} profil`}
      fastForward={this.fastForward}
      progressInStep={checks.filter(c => c).length / (checks.length + 1)}
      onNextButtonClick={this.updater_.isFormValid() ? this.updater_.handleSubmit : null}
      // Hide Previous button.
      onPreviousButtonClick={null}
      {...this.props}>
      <FieldSet
        label={`${userYou('Tu es', 'Vous êtes')} :`}
        isValid={!!gender} isValidated={isValidated}>
        <RadioGroup
          style={{justifyContent: 'space-around'}}
          onChange={this.updater_.handleChange('gender')}
          options={genders} value={gender} />
      </FieldSet>
      {isShownAsStepsDuringOnboarding ? null :
        <FieldSet
          label={`Désire${userYou('s-tu toujours', 'z-vous')} être tutoyé\u00A0?`}
          isValid={true} isValidated={isValidated}>
          <RadioGroup
            style={{justifyContent: 'space-around'}}
            onChange={this.updater_.handleChange('canTutoie')}
            options={addresses} value={!!canTutoie} />
        </FieldSet>}
      {checks[0] ? <FieldSet
        label={`Quelle est ${userYou('ta', 'votre')} situation familiale\u00A0?`}
        isValid={!!familySituation}
        isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('familySituation')}
          options={getFamilySituationOptions(gender)}
          placeholder={`choisis${userYou('', 'sez')} une situation`}
          value={familySituation} />
      </FieldSet> : null}
      {checks.slice(0, 2).every(c => c) ? <FieldSet
        label={`En quelle
          année ${userYou('es-tu', 'êtes-vous')} né${gender === 'FEMININE' ? 'e' : ''}\u00A0?`}
        isValid={!!yearOfBirth} isValidated={isValidated} hasCheck={true}>
        <BirthYearSelector
          onChange={this.updater_.handleChange('yearOfBirth')}
          placeholder={`choisis${userYou('', 'sez')} une année`}
          value={yearOfBirth} />
      </FieldSet> : null}
      {checks.slice(0, 3).every(c => c) ? <FieldSet
        label={`Quel est le dernier diplôme que ${userYou('tu as', 'vous avez')} obtenu\u00A0?`}
        isValid={!!highestDegree} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('highestDegree')} value={highestDegree}
          components={{Option: ({children, ...props}) => {
            return <components.Option {...props}>
              <span style={{display: 'flex'}}>
                <span>{children}</span>
                <span style={{flex: 1}} />
                <span style={{color: colors.COOL_GREY, fontStyle: 'italic'}}>
                  {props.data.equivalent}
                </span>
              </span>
            </components.Option>
          }}}
          options={DEGREE_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} un niveau d'études`} />
      </FieldSet> : null}
      {/* TODO(pasal): Please remove the left padding on the fieldset, I can't get rid of it */}
      {checks.slice(0, 4).every(c => c) ? <FieldSet
        label={`${userYou('Es-tu ', 'Êtes-vous')} reconnu${isFeminine ? 'e' : ''} comme
            travailleu${isFeminine ? 'se' : 'r'} handicapé${isFeminine ? 'e' : ''}\u00A0?`}
        isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
        <RadioGroup
          style={{justifyContent: 'space-around'}}
          onChange={this.updater_.handleChange('hasHandicap')}
          options={hasHandicapOptions} value={!!hasHandicap} />
      </FieldSet> : null}
    </Step>
  }
}


class BirthYearSelector extends React.Component {
  static propTypes = {
    value: PropTypes.number,
  }

  yearOfBirthRange = (() => {
    const currentYear = new Date().getFullYear()
    // We probably don't have any users under the age of 14 or over 100
    const maxBirthYear = currentYear - 14
    const minBirthYear = currentYear - 100
    return _range(minBirthYear, maxBirthYear).map(year =>
      ({name: year + '', value: year})
    )
  })()

  render() {
    const {value, ...otherProps} = this.props
    return <Select
      value={value}
      options={this.yearOfBirthRange}
      defaultMenuScroll={this.yearOfBirthRange.length - 20}
      {...otherProps} />
  }
}


export {GeneralStep}
