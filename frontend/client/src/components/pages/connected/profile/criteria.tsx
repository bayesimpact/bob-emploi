import CurrencyEurIcon from 'mdi-react/CurrencyEurIcon'
import CurrencyGbpIcon from 'mdi-react/CurrencyGbpIcon'
import CurrencyUsdIcon from 'mdi-react/CurrencyUsdIcon'
import {MdiReactIconProps} from 'mdi-react/dist/typings'
import PropTypes from 'prop-types'
import React, {useCallback, useLayoutEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, diagnoseOnboarding, setUserProfile} from 'store/actions'
import {getLanguage, localizeOptions, prepareT, toLocaleString} from 'store/i18n'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS,
  SALARY_TO_GROSS_ANNUAL_FACTORS} from 'store/project'
import {useUserExample} from 'store/user'

import Trans from 'components/i18n_trans'
import isMobileVersion from 'store/mobile'
import CheckboxList from 'components/checkbox_list'
import FieldSet from 'components/field_set'
import IconInput from 'components/icon_input'
import Select from 'components/select'

import {OnboardingComment, Step, ProjectStepProps} from './step'


const checkboxListContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'space-between',
}


const NewProjectCriteriaStep = (props: ProjectStepProps): React.ReactElement => {
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

  const userExample = useUserExample()
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
  }, [dispatch, employmentTypes, isFormValid, handleSubmit, minSalary, userExample, workloads])

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
NewProjectCriteriaStep.propTypes = {
  newProject: PropTypes.object,
  onSubmit: PropTypes.func,
  t: PropTypes.func.isRequired,
}


const SALARY_UNIT_OPTIONS = ([
  {name: prepareT('brut par an'), value: 'ANNUAL_GROSS_SALARY'},
  {name: prepareT('net par mois'), value: 'MONTHLY_NET_SALARY'},
  {name: prepareT('brut par mois'), value: 'MONTHLY_GROSS_SALARY'},
  {name: prepareT('net par heure'), value: 'HOURLY_NET_SALARY'},
  {name: prepareT('brut par heure'), value: 'HOURLY_GROSS_SALARY'},
] as const).filter(({value}) => !config.salaryUnitOptionsExcluded.includes(value))


// TODO(pascal): Fix the best option mechanism to work in different configs.
const BEST_OPTION = {
  ANNUAL_GROSS_SALARY: 'ANNUAL_GROSS_SALARY',
  HOURLY_GROSS_SALARY: 'HOURLY_NET_SALARY',
  HOURLY_NET_SALARY: 'HOURLY_NET_SALARY',
  MONTHLY_GROSS_SALARY: 'MONTHLY_NET_SALARY',
  MONTHLY_NET_SALARY: 'MONTHLY_NET_SALARY',
  UNKNOWN_SALARY_UNIT: 'ANNUAL_GROSS_SALARY',
} as const


type SalaryUnit = keyof typeof SALARY_TO_GROSS_ANNUAL_FACTORS

type CurrencySvg = {
  [key: string]: React.ComponentType<MdiReactIconProps>
}
const TO_CURRENCY_SVG: CurrencySvg = {
  '$': CurrencyUsdIcon,
  '£': CurrencyGbpIcon,
  '€': CurrencyEurIcon,
} as const

const salaryInputStyle: React.CSSProperties = config.isCurrencySignPrefixed ?
  {paddingLeft: '2.1em', textAlign: 'left'} :
  {paddingRight: '2.1em', textAlign: 'right'}

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
    const factor = SALARY_TO_GROSS_ANNUAL_FACTORS[unitValue]
    return toLocaleString(gross / factor, simpleLocale)
  }, [simpleLocale])

  const getSalaryValue = useCallback((salaryText: string, unitValue: SalaryUnit): number => {
    const cleanText = simpleLocale === 'fr' ?
      salaryText.replace(/[ \u00A0]/g, '').replace(',', '.') :
      salaryText.replace(/,/g, '')
    const factor = SALARY_TO_GROSS_ANNUAL_FACTORS[unitValue]
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

  const icon: React.ComponentType<MdiReactIconProps> = TO_CURRENCY_SVG[config.currencySign]

  return <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
    <IconInput
      iconComponent={icon}
      iconStyle={{fill: colors.PINKISH_GREY, width: 20}}
      placeholder={t('Montant')}
      inputStyle={salaryInputStyle}
      value={salaryText} onChange={handleSalaryTextChange}
      position={config.isCurrencySignPrefixed ? 'left' : 'right'} />
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


export default NewProjectCriteriaStep
