import CurrencyEurIcon from 'mdi-react/CurrencyEurIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useLayoutEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, diagnoseOnboarding, setUserProfile} from 'store/actions'
import {getLanguage, localizeOptions, prepareT} from 'store/i18n'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS} from 'store/project'
import {userExample} from 'store/user'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {IconInput} from 'components/theme'
import {Select, CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {OnboardingComment, Step, ProjectStepProps} from './step'


const checkboxListContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'space-between',
}


const NewProjectCriteriaStepBase = (props: ProjectStepProps): React.ReactElement => {
  const {newProject: {employmentTypes, minSalary, workloads}, onSubmit, t} = props
  const [isValidated, setIsValidated] = useState(false)
  const [minSalaryCommentRead, setMinSalaryCommentRead] = useState(false)
  const dispatch = useDispatch<DispatchAllActions>()

  const isFormValid = !!((employmentTypes || []).length > 0 && (workloads || []).length > 0)

  const handleSubmit = useCallback((): void => {
    // minSalary is sent in unit ANNUAL_GROSS_SALARY.
    setIsValidated(true)
    if (isFormValid) {
      onSubmit && onSubmit({employmentTypes, minSalary, workloads})
    }
  }, [employmentTypes, isFormValid, minSalary, workloads, onSubmit])

  const handleChangeMinSalary = useCallback((minSalary: number): void => {
    if (minSalaryCommentRead) {
      setMinSalaryCommentRead(false)
    }
    dispatch(diagnoseOnboarding({projects: [{minSalary}]}))
  }, [dispatch, minSalaryCommentRead])

  const handleChangeEmploymentTypes = useCallback(
    (employmentTypes: readonly bayes.bob.EmploymentType[]): void => {
      dispatch(diagnoseOnboarding({projects: [{employmentTypes}]}))
    },
    [dispatch],
  )

  const handleChangeWorkloads = useCallback(
    (workloads: readonly bayes.bob.ProjectWorkload[]): void => {
      dispatch(diagnoseOnboarding({projects: [{workloads}]}))
    },
    [dispatch],
  )

  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
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
    dispatch(diagnoseOnboarding({projects: [projectDiff]}))
    setMinSalaryCommentRead(true)
  }, [dispatch, employmentTypes, isFormValid, handleSubmit, minSalary, workloads])

  // Handle the event marking the comment as read.
  //
  // NOTE: If there ever are any other commented fields,
  // add the field name as a parameter to the function and memoize it.
  const handleCommentRead = useCallback((): void => setMinSalaryCommentRead(true), [])
  const checks = [
    (employmentTypes || []).length && (workloads || []).length,
    !minSalary || minSalaryCommentRead,
  ]
  // TODO(cyrille): Find a way to consider those steps as done (or not done yet).
  return <Step
    title={t('Vos attentes')} {...props} fastForward={fastForward} onNextButtonClick={handleSubmit}>
    <FieldSet
      label={t('Quels types de contrat vous intéressent\u00A0?')}
      isValid={!!(employmentTypes || []).length && !!(workloads || []).length}
      isValidated={isValidated}>
      <div style={checkboxListContainerStyle}>
        <CheckboxList
          options={localizeOptions(t, PROJECT_EMPLOYMENT_TYPE_OPTIONS)}
          values={employmentTypes}
          onChange={handleChangeEmploymentTypes} />
        <CheckboxList
          options={localizeOptions(t, PROJECT_WORKLOAD_OPTIONS)}
          values={workloads}
          onChange={handleChangeWorkloads} />
      </div>
      <OnboardingComment field="EMPLOYMENT_TYPE_FIELD" shouldShowAfter={false} />
    </FieldSet>
    {checks[0] ? <React.Fragment>
      <FieldSet
        hasNoteOrComment={true}
        label={t('Quelles sont vos attentes en terme de salaire\u00A0? (optionnel)')}>
        <SalaryInput value={minSalary} onChange={handleChangeMinSalary} />
        <Trans style={{color: colors.COOL_GREY, marginTop: 5}}>
            Laissez vide si vous n'avez pas d'idée précise
        </Trans>
      </FieldSet>
      <OnboardingComment
        field="SALARY_FIELD" shouldShowAfter={!!minSalary}
        onDone={handleCommentRead} key={minSalary} />
    </React.Fragment> : null}
  </Step>
}
NewProjectCriteriaStepBase.propTypes = {
  newProject: PropTypes.object,
  onSubmit: PropTypes.func,
  t: PropTypes.func.isRequired,
}
const NewProjectCriteriaStep = React.memo(NewProjectCriteriaStepBase)


