import {TFunction} from 'i18next'
import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {getMonthName, lowerFirstLetter} from 'store/french'
import {LocalizableString, localizeOptions} from 'store/i18n'
import {getApplicationModeText, getApplicationModes, getPEJobBoardURL,
  weeklyApplicationOptions} from 'store/job'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, SALARY_TO_GROSS_ANNUAL_FACTORS} from 'store/project'
import {getJobSearchLengthMonths} from 'store/user'

import {CategoriesTrain, DiplomaRequirementsHistogram, FrenchDepartementsMap, InterviewHistogram,
  JobGroupStressBars, MostVaeDiplomaTable, StressPictorialChart,
  PassionLevelHistogram, getSearchLenghtCounts, DoughnutChart} from 'components/stats_charts'
import {ExternalLink, StringJoiner} from 'components/theme'


const emptyArray = [] as const

const employmentTypes = _mapValues(
  _keyBy(PROJECT_EMPLOYMENT_TYPE_OPTIONS, 'value'), ({name}): LocalizableString => name)


const getEmploymentType = (translate: TFunction, name: bayes.bob.EmploymentType): string =>
  employmentTypes[name] && translate(employmentTypes[name]) || name

interface SalaryProps extends bayes.bob.SalaryEstimation {
  title?: string
}


type MinMaxSalaryProps = SalaryProps & {
  maxSalary: number
  minSalary: number
  unit: Exclude<bayes.bob.SalaryUnit, 'UNKNOWN_SALARY_UNIT'>
}


const hasMinMaxSalaries = (p: SalaryProps): p is MinMaxSalaryProps => !!p.maxSalary && !!p.minSalary


interface SalaryBarProps {
  barHeight: number
  maxWidth: number
  max: number
  min: number
  salary: SalaryProps
  style?: React.CSSProperties
}


const SalaryBarBase = (props: SalaryBarProps): React.ReactElement => {
  const {barHeight, max, maxWidth, min, salary, style} = props
  const {maxSalary = 0, medianSalary = 0, minSalary = 0, title = ''} = salary
  const salaryToWidthFactor = maxWidth / (max - min)
  const width = (maxSalary - minSalary) * salaryToWidthFactor
  const safeSpace = width > 60 ? 0 : 30
  const barStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.GREENISH_TEAL,
    border: `1px solid ${colors.DARK_TWO}`,
    height: barHeight,
    marginBottom: '2em',
    marginLeft: (minSalary - min) * salaryToWidthFactor,
    marginTop: '2em',
    position: 'relative',
    width,
  }), [barHeight, min, minSalary, salaryToWidthFactor, width])
  const minSalaryStyle = useMemo((): React.CSSProperties => ({
    bottom: '110%',
    left: -safeSpace,
    position: 'absolute',
    transform: 'translateX(-50%)',
  }), [safeSpace])
  const maxSalaryStyle = useMemo((): React.CSSProperties => ({
    bottom: '110%',
    position: 'absolute',
    right: -safeSpace,
    transform: 'translateX(50%)',
  }), [safeSpace])
  const medianWidth = (medianSalary - minSalary) * salaryToWidthFactor

  const medianSalaryBarStyle = useMemo((): React.CSSProperties => ({
    borderRight: barStyle.border,
    height: '100%',
    width: medianWidth,
  }), [barStyle.border, medianWidth])
  const medianSalaryStyle = useMemo((): React.CSSProperties => ({
    left: medianWidth,
    position: 'absolute',
    top: '110%',
    transform: 'translateX(-50%)',
  }), [medianWidth])
  return <div style={style}>
    <h5>{title}</h5>
    <div style={{alignItems: 'center', display: 'flex'}}>
      <div style={barStyle}>
        <div style={minSalaryStyle}>{minSalary}&nbsp;€</div>
        <div style={maxSalaryStyle}>{maxSalary}&nbsp;€</div>
        {medianSalary ? <React.Fragment>
          <div style={medianSalaryBarStyle} />
          <div style={medianSalaryStyle}>{medianSalary}&nbsp;€ (médian)</div>
        </React.Fragment> : null}
      </div>
      <span style={{marginLeft: '1em'}}>brut par an</span>
    </div>
  </div>
}
const SalaryBar = React.memo(SalaryBarBase)


interface SalariesProps {
  barHeight?: number
  children: readonly SalaryProps[]
  maxWidth?: number
}

