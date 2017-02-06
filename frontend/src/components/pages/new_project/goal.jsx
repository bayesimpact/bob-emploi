import React from 'react'

import {CitySuggest} from 'components/suggestions'
import {genderizeJob} from 'store/job'
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
    // A list of jobs that user may select. If empty, all jobs are allowed.
    // TODO(stephan): Get rid of the jobs parameter. It's not used anymore.
    jobs: React.PropTypes.array.isRequired,
    newProject: React.PropTypes.object,
    onSubmit: React.PropTypes.func.isRequired,
    userProfile: React.PropTypes.shape({
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
        cityId: '69123',
        departementId: '69',
        departementName: 'Rhône',
        name: 'Lyon',
        regionId: '84',
        regionName: 'Auvergne-Rhône-Alpes',
      }
    }
    if (kind === 'FIND_JOB' && !targetJob) {
      newState.targetJob = {
        codeOgr: '38972',
        feminineName: 'Data scientist',
        jobGroup: {
          name: 'Études et prospectives socio-économiques',
          romeId: 'M1403',
        },
        masculineName: 'Data scientist',
        name: 'Data scientist',
      }
    }
    if (!areaType) {
      newState.areaType = 'CITY'
    }
    this.setState(newState)
  }

  componentWillMount() {
    const {newProject, userProfile} = this.props
    if (newProject) {
      if (!newProject.targetJob && userProfile.latestJob) {
        newProject.targetJob = userProfile.latestJob
      }
      this.setState({...newProject})
    }
  }

  isFormValid = () => {
    const {areaType, kind, city, targetJob} = this.state
    return !!(kind && ((targetJob && city && areaType) || kind !== 'FIND_JOB'))
  }

  state = {
    areaType: null,
    city: null,
    isValidated: false,
    jobs: [],
    kind: '',
    targetJob: null,
  }

  render() {
    const {jobs, userProfile} = this.props
    const {areaType, city, kind, targetJob, isValidated} = this.state
    const maybeE = userProfile.gender === 'FEMININE' ? 'e' : ''
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
        <JobSelect
            value={targetJob}
            onChange={this.handleChange('targetJob')}
            jobs={jobs} gender={userProfile.gender} />
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


class JobSelect extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    jobs: React.PropTypes.arrayOf(React.PropTypes.object.isRequired),
    onChange: React.PropTypes.func.isRequired,
    value: React.PropTypes.object,
  }

  handleEnumJobChange = value => {
    const {jobs, onChange} = this.props
    const job = jobs.find(job => job.codeOgr === value)
    onChange(job)
  }

  render() {
    const {gender, jobs, onChange, value} = this.props
    const jobItems = jobs.map(
      job => ({name: genderizeJob(job, gender), value: job.codeOgr}))
    if (jobs.length) {
      return <Select
          options={jobItems} value={value && value.codeOgr}
          onChange={this.handleEnumJobChange} />
    }
    return <JobSuggestWithNote
        onChange={onChange} gender={gender} value={value}
        placeholder="choisir un métier" />
  }
}


export {NewProjectGoalStep}
