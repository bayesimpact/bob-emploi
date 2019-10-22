import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'

import React from 'react'

import {getMonthName, lowerFirstLetter, vouvoyer} from 'store/french'
import {getApplicationModeText, getApplicationModes, getPEJobBoardURL,
  weeklyApplicationOptions} from 'store/job'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, SALARY_TO_GROSS_ANNUAL_FACTORS} from 'store/project'
import {getJobSearchLengthMonths} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {CategoriesTrain, DiplomaRequirementsHistogram, FrenchDepartementsMap, InterviewHistogram,
  JobGroupStressBars, StressPictorialChart} from 'components/stats_charts'
import {colorToAlpha, ExternalLink, StringJoiner} from 'components/theme'


const emptyArray = [] as const

const employmentTypes = _mapValues(
  _keyBy(PROJECT_EMPLOYMENT_TYPE_OPTIONS, 'value'), ({name}): string => name)


const getEmploymentType = (name: bayes.bob.EmploymentType): string =>
  employmentTypes[name] || name

interface SalaryProps extends bayes.bob.SalaryEstimation {
  title?: string
}


type MinMaxSalaryProps = SalaryProps & {
  maxSalary: number
  minSalary: number
  unit: bayes.bob.SalaryUnit
}


const hasMinMaxSalaries = (p: SalaryProps): p is MinMaxSalaryProps => !!p.maxSalary && !!p.minSalary


interface SalariesProps {
  barHeight: number
  children: readonly SalaryProps[]
  maxWidth: number
}

class SalaryBars extends React.PureComponent<SalariesProps> {
  public static defaultProps = {
    barHeight: 30,
    maxWidth: 500,
  }

  private renderBar(salary: SalaryProps, min: number, max: number, style?: React.CSSProperties):
  React.ReactNode {
    const {maxSalary = 0, medianSalary = 0, minSalary = 0, title = ''} = salary
    const {barHeight, maxWidth} = this.props
    const salaryToWidthFactor = maxWidth / (max - min)
    const width = (maxSalary - minSalary) * salaryToWidthFactor
    const safeSpace = width > 60 ? 0 : 30
    const barStyle: React.CSSProperties = {
      backgroundColor: colors.GREENISH_TEAL,
      border: `1px solid ${colors.DARK_TWO}`,
      height: barHeight,
      marginBottom: '2em',
      marginLeft: (minSalary - min) * salaryToWidthFactor,
      marginTop: '2em',
      position: 'relative',
      width,
    }
    const minSalaryStyle: React.CSSProperties = {
      bottom: '110%',
      left: -safeSpace,
      position: 'absolute',
      transform: 'translateX(-50%)',
    }
    const maxSalaryStyle: React.CSSProperties = {
      bottom: '110%',
      position: 'absolute',
      right: -safeSpace,
      transform: 'translateX(50%)',
    }
    const medianWidth = (medianSalary - minSalary) * salaryToWidthFactor

    const medianSalaryBarStyle: React.CSSProperties = {
      borderRight: barStyle.border,
      height: '100%',
      width: medianWidth,
    }
    const medianSalaryStyle: React.CSSProperties = {
      left: medianWidth,
      position: 'absolute',
      top: '110%',
      transform: 'translateX(-50%)',
    }
    return <div style={style} key={title}>
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

  // TODO(cyrille): Consider adding minimum wage.
  public render(): React.ReactNode {
    const {children} = this.props
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
        this.renderBar(salary, totalMinSalary, totalMaxSalary))}
    </React.Fragment>
  }
}

interface CountProps {
  [label: string]: number
}

interface ApplicationOption {
  name: string
  value: string
}

interface DoughnutProps {
  counts: CountProps
  circlePadding: number
  height: number
  isSegmentsStartingTop: boolean
  labels: ApplicationOption[]
  style?: React.CSSProperties
  thickness: number
}

interface AttributeProps {
  color: string
  name: string
  percentage: number
  strokeDiff: number
  value: string
}

class DoughnutChart extends React.PureComponent<DoughnutProps> {
  public static defaultProps = {
    circlePadding: 10,
    height: 160,
    isSegmentsStartingTop: true,
    thickness: 30,
  }

  private computeAngleOffsets(attributes: AttributeProps[], initialOffset: number): CountProps {
    const angleOffsets = {}
    attributes.reduce((offset, {percentage, value}): number => {
      angleOffsets[value] = offset
      return percentage * 360 + offset
    }, initialOffset)
    return angleOffsets
  }

  private getDoughnutAttributes(
    labels: ApplicationOption[], counts: CountProps, circumference: number): AttributeProps[] {
    const nbLabels = labels.length
    const totalCounts = Object.values(counts).reduce((a: number, b: number): number => a + b)

    return labels.map(({name, value}, index): AttributeProps => {
      const percentage = counts[value] / totalCounts
      const color = colorToAlpha(colors.BOB_BLUE, (index + 1) / nbLabels)
      const strokeDiff = circumference - percentage * circumference
      return {color, name, percentage, strokeDiff, value}
    })
  }