const SALARY_UNIT_OPTIONS = [
  {name: prepareT('brut par an'), value: 'ANNUAL_GROSS_SALARY'},
  {name: prepareT('net par mois'), value: 'MONTHLY_NET_SALARY'},
  {name: prepareT('net par heure'), value: 'HOURLY_NET_SALARY'},
] as const


const BEST_OPTION = {
  ANNUAL_GROSS_SALARY: 'ANNUAL_GROSS_SALARY',
  HOURLY_NET_SALARY: 'HOURLY_NET_SALARY',
  MONTHLY_GROSS_SALARY: 'MONTHLY_NET_SALARY',
  MONTHLY_NET_SALARY: 'MONTHLY_NET_SALARY',
  UNKNOWN_SALARY_UNIT: 'ANNUAL_GROSS_SALARY',
} as const


const TO_GROSS_ANNUAL_FACTORS = {
  // net = gross x 80%
  ANNUAL_GROSS_SALARY: 1,
  HOURLY_NET_SALARY: 52 * 35 / 0.8,
  MONTHLY_NET_SALARY: 12 / 0.8,
} as const
type SalaryUnit = keyof typeof TO_GROSS_ANNUAL_FACTORS


interface SalaryInputProps {
  onChange: (value: number) => void
  value?: number
}


const SalaryInputBase = (props: SalaryInputProps): React.ReactElement => {
  const {onChange, value: propsValue} = props
  const unitValue = useSelector(({user}: RootState): SalaryUnit => {
    const {preferredSalaryUnit = 'ANNUAL_GROSS_SALARY'} = user.profile || {}
    return BEST_OPTION[preferredSalaryUnit]
  })

  const dispatch = useDispatch()
  const {t} = useTranslation()
  const simpleLocale = getLanguage()

  const getSalaryText = useCallback((gross: number|undefined, unitValue: SalaryUnit): string => {
    if (!gross) {
      return ''
    }
    const factor = TO_GROSS_ANNUAL_FACTORS[unitValue]
    return (gross / factor).toLocaleString(simpleLocale)
  }, [simpleLocale])

  const getSalaryValue = useCallback((salaryText: string, unitValue: SalaryUnit): number => {
    const cleanText = simpleLocale === 'fr' ?
      salaryText.replace(/[ \u00A0]/g, '').replace(',', '.') :
      salaryText.replace(/,/g, '')
    const factor = TO_GROSS_ANNUAL_FACTORS[unitValue]
    return Math.round(Number.parseFloat(cleanText) * factor)
  }, [simpleLocale])

  const salaryTextFromProps = getSalaryText(propsValue, unitValue)
  const [salaryText, setSalaryText] = useState(salaryTextFromProps)

  useLayoutEffect(() => {
    setSalaryText(salaryTextFromProps)
  }, [salaryTextFromProps])

  const handleChange = useCallback((salaryText: string, salaryUnit: SalaryUnit): void => {
    if (!salaryText) {
      onChange(0)
      return
    }
    const cleanSalaryText = salaryText.replace(/[^\d ,.\u00A0]/g, '')
    const grossAnnual = getSalaryValue(cleanSalaryText, salaryUnit)
    if (salaryText !== cleanSalaryText) {
      setSalaryText(getSalaryText(grossAnnual, salaryUnit))
    }
    onChange(grossAnnual)
  }, [getSalaryText, getSalaryValue, onChange])

  const handleSalaryTextChange = useCallback((text: string): void => {
    setSalaryText(text)
    handleChange(text, unitValue)
  }, [handleChange, setSalaryText, unitValue])

  const handleSalaryUnitChange = useCallback((salaryUnit: SalaryUnit): void => {
    dispatch(setUserProfile({
      preferredSalaryUnit: salaryUnit,
    }, true))
    handleChange(salaryText, salaryUnit)
  }, [dispatch, handleChange, salaryText])

  const selectStyle = isMobileVersion ? {marginTop: 10} : {
    marginLeft: 10,
    width: 150,
  }
  return <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
    <IconInput
      iconComponent={CurrencyEurIcon}
      iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
      placeholder={t('Montant')} inputStyle={{paddingRight: '2.1em', textAlign: 'right'}}
      value={salaryText} onChange={handleSalaryTextChange} />
    <Select
      options={localizeOptions(t, SALARY_UNIT_OPTIONS)} value={unitValue}
      onChange={handleSalaryUnitChange}
      style={selectStyle} />
  </div>
}
SalaryInputBase.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.number,
}
const SalaryInput = React.memo(SalaryInputBase)


export {NewProjectCriteriaStep}
