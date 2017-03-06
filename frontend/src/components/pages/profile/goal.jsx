import React from 'react'

import {CitySuggest} from 'components/suggestions'
import {FieldSet, JobSuggestWithNote, Select, Styles} from 'components/theme'
import {Step} from './step'
import {PROJECT_LOCATION_AREA_TYPE_OPTIONS} from 'store/project'


const projectKindOptions = [
  {name: 'Trouver un emploi', value: 'FIND_JOB'},
  {name: 'Me réorienter', value: 'REORIENTATION'},
  {
    disabled: true,
    name: 'Développer une activité (bientôt disponible)',
    value: 'CREATE_OR_TAKE_OVER_COMPANY',
  },
]


class NewProjectGoalStep extends React.Component {
  static propTypes = {
    newProject: React.PropTypes.object,
    onSubmit: React.PropTypes.func.isRequired,
    profile: React.PropTypes.shape({
      latestJob: React.PropTypes.object,
    }),
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
      newState.kind = 'FIND_JOB'
    }
    if (!city) {
      newState.city = {
        cityId: '32700',
        departementId: '32',
        departementName: 'Gers',
        name: 'Lectoure',
        regionId: '76',
        regionName: 'Occitanie',
      }
    }
    if (!targetJob) {
      newState.targetJob = {
        codeOgr: '12688',
        feminineName: 'Coiffeuse',
        jobGroup: {
          name: 'Coiffure',
          romeId: 'D1202',
        },
        masculineName: 'Coiffeur',
        name: 'Coiffeur / Coiffeuse',
      }
    }
    if (!areaType) {
      newState.areaType = 'CITY'
    }
    this.setState(newState)
  }

  componentWillMount() {
    const {newProject, profile} = this.props
    if (newProject) {
      if (!newProject.targetJob && profile.latestJob) {
        newProject.targetJob = profile.latestJob
      }
      if (!newProject.city && profile.city) {
        newProject.city = profile.city
      }
      this.setState({...newProject})
    }
  }

  isFormValid = () => {
    const {areaType, kind, city, targetJob} = this.state
    return !!(kind && targetJob && city && areaType)
  }

  state = {
    areaType: null,
    city: null,
    isValidated: false,
    kind: '',
    targetJob: null,
  }

  render() {
    const {profile} = this.props
    const {areaType, city, kind, targetJob, isValidated} = this.state
    const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
    return <Step {...this.props} fastForward={this.fastForward}
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
          label="Je cherche autour de :" isValid={!!city} isValidated={isValidated}>
        <CitySuggest
            onChange={this.handleChange('city')}
            style={{padding: 1, ...Styles.INPUT}}
            value={city}
            placeholder="ville ou code postal" />
      </FieldSet>
      <FieldSet
          label={`Je suis prêt${maybeE} à bouger :`} isValid={!!areaType}
          isValidated={isValidated}>
        <Select
            options={PROJECT_LOCATION_AREA_TYPE_OPTIONS} value={areaType}
            onChange={this.handleChange('areaType')} />
      </FieldSet>
    </Step>
  }
}


export {NewProjectGoalStep}