  public render(): React.ReactNode {
    const {counts, circlePadding, isSegmentsStartingTop, height, labels,
      thickness, style} = this.props
    const cx = height / 2
    const cy = cx
    const initialAngleOffset = isSegmentsStartingTop ? -90 : 0
    const radius = cx - 2 * circlePadding
    const circumference = 2 * Math.PI * radius
    const attributes = this.getDoughnutAttributes(labels, counts, circumference)
    const angleOffsets = this.computeAngleOffsets(attributes, initialAngleOffset)
    const figureStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      ...style,
    }
    const captionRowStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      marginLeft: isMobileVersion ? 0 : '1em',
      marginTop: 10,
    }
    const captionEltStyle = (color): React.CSSProperties => ({
      backgroundColor: color,
      borderRadius: '.2em',
      height: '1em',
      marginRight: 5,
      width: '1.618em',
    })
    return <figure style={figureStyle}>
      <svg height={2 * cx} width={2 * cx} viewBox={`0 0 ${2 * cx} ${2 * cx}`}>
        <g>
          {attributes.map(({color, strokeDiff, value}, index): React.ReactNode =>
            <circle
              cx={cx} cy={cy} r={radius} fill="transparent"
              stroke={color} strokeWidth={thickness}
              strokeDasharray={circumference} key={`circle-${index}`}
              strokeDashoffset={strokeDiff}
              transform={`rotate(${angleOffsets[value]}, ${cx}, ${cy})`}>
            </circle>)}
        </g>
      </svg>
      <figcaption style={{marginTop: isMobileVersion ? 0 : -10}}>
        {attributes.map(({color, name, percentage, value}): React.ReactNode =>
          percentage ? <div style={captionRowStyle} key={value}>
            <div style={captionEltStyle(color)} />
            {name}
          </div> : null)}
      </figcaption>
    </figure>
  }
}


interface StatsProps {
  categories?: readonly bayes.bob.DiagnosticCategory[]
  jobGroupInfo?: bayes.bob.JobGroup
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
  userCounts?: bayes.bob.UsersCount
}

class Stats extends React.PureComponent<StatsProps> {
  // TODO(pascal): Add more.
  public render(): React.ReactNode {
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
        totalInterviewCount = 0,
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
      } = {},
    } = this.props
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
          hasSelectedCategoryTag={true} areCategoryIdsShown={true}
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
            percent={moreStressedJobseekersPercentage} gender={gender}
            size={200} userYou={vouvoyer} /> : null}
      </section> : <h2>Pas d'information sur le nombre d'offres par candidat</h2>}
      {specificInterviewCounts ? <section>
        <h2>Nombre d'entretiens décrochés {interviewText} de la recherche</h2>
        <InterviewHistogram
          userYou={vouvoyer}
          interviewCounts={specificInterviewCounts}
          totalInterviewCount={totalInterviewCount} />
      </section> : <h2>Pas d'information sur le nombre d'entretiens des candidats</h2>}
      {applicationModes.length ? <section>
        <h2>Canaux de candidature</h2>
        {applicationModes.map(({mode, percentage}): React.ReactNode =>
          <div key={mode || 'OTHER_CHANNELS'}>
            <strong>{getApplicationModeText(mode)}</strong>&nbsp;: {Math.round(percentage || 0)}%
          </div>)}
      </section> : <h2>Pas de canal de candidature clairement déterminé</h2>}
      {departements.length ? <section>
        <h2>
          Concurrence en France en {lowerFirstLetter(jobGroupName || '')}
        </h2>
        <FrenchDepartementsMap
          departements={departements} selectedDepartementId={departementId} userYou={vouvoyer}
          style={{maxWidth: 500}} />
      </section> : <h2>Pas de département particulièrement en demande</h2>}
      {employmentType ? <section>
        <h2>Type de contrat</h2>
        {Math.round(contractPercentage)}% des offres sont en {getEmploymentType(employmentType)}
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
          targetJobGroup={{jobGroup, localStats}} userYou={vouvoyer} areMarketScoresShown={true}
          jobGroups={lessStressfulJobGroups} style={{maxWidth: 600}} />
      </section> : <h2>
        Les metiers proches ont autant, voire plus, de concurrence dans ce département
      </h2>}
      {weeklyApplicationCounts ? <section>
        <h2>Nombre de candidatures hebdomadaires des utilisateurs de {config.productName}</h2>
        <DoughnutChart counts={weeklyApplicationCounts} labels={weeklyApplicationOptions} />
      </section> :
        <h2>Pas d'infos sur les candidatures des utilisateurs de {config.productName}</h2>}
      {diplomaRequirements ? <section>
        <h2>Pourcentage des offres accessibles selon le diplôme</h2>
        <DiplomaRequirementsHistogram
          requirements={diplomaRequirements} highestDegree={highestDegree} />
      </section> : <h2>Pas d'infos sur les diplômes requis pour ce métier</h2>}
    </div>
  }
}

export {Stats}
