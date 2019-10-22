import _memoize from 'lodash/memoize'
import CurrencyEurIcon from 'mdi-react/CurrencyEurIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, diagnoseOnboarding, setUserProfile} from 'store/actions'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS} from 'store/project'
import {userExample} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {IconInput} from 'components/theme'
import {Select, CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {OnboardingComment, Step, ProjectStepProps} from './step'


interface StepState {
  minSalaryCommentRead?: boolean
  isValidated?: boolean
}


class NewProjectCriteriaStepBase
  extends React.PureComponent<ProjectStepProps & {dispatch: DispatchAllActions}, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    newProject: PropTypes.object,
    onSubmit: PropTypes.func,
    userYou: PropTypes.func.isRequired,
  }

  public state: StepState = {}

  private handleSubmit = (): void => {
    // minSalary is sent in unit ANNUAL_GROSS_SALARY.
    const {newProject: {employmentTypes, minSalary, workloads}, onSubmit} = this.props
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      onSubmit && onSubmit({employmentTypes, minSalary, workloads})
    }
  }

  private handleChange = _memoize((field): (<T>(value: T) => void) => (value): void => {
    if (field === 'minSalary' && this.state.minSalaryCommentRead) {
      this.setState({minSalaryCommentRead: false})
    }
    this.props.dispatch(diagnoseOnboarding({projects: [{[field]: value}]}))
  })

  private fastForward = (): void => {
    const {employmentTypes, minSalary, workloads} = this.props.newProject
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!(employmentTypes || []).length) {
      projectDiff.employmentTypes = userExample.projects[0].employmentTypes
    }
    if (!(workloads || []).length) {
      projectDiff.workloads = userExample.projects[0].workloads
    }
    if (!minSalary) {
      projectDiff.minSalary = userExample.projects[0].minSalary
    }
    this.props.dispatch(diagnoseOnboarding({projects: [projectDiff]}))
    this.setState({minSalaryCommentRead: true})
  }

  private isFormValid = (): boolean => {
    const {employmentTypes, workloads} = this.props.newProject
    return !!((employmentTypes || []).length > 0 &&
              (workloads || []).length > 0)
  }

  // Handle the event marking the comment as read.
  //
  // NOTE: If there ever are any other commented fields,
  // add the field name as a parameter to the function and memoize it.
  private handleCommentRead = (): void => this.setState({minSalaryCommentRead: true})

  public render(): React.ReactNode {
    const {newProject: {minSalary, employmentTypes, workloads}, userYou} = this.props
    const {isValidated, minSalaryCommentRead} = this.state
    const checkboxListContainerStyle: React.CSSProperties = {
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
        label={`Quels types de contrat ${userYou("t'", 'vous ')}intéressent\u00A0?`}
        isValid={!!(employmentTypes || []).length && !!(workloads || []).length}
        isValidated={isValidated}>
        <div style={checkboxListContainerStyle}>
          <CheckboxList
            options={PROJECT_EMPLOYMENT_TYPE_OPTIONS}
            values={employmentTypes}
            onChange={this.handleChange('employmentTypes')} />
          <CheckboxList
            options={PROJECT_WORKLOAD_OPTIONS}
            values={workloads}
            onChange={this.handleChange('workloads')} />
        </div>
        <OnboardingComment field="EMPLOYMENT_TYPE_FIELD" shouldShowAfter={false} />
      </FieldSet>
      {checks[0] ? <React.Fragment>
        <FieldSet
          hasNoteOrComment={true} label={<React.Fragment>
            Quelles sont {userYou('tes', 'vos')} attentes en
            terme de salaire&nbsp;? (optionnel)
          </React.Fragment>}>
          <SalaryInput value={minSalary} onChange={this.handleChange('minSalary')} />
          <div style={{color: colors.COOL_GREY, marginTop: 5}}>
              Laisse{userYou('', 'z')} vide
              si {userYou("tu n'as", "vous n'avez")} pas d'idée précise
          </div>
        </FieldSet>
        <OnboardingComment
          field="SALARY_FIELD" shouldShowAfter={!!minSalary}
          onDone={this.handleCommentRead} key={minSalary} />
      </React.Fragment> : null}
    </Step>
  }
}
const NewProjectCriteriaStep = connect()(NewProjectCriteriaStepBase)


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


const getSalaryValue = (value, unitValue): string => {
  if (!value) {
    return ''
  }
  const factor = TO_GROSS_ANNUAL_FACTORS[unitValue]
  return (value / factor).toLocaleString('fr')
}


interface SalaryInputProps {
  dispatch: DispatchAllActions
  onChange: (value: number) => void
  unitValue: string
  value?: number
}


interface SalaryInputState {
  salaryValue: string
  value?: number
}


class SalaryInputBase extends React.PureComponent<SalaryInputProps, SalaryInputState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    unitValue: PropTypes.string.isRequired,
    value: PropTypes.number,
  }

  public state: SalaryInputState = {
    // String value.
    salaryValue: '',
  }

  public static getDerivedStateFromProps(
    {unitValue, value}: SalaryInputProps, {value: prevValue}: SalaryInputState):
    SalaryInputState|null {
    if (value !== prevValue) {
      return {salaryValue: getSalaryValue(value, unitValue), value}
    }
    return null
  }

  private handleSalaryValueChange = (value): void => {
    this.setState({salaryValue: value}, (): void => {
      this.handleChange(this.props.unitValue)
    })
  }

  private handleSalaryUnitChange = (salaryUnit): void => {
    this.props.dispatch(setUserProfile({
      preferredSalaryUnit: salaryUnit,
    }, true))
    this.handleChange(salaryUnit)
  }

  private handleChange = (salaryUnit): void => {
    const {onChange} = this.props
    const salaryValueString = this.state.salaryValue
    if (!salaryValueString) {
      onChange(0)
      return
    }
    const cleanSalaryValueString = salaryValueString.replace(/[^0-9,.\u00A0]/g, '')
    const salaryValue = parseFloat(cleanSalaryValueString.replace(/\u00A0/g, '').replace(',', '.'))
    const factor = TO_GROSS_ANNUAL_FACTORS[salaryUnit]
    const grossAnnualValue = Math.round(salaryValue * factor)
    if (salaryValueString !== cleanSalaryValueString) {
      this.setState({
        salaryValue: getSalaryValue(grossAnnualValue, salaryUnit),
      })
    }
    onChange(grossAnnualValue)
  }

  public render(): React.ReactNode {
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
        style={selectStyle} />
    </div>
  }
}
const SalaryInput = connect(({user}: RootState): {unitValue: string} => ({
  unitValue: user.profile && user.profile.preferredSalaryUnit || 'ANNUAL_GROSS_SALARY',
}))(SalaryInputBase)


export {NewProjectCriteriaStep}
