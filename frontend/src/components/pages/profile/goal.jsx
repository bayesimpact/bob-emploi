import React from 'react'
import PropTypes from 'prop-types'

import {CitySuggest} from 'components/suggestions'
import {FieldSet, JobSuggestWithNote, Select, Styles} from 'components/theme'
import {Step} from './step'
import {PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'


const projectKindOptions = [
  {name: 'Retrouver un emploi', value: 'FIND_A_NEW_JOB'},
  {name: 'Me reconvertir', value: 'REORIENTATION'},
  {name: 'Trouver mon premier emploi', value: 'FIND_A_FIRST_JOB'},
  {name: 'Trouver un autre emploi (je suis en poste)', value: 'FIND_ANOTHER_JOB'},
  {
    disabled: true,
    name: 'Développer une activité (bientôt disponible)',
    value: 'CREATE_OR_TAKE_OVER_COMPANY',
  },
]


const sampleJobs = [
  {
    codeOgr: '12688',
    feminineName: 'Coiffeuse',
    jobGroup: {
      name: 'Coiffure',
      romeId: 'D1202',
    },
    masculineName: 'Coiffeur',
    name: 'Coiffeur / Coiffeuse',
  },
  {
    codeOgr: '11573',
    feminineName: 'Boulangère',
    jobGroup: {
      name: 'Boulangerie - viennoiserie',
      romeId: 'D1102',
    },
    masculineName: 'Boulanger',
    name: 'Boulanger / Boulangère',
  },
]


class NewProjectGoalStep extends React.Component {
  static propTypes = {
    newProject: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
    profile: PropTypes.object,
  }

  state = {
    areaType: null,
    city: null,
    isValidated: false,
    kind: '',
    targetJob: null,
  }

  componentWillMount() {
    const {newProject} = this.props
    if (newProject) {
      this.setState(newProject)
    }
  }

  handleSubmit = () => {
    const {areaType, city, kind, targetJob} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      this.props.onSubmit({areaType, city, kind, targetJob})
    }
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }

  fastForward = () => {
    const {areaType, city, kind, targetJob} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!kind) {
      newState.kind = 'FIND_A_NEW_JOB'
    }
    if (!city) {
      newState.city = {
        cityId: '32208',
        departementId: '32',
        departementName: 'Gers',
        name: 'Lectoure',
        postcodes: '32700',
        regionId: '76',
        regionName: 'Occitanie',
      }
    }
    if (!targetJob) {
      newState.targetJob = sampleJobs[Math.floor(Math.random() * sampleJobs.length)]
    }
    if (!areaType) {
      newState.areaType = 'CITY'
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {areaType, kind, city, targetJob} = this.state
    return !!(kind && targetJob && city && areaType)
  }

  render() {
    const {profile} = this.props
    const {areaType, city, kind, targetJob, isValidated} = this.state
    const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
    return <Step
      title="Entrons dans le vif du sujet : votre projet !"
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.handleSubmit} >
      <FieldSet label="Mon projet est de :"
        isValid={!!kind} isValidated={isValidated}>
        <Select value={kind} options={projectKindOptions} onChange={this.handleChange('kind')} />
      </FieldSet>
      {/* TODO: Make this sentence depend on `kind` */}
      <FieldSet
        label="Je cherche un emploi de :"
        isValid={!!targetJob} isValidated={isValidated}>
        <JobSuggestWithNote
          placeholder="choisir un métier"
          value={targetJob}
          onChange={this.handleChange('targetJob')}
          gender={profile.gender} />
      </FieldSet>
      <FieldSet
        label={`Je suis prêt${maybeE} à bouger :`} isValid={!!areaType}
        isValidated={isValidated}>
        <Select
          options={PROJECT_LOCATION_AREA_TYPE_OPTIONS} value={areaType}
          onChange={this.handleChange('areaType')} />
      </FieldSet>
      <FieldSet
        label="Je cherche autour de :" isValid={!!city} isValidated={isValidated}>
        <CitySuggest
          onChange={this.handleChange('city')}
          style={{padding: 1, ...Styles.INPUT}}
          value={city}
          placeholder="ville ou code postal" />
      </FieldSet>
    </Step>
  }
}


export {NewProjectGoalStep}
