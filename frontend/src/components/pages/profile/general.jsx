import React from 'react'
import _ from 'underscore'

import {CitySuggest} from 'components/suggestions'
import {ProfileStep, ProfileStepBaseClass} from 'components/pages/profile/step'
import {FieldSet, JobSuggestWithNote, Select, RadioGroup, Styles} from 'components/theme'


const genders = [
  {name: 'un homme', value: 'MASCULINE'},
  {name: 'une femme', value: 'FEMININE'},
]

const situations = [
  {name: 'Étudiant / première recherche', value: 'FIRST_TIME'},
  {name: 'Perdu / quitté mon emploi', value: 'LOST_QUIT'},
  {name: 'Actuellement en poste', value: 'EMPLOYED'},
  {name: 'En formation professionnelle', value: 'IN_TRAINING'},
]

const latestJobLabel = {
  EMPLOYED: 'Quel est votre métier ?',
  FIRST_TIME: 'Avez-vous un métier en tête ?',
  IN_TRAINING: 'Pour quel métier ?',
  LOST_QUIT: 'Quel était ce métier ?',
}


class GeneralStep extends ProfileStepBaseClass {
  constructor(props) {
    super({
      fieldnames: {
        city: true,
        gender: true,
        latestJob: true,
        situation: true,
        yearOfBirth: true,
      },
      ...props,
    })
  }

  fastForward = () => {
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }

    const {city, gender, latestJob, situation, yearOfBirth} = this.state
    const state = {}
    if (!gender) {
      state.gender = 'FEMININE'
    }
    if (!yearOfBirth) {
      state.yearOfBirth = 1982
    }
    if (!situation) {
      state.situation = 'LOST_QUIT'
    }
    if (!latestJob) {
      state.latestJob = {
        codeOgr: '38972',
        jobGroup: {
          name: 'Études et prospectives socio-économiques',
          romeId: 'M1403',
        },
        masculineName: 'Data scientist',
        name: 'Data scientist',
      }
    }
    if (!city) {
      state.city = {
        cityId: '69123',
        departementId: '69',
        departementName: 'Rhône',
        name: 'Lyon',
        regionId: '84',
        regionName: 'Auvergne-Rhône-Alpes',
      }
    }
    this.setState(state)
  }

  handleYearOfBirthChange = event => {
    const value = event.target.value
    this.setState({yearOfBirth: value && parseInt(value) || null})
  }

  render() {
    const {isMobileVersion} = this.context
    const {city, gender, yearOfBirth, latestJob, situation, isValidated} = this.state
    return <ProfileStep
        title="Votre profil"
        fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}
        onPreviousButtonClick={this.handleBack}
        {...this.props}>
      <FieldSet label="Vous êtes" isValid={!!gender} isValidated={isValidated}>
        <RadioGroup
            style={{justifyContent: 'space-around'}}
            onChange={this.handleChange('gender')}
            options={genders} value={gender} />
      </FieldSet>
      <FieldSet
          label="Votre situation actuelle"
          isValid={!!situation} isValidated={isValidated}>
        <Select
            name="situation" options={situations} value={situation}
            onChange={this.handleChange('situation')} />
      </FieldSet>
      <FieldSet
          label={latestJobLabel[situation] || 'Votre métier ?'}
          isValid={!!latestJob} isValidated={isValidated}>
        <JobSuggestWithNote
            onChange={this.handleChange('latestJob')}
            gender={gender}
            value={latestJob}
            placeholder={'Nom du métier'} />
      </FieldSet>
      <FieldSet
          label="Année de naissance"
          isValid={!!yearOfBirth} isValidated={isValidated}
          style={{width: isMobileVersion ? 'inherit' : 140}}>
        <BirthYearSelector onChange={this.handleYearOfBirthChange} value={yearOfBirth} />
      </FieldSet>
      {/* TODO(pasal): Please remove the left padding on the fieldset, I can't get rid of it */}
      <FieldSet label="Ville de résidence actuelle"
                isValid={!!city} isValidated={isValidated}
                onMouseOver={() => this.setState({isCityHovered: true})}
                onMouseOut={() => this.setState({isCityHovered: false})} >
        <CitySuggestWithTooltip
            value={city}
            citySuggestStyle={Styles.INPUT}
            isHintShown={this.state.isCityHovered}
            onChange={this.handleChange('city')}
            placeholder="ville ou code postal">
          Renseignez bien votre ville de résidence, nous vous demanderons plus tard
          si vous cherchez du travail dans d'autres villes.
        </CitySuggestWithTooltip>
      </FieldSet>
    </ProfileStep>
  }
}


class BirthYearSelector extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
    value: React.PropTypes.number,
  }

  constructor(props) {
    super(props)
    const currentYear = new Date().getFullYear()
    // We probably don't have any users under the age of 14 or over 100
    const maxBirthYear = currentYear - 14
    const minBirthYear = currentYear - 100
    this.yearOfBirthRange = _.range(maxBirthYear, minBirthYear, -1)
  }

  state = {
    yearOfBirth: null,
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


class CitySuggestWithTooltip extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    citySuggestStyle: React.PropTypes.object,
    isHintShown: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    style: React.PropTypes.object,
    value: React.PropTypes.object,
  }

  state = {
    isCityFocused: false,
  }

  render() {
    const {children, citySuggestStyle, isHintShown, style, value,
           onChange, ...otherProps} = this.props
    return <div style={{position: 'relative', ...style}} {...otherProps}>
      <div className={`tooltip${this.state.isCityFocused || isHintShown ? ' forced' : ''}`}>
        <CitySuggest
            onChange={onChange} value={value}
            style={{padding: 1, ...citySuggestStyle}}
            onFocus={() => this.setState({isCityFocused: true})}
            onBlur={() => this.setState({isCityFocused: false})}
            placeholder="ville ou code postal" />
        <span className="tooltiptext tooltip-top">
          {children}
        </span>
      </div>
    </div>
  }
}


export {GeneralStep}
