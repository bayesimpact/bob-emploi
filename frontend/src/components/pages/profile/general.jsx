import React from 'react'
import PropTypes from 'prop-types'
import _ from 'underscore'

import config from 'config'

import {DEGREE_OPTIONS, ORIGIN_OPTIONS, getFamilySituationOptions} from 'store/user'

import {DashboardExportCreator} from 'components/dashboard_export_creator'
import {Step, ProfileUpdater} from 'components/pages/profile/step'
import {Colors, FieldSet, RadioGroup, Select, Styles} from 'components/theme'


const genders = [
  {name: 'une femme', value: 'FEMININE'},
  {name: 'un homme', value: 'MASCULINE'},
]

const hasHandicapOptions = [
  {name: 'oui', value: true},
  {name: 'non', value: false},
]


class GeneralStep extends React.Component {
  static propTypes = {
    featuresEnabled: PropTypes.object,
    isShownAsStepsDuringOnboarding: PropTypes.bool,
  }

  componentWillMount() {
    this.updater_ = new ProfileUpdater(
      {
        familySituation: true,
        gender: true,
        hasHandicap: false,
        highestDegree: true,
        origin: true,
        yearOfBirth: true,
      },
      this,
      this.props,
    )
  }

  fastForward = () => {
    if (this.updater_.isFormValid()) {
      this.updater_.handleSubmit()
      return
    }

    const {familySituation, gender, highestDegree, origin, yearOfBirth} = this.state
    const state = {}
    if (!gender) {
      state.gender = Math.random() > .5 ? 'FEMININE' : 'MASCULINE'
    }
    if (!familySituation) {
      const familySituations = getFamilySituationOptions()
      const familySituationIndex = Math.floor(Math.random() * familySituations.length)
      state.familySituation = familySituations[familySituationIndex].value
    }
    if (!highestDegree) {
      const degrees = DEGREE_OPTIONS
      state.highestDegree = degrees[Math.floor(Math.random() * degrees.length)].value
    }
    if (!origin) {
      const origins = ORIGIN_OPTIONS
      state.origin = origins[Math.floor(Math.random() * origins.length)].value
    }
    if (!yearOfBirth) {
      state.yearOfBirth = Math.round(1950 + 50 * Math.random())
    }
    this.setState(state)
  }

  handleYearOfBirthChange = event => {
    const value = event.target.value
    this.setState({yearOfBirth: value && parseInt(value) || null})
  }

  render() {
    const {isShownAsStepsDuringOnboarding} = this.props
    const {familySituation, gender, hasHandicap, highestDegree, origin, yearOfBirth,
      isValidated} = this.state
    const featuresEnabled = this.props.featuresEnabled || {}
    const isFeminine = gender === 'FEMININE'
    const exportOldDataLinkStyle = {
      color: Colors.SKY_BLUE,
      cursor: 'pointer',
      fontSize: 15,
      textDecoration: 'underline',
    }
    return <Step
      title={isShownAsStepsDuringOnboarding ? 'À propos de vous' : 'Votre profil'}
      fastForward={this.fastForward}
      onNextButtonClick={this.updater_.handleSubmit}
      onPreviousButtonClick={this.updater_.handleBack}
      {...this.props}>
      <FieldSet label="Vous êtes" isValid={!!gender} isValidated={isValidated}>
        <RadioGroup
          style={{justifyContent: 'space-around'}}
          onChange={this.updater_.handleChange('gender')}
          options={genders} value={gender} />
      </FieldSet>
      <FieldSet
        label="Votre situation familiale" isValid={!!familySituation}
        isValidated={isValidated}>
        <Select
          onChange={this.updater_.handleChange('familySituation')}
          options={getFamilySituationOptions(gender)}
          value={familySituation} />
      </FieldSet>
      <FieldSet
        label="Année de naissance"
        isValid={!!yearOfBirth} isValidated={isValidated}>
        <BirthYearSelector onChange={this.handleYearOfBirthChange} value={yearOfBirth} />
      </FieldSet>
      <FieldSet
        label="Dernier diplôme obtenu"
        isValid={!!highestDegree} isValidated={isValidated}>
        <Select
          onChange={this.updater_.handleChange('highestDegree')} value={highestDegree}
          options={DEGREE_OPTIONS} />
      </FieldSet>
      {/* TODO(pasal): Please remove the left padding on the fieldset, I can't get rid of it */}
      <FieldSet
        label={`Vous êtes reconnu${isFeminine ? 'e' : ''} comme
            travailleu${isFeminine ? 'se' : 'r'} handicapé${isFeminine ? 'e' : ''}`}
        isValid={true} isValidated={isValidated} style={{minWidth: 350}}>
        <RadioGroup
          style={{justifyContent: 'space-around'}}
          onChange={this.updater_.handleChange('hasHandicap')}
          options={hasHandicapOptions} value={!!hasHandicap} />
      </FieldSet>
      <FieldSet
        label={`Comment avez vous connu ${config.productName} ?`}
        isValid={!!origin} isValidated={isValidated}>
        <Select
          onChange={this.updater_.handleChange('origin')} value={origin}
          options={ORIGIN_OPTIONS} />
      </FieldSet>

      {featuresEnabled.switchedFromMashupToAdvisor ? <DashboardExportCreator
        style={exportOldDataLinkStyle}>
        Accèder aux données de l'ancien Bob Emploi
      </DashboardExportCreator> : null}
    </Step>
  }
}


class BirthYearSelector extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    value: PropTypes.number,
  }

  state = {
    yearOfBirth: null,
  }

  componentWillMount() {
    const currentYear = new Date().getFullYear()
    // We probably don't have any users under the age of 14 or over 100
    const maxBirthYear = currentYear - 14
    const minBirthYear = currentYear - 70
    this.yearOfBirthRange = _.range(minBirthYear, maxBirthYear, 1)
  }

  render() {
    const {yearOfBirth} = this.state
    const {value, style, ...otherProps} = this.props
    const selectStyle = {
      ...Styles.INPUT,
      ...style,
    }
    return <select value={value || yearOfBirth || ''} style={selectStyle} {...otherProps}>
      <option></option>
      {this.yearOfBirthRange.map(year => {
        return <option key={year} value={year}>{year}</option>
      })}
    </select>
  }
}


export {GeneralStep}
