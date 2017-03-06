import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {AdvicePage, MarketStressChart, Section, TitleBox} from './base'
import {Colors, Styles} from 'components/theme'

// When the percentage of CDI is below this value, we show a message to the user telling him so.
const notEnoughCDIPercentage = 50
const maybeS = count => count > 1 ? 's' : ''
const computeOffersPerCandidateText = (offers, candidates) => {
  if (candidates > 0) {
    return `${candidates} candidat${maybeS(candidates)} pour ${offers} offre${maybeS(offers)}`
  }
  return ''
}
const getOfferEstimateFormulation = offersPerCandidate => {
  if (offersPerCandidate < .4) {
    return 'moins bien que la moyenne'
  }
  if (offersPerCandidate < .8) {
    return 'dans la moyenne'
  }
  if (offersPerCandidate < 1) {
    return 'mieux que la moyenne'
  }
  return 'bien mieux que la moyenne'
}


class RecommendPageBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  // TODO(guillaume): Create a framework to refactor formulations.
  getDiagnosis() {
    const {localStats} = this.props.project
    const offers = localStats.imt.yearlyAvgOffersPer10Candidates ||
      localStats.imt.yearlyAvgOffersPer10Openings || 0
    const candidates = localStats.imt.yearlyAvgOffersDenominator || 0
    if (candidates === 0) {
      return ''
    }
    const offersPer10Candidates = 10 * offers / candidates

    if (offersPer10Candidates < 4) {
      return 'Il y a une très forte concurence sur votre marché.'
    }
    if (offersPer10Candidates < 6) {
      return 'Il y a une forte concurence sur votre marché.'
    }
    return 'Il y a de la concurence sur votre marché.'
  }

  computeMarketDescription(easyMarket, offers, candidates) {
    if (easyMarket) {
      return "Votre marché semble favorable à l'embauche dans votre secteur."
    }
    const stats = computeOffersPerCandidateText(offers, candidates)
    const displayStats = stats && ` (${stats})`
    return "Votre marché est peu favorable à l'embauche dans votre secteur," +
      ` le nombre de candidats par offres est très élevé${displayStats}.`
  }

  // Gets the conclustions of this advisor.
  renderConclusions() {
    return <div>
      <p>
        <strong>Nous pensons qu'il serait intéressant de réfléchir à un nouveau métier.</strong>
        <br /> Nous savons qu'il est difficile de savoir avec exactitude si une reconversion
        sera utile, mais dans votre situation des métiers proches du vôtre apportent de réelles
        chances de trouver un emploi <strong>plus rapidement</strong> et dans de meilleures
        conditions.
      </p>
      <p>
        Pour vous guider dans cette démarche, nous vous accompagnerons pas à pas pour trouver de
        nouvelles pistes et les évaluer avant que vous ne preniez une décision définitive.
      </p>
    </div>
  }

  renderTitleBox() {
    const {project} = this.props
    return <TitleBox project={project}>
      <li>Votre marché semble relativement bouché.</li>
      <li>Mais nous avons identifié de bonnes opportunités pour vous.</li>
    </TitleBox>
  }

  renderBetterCDIAdvice() {
    const {project} = this.props
    if (!(project.localStats && project.localStats.imt &&
        project.localStats.imt.employmentTypePercentages)) {
      return null
    }
    const employementPercentages = project.localStats.imt.employmentTypePercentages
    const percentCDI = (employementPercentages.filter(
        a => a.employementType === 'CDI')[0] || {percentage: 100}).percentage
    if (percentCDI > notEnoughCDIPercentage) {
      return null
    }
    return <div style={{marginTop: 55}}><strong>Une meilleure stabilité d'emploi</strong>
      <br />
      Moins de la moitié des offres proposées pour votre métier sont des CDI.
      Cependant, des métiers proches du vôtre pourraient vous offrir plus de stabilité.
    </div>
  }

  renderGeneralAnalysis() {
    return <div>
        La concurrence sur votre marché est plus forte que sur les autres marchés, en effet
        la proportion d'offres par candidat est relativement faible dans votre métier.
    </div>
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    const localStats = project.localStats || {}

    return <div>
      <Section header="Votre marché">
        {this.renderGeneralAnalysis()}
        {this.renderUnemploymentDuration()}
      </Section>
      <Section header="Les opportunités proposées par des métiers proches du vôtre">
        {this.renderMarketCompetition()}
        {localStats.lessStressfulJobGroups ?
        this.renderReorientation(project, localStats.lessStressfulJobGroups) : null}
        {this.renderBetterCDIAdvice()}
      </Section>
      <Section header="Conclusion">
        {this.renderConclusions()}
      </Section>
    </div>
  }

  renderMarketCompetition() {
    const {project} = this.props
    const {localStats, title} = project
    if (!localStats || !localStats.imt || !localStats.imt.yearlyAvgOffersDenominator) {
      return null
    }
    const situationStyle = {
      backgroundColor: Colors.SLATE,
      color: Colors.BACKGROUND_GREY,
      display: 'inline-block',
      fontSize: 11,
      fontStyle: 'normal',
      fontWeight: 500,
      lineHeight: 1.6,
      marginRight: 10,
      paddingLeft: 6,
      paddingRight: 7,
      textAlign: 'center',
      textTransform: 'uppercase',
      ...Styles.CENTER_FONT_VERTICALLY,
    }

    const offers = localStats.imt.yearlyAvgOffersPer10Candidates ||
      localStats.imt.yearlyAvgOffersPer10Openings || 0
    // TODO(guillaume): Uniform title spacing.
    return <div style={{marginTop: 35}}>
      <strong>Une moins forte concurence</strong><br />
      <MarketStress offers={offers} candidates={localStats.imt.yearlyAvgOffersDenominator}>
        <span style={situationStyle}>Votre&nbsp;situation</span>{title}
      </MarketStress>
    </div>
  }

  renderUnemploymentDuration() {
    const {localStats} = this.props.project
    if (!localStats || !localStats.unemploymentDuration) {
      return null
    }
    const months = Math.ceil(localStats.unemploymentDuration.days / 30)
    // TODO(guilaume): Add estimation.
    return <p>
      Les personnes dans votre département ayant la même expérience que
      vous mettent <strong>en moyenne {months} mois à trouver un emploi</strong>.
    </p>
  }

  renderReorientation(project, lessStressfulJobGroups) {
    const {jobGroup, localStats} = lessStressfulJobGroups[0]
    if (!jobGroup || !localStats || !jobGroup.name || !localStats.imt) {
      return null
    }

    const offers = localStats.imt.yearlyAvgOffersPer10Candidates ||
      localStats.imt.yearlyAvgOffersPer10Openings || 0
    return <div>
      <MarketStress
          offers={offers} candidates={localStats.imt.yearlyAvgOffersDenominator}
          style={{marginTop: 40}}>
        {jobGroup.name}
      </MarketStress>
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      declineReasonTitle="La reconversion ne vous convient pas&nbsp;?"
      declineReasonOptions={[
        "J'aime mon métier et je ne veux pas en changer.",
        'Je viens de me reconvertir.',
        'Une reconversion ne me convient pas.',
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}
      summary={<div>
        <li>Votre marché semble relativement bouché.</li>
        <li>Mais nous avons identifié de bonnes opportunités pour vous.</li>
      </div>}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage = connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


class MarketStress extends React.Component {
  static propTypes = {
    candidates: React.PropTypes.number,
    children: React.PropTypes.node,
    offers: React.PropTypes.number,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {candidates, children, offers, style} = this.props
    const {isMobileVersion} = this.context
    const chartTitleStyle = {
      color: Colors.DARK,
      fontSize: 15,
      fontStyle: 'italic',
      fontWeight: 500,
      marginTop: 10,
    }
    const chartStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'initial',
      margin: '15px 0',
    }
    const legendStyle = {
      fontSize: 15,
      fontStyle: 'italic',
      padding: isMobileVersion ? '10px 0' : '0 40px',
    }
    return <div style={style}>
      <div style={chartTitleStyle}>
        {children}
      </div>
      <div style={chartStyle}>
        <MarketStressChart
            style={{flexShrink: isMobileVersion ? 'initial' : 0}}
            numOffers={offers}
            numCandidates={candidates} />
        <div style={legendStyle}>
          {computeOffersPerCandidateText(offers, candidates)}, ce qui
          est <strong>{getOfferEstimateFormulation(offers/candidates)}</strong>.
        </div>
      </div>
    </div>
  }
}


export default {RecommendPage}
