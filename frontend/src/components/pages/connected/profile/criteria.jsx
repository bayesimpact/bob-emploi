import CurrencyEurIcon from 'mdi-react/CurrencyEurIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {diagnoseOnboarding, setUserProfile} from 'store/actions'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS} from 'store/project'
import {youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {IconInput} from 'components/theme'
import {Select, CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {OnboardingComment, Step} from './step'


class NewProjectCriteriaStep extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    newProject: PropTypes.object,
    onSubmit: PropTypes.func,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  handleSubmit = () => {
    // minSalary is sent in unit ANNUAL_GROSS_SALARY.
    const {newProject: {employmentTypes, minSalary, workloads}, onSubmit} = this.props
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      onSubmit && onSubmit({employmentTypes, minSalary, workloads})
    }
  }

  handleChange = field => ({target: {value}}) => {
    this.handleValueChange(field)(value)
  }

  handleValueChange = field => value => {
    if (field === 'minSalary' && this.state.minSalaryCommentRead) {
      this.setState({minSalaryCommentRead: false})
    }
    this.props.dispatch(diagnoseOnboarding({projects: [{[field]: value}]}))
  }

  fastForward = () => {
    const {employmentTypes, minSalary, workloads} = this.props.newProject
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff = {}
    if (!(employmentTypes || []).length) {
      projectDiff.employmentTypes = ['CDI']
    }
    if (!(workloads || []).length) {
      projectDiff.workloads = ['FULL_TIME']
    }
    if (!minSalary) {
      projectDiff.minSalary = 21500
    }
    this.props.dispatch(diagnoseOnboarding({projects: [projectDiff]}))
    this.setState({minSalaryCommentRead: true})
  }

  isFormValid = () => {
    const {employmentTypes, workloads} = this.props.newProject
    return !!((employmentTypes || []).length > 0 &&
              (workloads || []).length > 0)
  }

  render() {
    const {newProject: {minSalary, employmentTypes, workloads}, userYou} = this.props
    const {isValidated, minSalaryCommentRead} = this.state
    const checkboxListContainerStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'space-between',
    }
    const checks = [
      (employmentTypes || []).length && (workloads || []).length,
      !minSalary || minSalaryCommentRead,
    ]
    // TODO(cyrille): Find a way to consider those steps as done (or not done yet).
    return <Step
      title={`${userYou('Tes', 'Vos')} attentes`}
      {...this.props} fastForward={this.fastForward}
      onNextButtonClick={this.handleSubmit}>
      <FieldSet
        label={`Quels types de contrat ${userYou("t'", 'vous')} intéressent\u00A0?`}
        isValid={!!(employmentTypes || []).length && !!(workloads || []).length}
        isValidated={isValidated}>
        <div style={checkboxListContainerStyle}>
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
      {checks[0] ? <React.Fragment>
        <FieldSet
          label={`Quelles sont ${userYou('tes', 'vos')} attentes de salaires\u00A0?`}
          hasNoteOrComment={true}>
          <SalaryInput value={minSalary} onChange={this.handleValueChange('minSalary')} />
          <p style={{color: colors.COOL_GREY, fontSize: 15, lineHeight: 1.3, marginBottom: 0}}>
            ({userYou('laisse', 'laissez')} vide si
            {userYou(" tu n'as", " vous n'avez")} pas d'idée précise)
          </p>
        </FieldSet>
        <OnboardingComment
          field="SALARY_FIELD" shouldShowAfter={!!minSalary}
          onDone={() => this.setState({minSalaryCommentRead: true})} key={minSalary} />
      </React.Fragment> : null}
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


const getSalaryValue = (value, unitValue) => {
  if (!value) {
    return ''
  }
  const factor = TO_GROSS_ANNUAL_FACTORS[unitValue]
  return (value / factor).toLocaleString('fr')
}


class SalaryInputBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onChange: PropTypes.func,
    unitValue: PropTypes.string.isRequired,
    value: PropTypes.number,
  }

  state = {
    // String value.
    salaryValue: '',
  }

  static getDerivedStateFromProps({unitValue, value}, {value: prevValue}) {
    if (value !== prevValue) {
      return {salaryValue: getSalaryValue(value, unitValue), value}
    }
    return null
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
    const cleanSalaryValueString = salaryValueString.replace(/[^0-9,.\xa0]/g, '')
    const salaryValue = parseFloat(cleanSalaryValueString.replace(/\xa0/g, '').replace(',', '.'))
    const factor = TO_GROSS_ANNUAL_FACTORS[salaryUnit]
    const grossAnnualValue = Math.round(salaryValue * factor)
    if (salaryValueString !== cleanSalaryValueString) {
      this.setState({
        salaryValue: getSalaryValue(grossAnnualValue, salaryUnit),
      })
    }
    onChange(grossAnnualValue)
  }

  render() {
    const {unitValue} = this.props
    const {salaryValue} = this.state
    const selectStyle = isMobileVersion ? {marginTop: 10} : {
      marginLeft: 10,
      width: 130,
    }
    return <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
      <IconInput
        iconComponent={CurrencyEurIcon}
        iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
        placeholder="Montant" inputStyle={{paddingRight: '2.1em', textAlign: 'right'}}
        value={salaryValue} onChange={this.handleSalaryValueChange} />
      <Select
        options={SALARY_UNIT_OPTIONS} value={unitValue}
        onChange={this.handleSalaryUnitChange}
        isEmptyDisabled={true}
        style={selectStyle} />
    </div>
  }
}
const SalaryInput = connect(({user}) => ({
  unitValue: user.profile.preferredSalaryUnit || 'ANNUAL_GROSS_SALARY',
  userYou: youForUser(user),
}))(SalaryInputBase)


export {NewProjectCriteriaStep}
