import React from 'react'
import {connect} from 'react-redux'

import {Colors, Select, CheckboxList, FieldSet, IconInput} from 'components/theme'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS} from 'store/project'
import {Step} from './step'
import {setUserProfile} from 'store/actions'


class NewProjectCriteriaStep extends React.Component {
  static propTypes = {
    newProject: React.PropTypes.object,
    onSubmit: React.PropTypes.func,
  }

  constructor(props) {
    super(props)
    const {employmentTypes, minSalary, workloads} = props.newProject
    this.state = {employmentTypes, minSalary, workloads}
  }

  handleSubmit = () => {
    const {onSubmit} = this.props
    const {employmentTypes, minSalary, workloads} = this.state
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      onSubmit && onSubmit({employmentTypes, minSalary, workloads})
    }
  }

  handleChange = field => event => {
    this.setState({[field]: event.target.value})
  }

  handleValueChange = field => value => {
    this.setState({[field]: value})
  }

  fastForward = () => {
    const {employmentTypes, minSalary, workloads} = this.state
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const newState = {}
    if (!(employmentTypes || []).length) {
      newState.employmentTypes = ['CDI']
    }
    if (!(workloads || []).length) {
      newState.workloads = ['FULL_TIME']
    }
    if (!minSalary) {
      newState.minSalary = 21500
    }
    this.setState(newState)
  }

  isFormValid = () => {
    const {employmentTypes, workloads} = this.state
    return !!((employmentTypes || []).length > 0 &&
              (workloads || []).length > 0)
  }

  render() {
    const {minSalary, employmentTypes, workloads, isValidated} = this.state
    return <Step
        {...this.props} fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}>
      <FieldSet
          label="Je cherche un poste en :"
          isValid={!!(employmentTypes || []).length && !!(workloads || []).length}
          isValidated={isValidated}>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <CheckboxList
              options={PROJECT_EMPLOYMENT_TYPE_OPTIONS}
              values={employmentTypes}
              onChange={this.handleValueChange('employmentTypes')} />
          <CheckboxList
              options={PROJECT_WORKLOAD_OPTIONS}
              values={workloads}
              onChange={this.handleValueChange('workloads')} />
        </div>
      </FieldSet>
      <FieldSet label="Pour un salaire de :">
        <SalaryInput value={minSalary} onChange={this.handleValueChange('minSalary')} />
        <p style={{color: Colors.COOL_GREY, fontSize: 15, lineHeight: 1.3}}>
          (laissez vide si vous n'avez pas d'idée précise)
        </p>
      </FieldSet>
    </Step>
  }
}

const SALARY_UNIT_OPTIONS = [
  {name: 'brut par an', value: 'ANNUAL_GROSS_SALARY'},
  {name: 'net par mois', value: 'MONTHLY_NET_SALARY'},
  {name: 'net par heure', value: 'HOURLY_NET_SALARY'},
]


const TO_GROSS_ANNUAL_FACTORS = {
  // net = gross x 80%
  ANNUAL_GROSS_SALARY: 1,
  HOURLY_NET_SALARY: 52 * 35 / 0.8,
  MONTHLY_NET_SALARY: 12 / 0.8,
}


class SalaryInputBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    onChange: React.PropTypes.func,
    unitValue: React.PropTypes.string.isRequired,
    value: React.PropTypes.number,
  }

  state = {
    // String value.
    salaryValue: null,
  }

  componentWillMount() {
    this.setSalaryValue(this.props)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.setSalaryValue(nextProps)
    }
  }

  setSalaryValue = props => {
    const factor = TO_GROSS_ANNUAL_FACTORS[props.unitValue]
    if (!props.value) {
      this.setState({salaryValue: ''})
      return
    }
    if (props.value === Math.round(factor * this.state.salaryValue)) {
      // No need to update the state, it's already good.
      return
    }
    this.setState({salaryValue: (props.value / factor).toLocaleString('fr')})
  }

  handleSalaryValueChange = value => {
    this.setState({salaryValue: value}, () => {
      this.handleChange(this.props.unitValue)
    })
  }

  handleSalaryUnitChange = salaryUnit => {
    this.props.dispatch(setUserProfile({
      preferredSalaryUnit: salaryUnit,
    }, true))
    this.handleChange(salaryUnit)
  }

  handleChange = salaryUnit => {
    const {onChange} = this.props
    const salaryValueString = this.state.salaryValue
    if (!salaryValueString) {
      onChange(0)
      return
    }
    const salaryValue = parseFloat(salaryValueString.replace(' ', '').replace(',', '.'))
    const factor = TO_GROSS_ANNUAL_FACTORS[salaryUnit]
    const grossAnnualValue = Math.round(salaryValue * factor)
    onChange(grossAnnualValue)
  }

  render() {
    const {unitValue} = this.props
    const {salaryValue} = this.state
    return <div style={{display: 'flex'}}>
      <IconInput
          iconName="currency-eur"
          placeholder="Montant"
          value={salaryValue} onChange={this.handleSalaryValueChange}
          style={{width: 175}} />
      <Select
          options={SALARY_UNIT_OPTIONS} value={unitValue}
          onChange={this.handleSalaryUnitChange}
          isEmptyDisabled={true}
          style={{marginLeft: 10, width: 175}} />
    </div>
  }
}
const SalaryInput = connect(({user}) => ({
  unitValue: user.profile.preferredSalaryUnit || 'ANNUAL_GROSS_SALARY',
}))(SalaryInputBase)


export {NewProjectCriteriaStep}
