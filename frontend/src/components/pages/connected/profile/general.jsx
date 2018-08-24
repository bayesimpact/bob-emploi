import _range from 'lodash/range'
import React from 'react'
import PropTypes from 'prop-types'

import {DEGREE_OPTIONS, getFamilySituationOptions, youForUser} from 'store/user'

import {DashboardExportCreator} from 'components/dashboard_export_creator'
import {isMobileVersion} from 'components/mobile'
import {FieldSet, RadioGroup, Select} from 'components/pages/connected/form_utils'

import {Step, ProfileUpdater} from './step'


const genders = [
  {name: 'une femme', value: 'FEMININE'},
  {name: 'un homme', value: 'MASCULINE'},
]

const hasHandicapOptions = [
  {name: 'oui', value: true},
  {name: 'non', value: false},
]


const generalProfileUpdater = new ProfileUpdater({
  familySituation: true,
  gender: true,
  hasHandicap: false,
  highestDegree: true,
  yearOfBirth: true,
})


class GeneralStep extends React.Component {
  static propTypes = {
    featuresEnabled: PropTypes.object,
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
    const {featuresEnabled = {}, profile: {familySituation, gender, hasHandicap, highestDegree,
      yearOfBirth}, userYou} = this.props
    const {isValidated} = this.state
    const isFeminine = gender === 'FEMININE'
    const exportOldDataLinkStyle = {
      color: colors.BOB_BLUE,
      cursor: 'pointer',
      fontSize: 15,
      textDecoration: 'underline',
    }
    // Keep in sync with 'isValid' fields from fieldset below.
    const checks = [
      gender,
      familySituation,
      yearOfBirth,
      highestDegree,
    ]
    // TODO(marielaure): Add Tutoiement.
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
      {checks[0] ? <FieldSet
        label={`Quelle est ${userYou('ta', 'votre')} situation familiale ?`}
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
          année ${userYou('es-tu', 'êtes-vous')} né${gender === 'FEMININE' ? 'e' : ''} ?`}
        isValid={!!yearOfBirth} isValidated={isValidated} hasCheck={true}>
        <BirthYearSelector
          onChange={this.updater_.handleChange('yearOfBirth')}
          placeholder={`choisis${userYou('', 'sez')} une année`}
          value={yearOfBirth} />
      </FieldSet> : null}
      {checks.slice(0, 3).every(c => c) ? <FieldSet
        label={`Quel est le dernier diplôme que ${userYou('tu as', 'vous avez')} obtenu ?`}
        isValid={!!highestDegree} isValidated={isValidated} hasCheck={true}>
        <Select
          onChange={this.updater_.handleChange('highestDegree')} value={highestDegree}
          options={DEGREE_OPTIONS}
          placeholder={`choisis${userYou('', 'sez')} un niveau d'études`} />
      </FieldSet> : null}
      {/* TODO(pasal): Please remove the left padding on the fieldset, I can't get rid of it */}
      {checks.slice(0, 4).every(c => c) ? <FieldSet
        label={`${userYou('Es-tu ', 'Êtes-vous')} reconnu${isFeminine ? 'e' : ''} comme
            travailleu${isFeminine ? 'se' : 'r'} handicapé${isFeminine ? 'e' : ''} ?`}
        isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
        <RadioGroup
          style={{justifyContent: 'space-around'}}
          onChange={this.updater_.handleChange('hasHandicap')}
          options={hasHandicapOptions} value={!!hasHandicap} />
      </FieldSet> : null}

      {featuresEnabled.switchedFromMashupToAdvisor ? <DashboardExportCreator
        style={exportOldDataLinkStyle}>
        Accèder aux données de l'ancien {config.productName}
      </DashboardExportCreator> : null}
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