// TODO(cyrille): Consider adding minimum wage.
const SalaryBarsBase = (props: SalariesProps): React.ReactElement|null => {
  const {barHeight = 30, children, maxWidth = 500} = props
  const annualChildren = children.
    filter(hasMinMaxSalaries).
    map((child: MinMaxSalaryProps): MinMaxSalaryProps => ({
      ...child,
      maxSalary: Math.round(child.maxSalary * SALARY_TO_GROSS_ANNUAL_FACTORS[child.unit]),
      minSalary: Math.round(child.minSalary * SALARY_TO_GROSS_ANNUAL_FACTORS[child.unit]),
    }))
  if (!annualChildren.length) {
    return null
  }
  const totalMaxSalary = Math.max(...annualChildren.map(({maxSalary}): number => maxSalary))
  const totalMinSalary = Math.min(...annualChildren.map(({minSalary}): number => minSalary))
  return <React.Fragment>
    {annualChildren.map((salary: SalaryProps): React.ReactNode =>
      <SalaryBar
        key={salary.title} salary={salary} min={totalMinSalary} max={totalMaxSalary}
        barHeight={barHeight} maxWidth={maxWidth} />)}
  </React.Fragment>
}
const SalaryBars = React.memo(SalaryBarsBase)


interface StatsProps {
  categories?: readonly bayes.bob.DiagnosticCategory[]
  jobGroupInfo?: bayes.bob.JobGroup
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
  userCounts?: bayes.bob.UsersCount
}

