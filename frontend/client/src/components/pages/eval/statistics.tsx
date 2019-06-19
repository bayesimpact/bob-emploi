import _keyBy from 'lodash/keyBy'
import _mapValues from 'lodash/mapValues'
import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import {getMonthName} from 'store/french'
import {getApplicationModeText, getApplicationModes, getPEJobBoardURL} from 'store/job'
import {PROJECT_EMPLOYMENT_TYPE_OPTIONS, SALARY_TO_GROSS_ANNUAL_FACTORS} from 'store/project'

import {fetchCity} from 'components/suggestions'
import {ExternalLink, SmoothTransitions, StringJoiner} from 'components/theme'


const employmentTypes = _mapValues(
  _keyBy(PROJECT_EMPLOYMENT_TYPE_OPTIONS, 'value'), ({name}): string => name)


const getEmploymentType = (name: bayes.bob.EmploymentType): string =>
  employmentTypes[name] || name


interface SalaryProps extends bayes.bob.SalaryEstimation {
  title?: string
}

interface SalariesProps {
  barHeight: number
  children: SalaryProps[]
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
      filter(({maxSalary, minSalary}: SalaryProps): boolean => !!maxSalary && !!minSalary).
      map((child: SalaryProps): SalaryProps => ({
        ...child,
        maxSalary: Math.round(child.maxSalary * SALARY_TO_GROSS_ANNUAL_FACTORS[child.unit]),
        medianSalary: Math.round(child.medianSalary * SALARY_TO_GROSS_ANNUAL_FACTORS[child.unit]),
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


interface StressBarProps extends bayes.bob.RelatedLocalJobGroup {
  children?: React.ReactNode
  color?: string
  scorePointWidth: number
}


class JobGroupStressBar extends React.PureComponent<StressBarProps, {hasStarted: boolean}> {
  public state = {
    hasStarted: false,
  }

  private handleVisibilityChange = (isVisible: boolean): void =>
    this.setState({hasStarted: isVisible})

  public render(): React.ReactNode {
    const {
      children,
      color,
      jobGroup: {name = ''} = {},
      localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {},
      mobilityType = '',
      scorePointWidth,
    } = this.props
    const {hasStarted} = this.state
    // TODO(cyrille): Visually show that this is not to scale above market score 10/10.
    const width = hasStarted ? scorePointWidth * Math.min(11, yearlyAvgOffersPer10Candidates) : 1
    const barStyle: React.CSSProperties = {
      backgroundColor: color || mobilityType === 'CLOSE' ? colors.BOB_BLUE : colors.SQUASH,
      flex: 'none',
      height: 5,
      marginBottom: 10,
      marginRight: 12 * scorePointWidth - width,
      position: 'relative',
      width,
      ...SmoothTransitions,
    }
    const bulletStyle: React.CSSProperties = {
      backgroundColor: barStyle.backgroundColor,
      borderRadius: 10,
      height: 20,
      position: 'absolute',
      right: -10,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 20,
    }
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      color: barStyle.backgroundColor,
      display: 'flex',
      margin: '10px 0',
    }

    return <div style={containerStyle}>
      <VisibilitySensor
        active={!hasStarted} intervalDelay={250}
        partialVisibility={true} onChange={this.handleVisibilityChange}>
        <div style={barStyle}>
          <div style={bulletStyle} />
        </div>
      </VisibilitySensor>
      {name} {children}
    </div>
  }
}


interface StressBarsProps {
  jobGroups: bayes.bob.RelatedLocalJobGroup[]
  localStats: bayes.bob.LocalJobStats
  scorePointWidth: number
  targetJobGroup: bayes.bob.JobGroup
}

class JobGroupStressBars extends React.PureComponent<StressBarsProps> {
  public static defaultProps = {
    scorePointWidth: 50,
  }

  public render(): React.ReactNode {
    const {jobGroups, localStats, scorePointWidth, targetJobGroup} = this.props
    const axisStyle: React.CSSProperties = {
      borderBottom: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      justifyContent: 'space-between',
      width: scorePointWidth * 10,
    }
    const tickStyle: React.CSSProperties = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      height: 5,
      width: 1,
    }
    const labelStyle = (tickIndex: number): React.CSSProperties => ({
      left: scorePointWidth * tickIndex,
      position: 'absolute',
      top: 0,
      transform: 'translateX(-50%)',
    })
    return <React.Fragment>
      {jobGroups.map((relatedJobGroup): React.ReactNode =>
        <JobGroupStressBar
          scorePointWidth={scorePointWidth} key={relatedJobGroup.jobGroup.romeId}
          {...relatedJobGroup} />)}
      <JobGroupStressBar
        color={colors.BOB_BLUE}
        jobGroup={targetJobGroup}
        scorePointWidth={scorePointWidth}
        localStats={localStats}>(vous)</JobGroupStressBar>
      <div style={axisStyle}>
        {new Array(11).fill(undefined).map((unused, index): React.ReactNode =>
          <div key={index} style={tickStyle} />)}
      </div>
      <div style={{marginTop: 5, position: 'relative'}}>
        Beaucoup
        <div style={labelStyle(4)}>Moyen</div>
        <div style={labelStyle(8)}>Peu de concurrence</div>
        <div style={{left: 600, position: 'absolute', top: 0}}>
          <span style={{color: colors.SQUASH, marginRight: 10}}>Évolution</span>/
          <span style={{color: colors.BOB_BLUE, marginLeft: 10}}>Proche</span>
        </div>
      </div>
    </React.Fragment>
  }
}

interface StatsProps {
  categories: bayes.bob.DiagnosticCategory[]
  jobGroupInfo: bayes.bob.JobGroup
  project: bayes.bob.Project
}

class Stats extends React.PureComponent<StatsProps, {bestInDepartements: string[]}> {

  public state = {
    bestInDepartements: [],
  }

  public componentDidMount(): void {
    this.fetchDepartements()
  }

  public componentDidUpdate({jobGroupInfo: {romeId = ''} = {}}): void {
    if (this.props.jobGroupInfo.romeId !== romeId) {
      this.fetchDepartements()
    }
  }

  private fetchDepartements(): void {
    const {jobGroupInfo: {bestDepartements = []} = {}} = this.props
    Promise.all(bestDepartements.slice(0, 2).
      map(({departementId}): Promise<bayes.bob.FrenchCity> => fetchCity({departementId}))).
      then((bestCities): string[] => bestCities.
        map(({departementName: name, departementPrefix: prefix}): string => prefix + name)).
      then((bestInDepartements): void => this.setState({bestInDepartements}))
  }

  // TODO(pascal): Add more.
  public render(): React.ReactNode {
    const {
      categories = [],
      jobGroupInfo = {},
      project: {city = {}, targetJob = {}, localStats: {
        imt: {
          activeMonths = [],
          employmentTypePercentages = [],
          juniorSalary = {},
          lastWeekDemand = 0,
          lastWeekOffers = 0,
          seniorSalary = {},
          yearlyAvgOffersPer10Candidates = 0,
        } = {},
        lessStressfulJobGroups = [],
        moreStressedJobseekersPercentage = 0,
        numJobOffersLastYear = 0,
        numJobOffersPreviousYear = 0,
        salary: fhsSalary = {},
        unemploymentDuration: {days: unemploymentDurationDays = 0} = {},
      } = {}} = {},
    } = this.props
    const {bestInDepartements} = this.state
    const applicationModes = getApplicationModes(jobGroupInfo)
    const {
      employmentType = '',
      percentage: contractPercentage = 0,
    } = employmentTypePercentages[0] || {}
    return <div>
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
          ` (${100 - moreStressedJobseekersPercentage}% des chercheurs d'emploi ont moins
          de concurrence)` : ''}
      </section> : <h2>Pas d'information sur le nombre d'offres par candidat</h2>}
      {applicationModes.length ? <section>
        <h2>Canaux de candidature</h2>
        {applicationModes.map(({mode, percentage}): React.ReactNode =>
          <div key={mode}>
            <strong>{getApplicationModeText(mode)}</strong>&nbsp;: {Math.round(percentage)}%
          </div>)}
      </section> : <h2>Pas de canal de candidature clairement déterminé</h2>}
      {bestInDepartements.length ? <section>
        <h2>Département{bestInDepartements.length > 1 ? 's' : ''} qui recrutent</h2>
        La concurrence est moins forte <StringJoiner lastSeparator=" et ">
          {bestInDepartements}
        </StringJoiner>
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
      <section>
        <h2>Catégories de Bob</h2>
        <ul>{categories.
          map(({isRelevant, categoryId}: bayes.bob.DiagnosticCategory): React.ReactNode =>
            <li
              style={{color: isRelevant ? colors.GREENISH_TEAL : colors.RED_PINK}}
              key={categoryId}>{categoryId}</li>)}
        </ul>
      </section>
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
          targetJobGroup={this.props.project.targetJob.jobGroup}
          localStats={this.props.project.localStats}
          jobGroups={lessStressfulJobGroups}>
        </JobGroupStressBars>
      </section> : <h2>
        Les metiers proches ont autant, voire plus, de concurrence dans ce département
      </h2>}
    </div>
  }
}

export {Stats}