const Stats: React.FC<StatsProps> = (props: StatsProps) => {
  // TODO(pascal): Add more.
  const {
    categories = emptyArray,
    jobGroupInfo = {}, jobGroupInfo: {
      bestDepartements = [],
      departementScores = undefined,
      requirements: {
        diplomas: diplomaRequirements = undefined,
      } = {},
    } = {},
    profile: {
      gender = 'FEMININE',
      highestDegree = undefined,
    } = {},
    project, project: {
      city = {},
      city: {departementId = undefined} = {},
      passionateLevel = undefined,
      totalInterviewCount = 0,
      weeklyApplicationsEstimate = undefined,
      targetJob = {}, targetJob: {
        jobGroup = {},
        jobGroup: {name: jobGroupName = undefined} = {},
      } = {},
      localStats, localStats: {
        imt: {
          activeMonths = emptyArray,
          employmentTypePercentages = emptyArray,
          juniorSalary = {},
          lastWeekDemand = 0,
          lastWeekOffers = 0,
          seniorSalary = {},
          yearlyAvgOffersPer10Candidates = 0,
        } = {},
        lessStressfulJobGroups = emptyArray,
        moreStressedJobseekersPercentage = 0,
        numJobOffersLastYear = 0,
        numJobOffersPreviousYear = 0,
        salary: fhsSalary = {},
        unemploymentDuration: {days: unemploymentDurationDays = 0} = {},
      } = {},
    } = {},
    userCounts: {
      longSearchInterviewCounts = undefined,
      mediumSearchInterviewCounts = undefined,
      weeklyApplicationCounts = undefined,
      passionLevelCounts = emptyArray,
    } = {},
  } = props
  const {t} = useTranslation()
  const targetJobGroups = useMemo(() => [{jobGroup, localStats}], [jobGroup, localStats])
  // TODO(cyrille): Use departements directly once it's been imported.
  const departements = departementScores || bestDepartements
  const applicationModes = getApplicationModes(jobGroupInfo)
  const {
    employmentType = '',
    percentage: contractPercentage = 0,
  } = employmentTypePercentages[0] || {}
  const searchLenghtMonths = getJobSearchLengthMonths(project)
  const specificInterviewCounts = (searchLenghtMonths < 7 ?
    mediumSearchInterviewCounts : longSearchInterviewCounts)
  const interviewText = searchLenghtMonths < 7 ? '6 mois après le début' : 'un an après le début'
  const searchLengthCounts = getSearchLenghtCounts(searchLenghtMonths, passionLevelCounts) || []

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
    padding: 20,
  }
  return <div>
    <section>
      <h2>Facteurs pris en compte pour votre score</h2>
      <CategoriesTrain
        hasFirstBlockerTag={true} areCategoryIdsShown={true}
        style={cardStyle} categories={categories} />
    </section>
    {activeMonths.length ? <section>
      <h2>Mois les plus actifs</h2>
      Ce métier recrute principalement en <StringJoiner>
        {activeMonths.map(getMonthName)}
      </StringJoiner>
    </section> : <h2>Pas de mois actifs trouvés</h2>}
    {yearlyAvgOffersPer10Candidates ? <section>
      <h2>Nombre d'offres par candidat</h2>
      {yearlyAvgOffersPer10Candidates < 0 ?
        "Il n'y a aucune offre dans ce métier dans ton département" :
        `Il y a ${yearlyAvgOffersPer10Candidates} offres pour 10 canditats`}
      {moreStressedJobseekersPercentage ?
        <StressPictorialChart
          percent={moreStressedJobseekersPercentage} gender={gender} size={200} /> : null}
    </section> : <h2>Pas d'information sur le nombre d'offres par candidat</h2>}
    {specificInterviewCounts ? <section>
      <h2>Nombre d'entretiens décrochés {interviewText} de la recherche</h2>
      <InterviewHistogram
        interviewCounts={specificInterviewCounts}
        totalInterviewCount={totalInterviewCount} />
    </section> : <h2>Pas d'information sur le nombre d'entretiens des candidats</h2>}
    {applicationModes.length ? <section>
      <h2>Canaux de candidature</h2>
      {applicationModes.map(({mode, percentage}): React.ReactNode =>
        <div key={mode || 'OTHER_CHANNELS'}>
          <strong>{getApplicationModeText(t, mode)}</strong>&nbsp;: {Math.round(percentage || 0)}%
        </div>)}
    </section> : <h2>Pas de canal de candidature clairement déterminé</h2>}
    {departements.length ? <section>
      <h2>
        Concurrence en France en {lowerFirstLetter(jobGroupName || '')}
      </h2>
      <FrenchDepartementsMap
        departements={departements} selectedDepartementId={departementId} style={{maxWidth: 500}} />
    </section> : <h2>Pas de département particulièrement en demande</h2>}
    {employmentType ? <section>
      <h2>Type de contrat</h2>
      {Math.round(contractPercentage)}% des offres sont en {getEmploymentType(t, employmentType)}
    </section> : <h2>Pas de type de contrat clairement défini</h2>}
    {numJobOffersLastYear || numJobOffersPreviousYear ? <section>
      <h2>Évolution du nombre d'offres</h2>
      {numJobOffersPreviousYear ?
        `${numJobOffersPreviousYear} offres dans le département en 2015` :
        'Pas de données pour 2015'}<br />
      {numJobOffersLastYear ? `${numJobOffersLastYear} offres dans le département en 2016` :
        'Pas de données pour 2016'}
    </section> : <h2>Pas de données d'évolution du nombre d'offres</h2>}
    {unemploymentDurationDays ? <section>
      <h2>Durée médiane sans emploi</h2>
      50% des gens mettent plus de {unemploymentDurationDays} jours à trouver un emploi
    </section> : <h2>Pas de données sur la durée médiane sans emploi</h2>}
    {fhsSalary.minSalary || juniorSalary.minSalary || seniorSalary.minSalary ? <section>
      <h2>Salaires</h2>
      <SalaryBars>{[
        {...fhsSalary, title: "D'après le FHS"},
        {...juniorSalary, title: 'Pour un junior (IMT)'},
        {...seniorSalary, title: 'Pour un senior (IMT)'},
      ]}</SalaryBars>
    </section> : <h2>Pas d'information sur les salaires</h2>}
    {lastWeekOffers || lastWeekDemand ? <section>
      <h2>La semaine dernière</h2>
      <ul>
        {lastWeekOffers ? <li><ExternalLink
          // Only keep offers emitted in the last 7 days.
          href={getPEJobBoardURL(targetJob, city, {emission: 7})}>
          {lastWeekOffers} offre{lastWeekOffers > 1 ? 's' : ''}</ExternalLink></li> : null}
        {lastWeekDemand ? <li>
          {lastWeekDemand} demandeur{lastWeekDemand > 1 ? 's' : ''} d'emploi
        </li> : null}
      </ul>
    </section> : <h2>Pas d'information sur les offres en cours.</h2>}
    {lessStressfulJobGroups.length ? <section>
      <h2>Meilleurs domaines dans le département</h2>
      <JobGroupStressBars
        targetJobGroups={targetJobGroups} areMarketScoresShown={true}
        jobGroups={lessStressfulJobGroups} style={{maxWidth: 600}} />
    </section> : <h2>
      Les metiers proches ont autant, voire plus, de concurrence dans ce département
    </h2>}
    {weeklyApplicationCounts ? <section>
      <h2>Nombre de candidatures hebdomadaires des utilisateurs de {config.productName}</h2>
      <DoughnutChart
        counts={weeklyApplicationCounts} labels={localizeOptions(t, weeklyApplicationOptions)}
        numApplications={weeklyApplicationsEstimate} />
    </section> :
      <h2>Pas d'infos sur les candidatures des utilisateurs de {config.productName}</h2>}
    {diplomaRequirements ? <section>
      <h2>Pourcentage des offres accessibles selon le diplôme</h2>
      <DiplomaRequirementsHistogram
        requirements={diplomaRequirements} highestDegree={highestDegree} />
    </section> : <h2>Pas d'infos sur les diplômes requis pour ce métier</h2>}
    <section>
      <h2>Diplômes le plus souvent obtenus par une VAE</h2>
      <MostVaeDiplomaTable targetJobGroup={jobGroup} />
    </section>
    {searchLengthCounts.length ? <section>
      <h2>Motivation des utilisateurs de Bob</h2>
      <PassionLevelHistogram counts={searchLengthCounts} passionLevel={passionateLevel} />
    </section> : <h2>Pas d'information sur la motivation des utilisateurs.</h2>}
  </div>
}
const StatsMemo = React.memo(Stats)


export {StatsMemo as Stats}
