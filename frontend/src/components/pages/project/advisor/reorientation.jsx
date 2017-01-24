import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {maybeContract, lowerFirstLetter} from 'store/french'
import {MarketStressChart, Section, TitleBox} from './base'
import {CheckboxList, Colors, RoundButton, Styles} from 'components/theme'
import {Modal} from 'components/modal'


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


class ReorientationAdvice extends React.Component {
  static propTypes = {
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    isDeclineModalShown: false,
    isTransitionToCoachModalShown: false,
    isTransitionToEngagementModalShown: false,
    reason: '',
  }

  // TODO(guillaume): Create a framework to refactor formulations.
  getDiagnosis() {
    const {localStats} = this.props.project
    const offers = localStats.imt.yearlyAvgOffersPer10Openings || 0
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
    // Computing market stress
    const {localStats} = this.props.project
    const offers = localStats.imt.yearlyAvgOffersPer10Openings || 0
    const candidates = localStats.imt.yearlyAvgOffersDenominator || 0
    const easyMarket = candidates > 0 && offers/candidates > .8

    // Pick conclusions based on market stress.
    const market = this.computeMarketDescription(easyMarket, offers, candidates)

    // Pick conclusions based on market change.
    let offerChangeText = ''
    const offersChange = localStats.jobOffersChange
    if (offersChange < -5) {
      // TODO(guic): Make 2015 dynamic.
      offerChangeText = " Le nombre d'offres est en baisse depuis 2015 (" + offersChange +
      "% d'offres)."
    }
    if (offersChange < -20) {
      offerChangeText = " Le nombre d'offres est en chute depuis 2015 (" + offersChange +
      "% d'offres)."
    }

    // Say why if the conclusion seems paradoxal
    let advice = "Nous pensons qu'il serait intéressant de réfléchir à un nouveau métier."
    if (easyMarket) {
      advice = "Cependant, il existe d'autres possibilités de métiers intéressants pour vous."
    }

    return <div>{market} {offerChangeText}
      <p>
        <strong>{advice}</strong><br /> Nous
          savons qu'il est difficile de savoir avec exactitude si une reconversion sera
          utile, mais dans votre situation des métiers proches du vôtre apportent de réelles
          chances de trouver un emploi plus rapidement et dans de meilleures conditions.
      </p>
      <p>
          Pour vous guider dans cette démarche, nous vous suivrons pas à pas dans la recherche du
          métier le plus intéressant pour vous et vous guiderons avant que vous ne preniez une
          décision définitive.
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

  renderGeneralAnalysis() {
    const {localStats} = this.props.project
    const offers = localStats.imt.yearlyAvgOffersPer10Openings || 0
    const candidates = localStats.imt.yearlyAvgOffersDenominator || 0
    return <div>
      <p>{this.getDiagnosis()} On compte <strong>
        {computeOffersPerCandidateText(offers, candidates)}</strong>, ce qui
        est <strong>{getOfferEstimateFormulation(offers/candidates)}</strong>.
      </p>
    </div>
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    const localStats = project.localStats || {}

    return <div style={{padding: '0 50px'}}>
      <Section header="Votre marché">
        {this.renderGeneralAnalysis()}
        {this.renderUnemploymentDuration()}
        {this.renderOffersEvolution()}
      </Section>
      <Section header="Les opportunités proposées par des métiers proches du vôtre">
        {this.renderMarketCompetition()}
        {localStats.lessStressfulJobGroups ?
        this.renderReorientation(project, localStats.lessStressfulJobGroups) : null}
      </Section>
      <Section header="Conclusion">
        {this.renderConclusions()}
      </Section>
    </div>
  }

  renderMarketCompetition() {
    const {localStats, title} = this.props.project
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
      ...Styles.CENTER_FONT_VERTICALLY,
    }

    return <MarketStress
        offers={localStats.imt.yearlyAvgOffersPer10Openings || 0}
        candidates={localStats.imt.yearlyAvgOffersDenominator}>
      <span style={situationStyle}>VOTRE&nbsp;SITUATION</span>{title}
    </MarketStress>
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

  renderOffersEvolution() {
    const {localStats} = this.props.project

    // In order to show the offer evolution, we should:
    // - Have statistics about last year and the previous year.
    // - Have more than 5 offers on the previous year.
    // - Have the percentage of jobOfferChange.
    if (!localStats || !localStats.numJobOffersPreviousYear ||
        localStats.numJobOffersPreviousYear < 5 || !localStats.numJobOffersLastYear ||
        !localStats.jobOffersChange) {
      return null
    }
    const upOrDown = localStats.jobOffersChange > 0 ? 'progressé' : 'diminué'

    return <p>
      De plus, depuis 2015 le nombre d'offres dans votre département
      a <strong>{upOrDown} de {Math.abs(localStats.jobOffersChange)}%, passant
      de {localStats.numJobOffersPreviousYear} à {localStats.numJobOffersLastYear}</strong>.
    </p>
  }

  renderReorientation(project, lessStressfulJobGroups) {
    const {jobGroup, localStats} = lessStressfulJobGroups[0]
    if (!jobGroup || !localStats || !jobGroup.name || !localStats.imt) {
      return null
    }

    return <MarketStress
        offers={localStats.imt.yearlyAvgOffersPer10Openings || 0}
        candidates={localStats.imt.yearlyAvgOffersDenominator}>
      {jobGroup.name}
    </MarketStress>
  }

  renderButtons() {
    return <div style={{display: 'flex',  marginBottom: 100, padding: '0 50px'}}>
      <RoundButton
          type="validation" style={{flex: 1}}
          onClick={() => this.setState({isTransitionToEngagementModalShown: true})}>
        Trouver un nouveau métier
      </RoundButton>
      <span style={{width: 20}} />
      <RoundButton
          type="validation" style={{flex: 1}}
          onClick={() => this.setState({isDeclineModalShown: true})}>
        Je continue sur mon métier
      </RoundButton>
    </div>
  }

  render() {
    const {onDecline, onAccept, project, style} = this.props
    const {isDeclineModalShown, isTransitionToCoachModalShown,
      isTransitionToEngagementModalShown} = this.state
    return <div style={style}>
      <DeclineModal
          onClose={() => this.setState({isDeclineModalShown: false})}
          isShown={isDeclineModalShown}
          onSubmit={reason => this.setState({
            isDeclineModalShown: false,
            isTransitionToCoachModalShown: true,
            reason,
          })} />
      <TransitionToCoachModal
          project={project} isShown={isTransitionToCoachModalShown}
          onSubmit={() => onDecline(this.state.reason)} />
      <TransitionToEngagementModal
          isShown={isTransitionToEngagementModalShown}
          onSubmit={onAccept} />
      {this.renderTitleBox()}
      {this.renderDetailedAnalysis()}
      {this.renderButtons()}
    </div>
  }
}


class DeclineModalBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    onClose: React.PropTypes.func.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
  }

  state = {
    reasons: [],
  }

  handleSubmit = () => {
    const {onSubmit} = this.props
    let {reasons} = this.state
    if (this.refs.others.value) {
      reasons = reasons.concat([this.refs.others.value])
    }
    onSubmit(reasons.join(', '))
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {gender, onClose, onSubmit, ...extraProps} = this.props
    const {reasons} = this.state
    const noticeStyle = {
      color: Colors.SLATE,
      fontSize: 14,
      lineHeight: 1.21,
      margin: '20px auto 35px',
      maxWidth: 360,
      textAlign: 'center',
    }
    const textareaStyle = {
      display: 'block',
      height: 130,
      margin: '10px 0 25px',
      padding: 15,
      width: '100%',
    }
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <Modal
        {...extraProps} title="La reconversion ne vous convient pas ?"
        titleStyle={{lineHeight: 1}} onClose={onClose}
        style={{fontSize: 15, padding: '0 60px 35px', width: 480}}>
      <div style={noticeStyle}>
        Nous cherchons à nous améliorer sans cesse. Dites nous comment nous
        aurions pu faire mieux pour vous aider.
      </div>

      <CheckboxList
          style={{color: Colors.DARK_TWO, fontSize: 15}}
          onChange={reasons => this.setState({reasons})}
          options={[
            "J'aime mon métier et je ne veux pas en changer.",
            'Je viens de me reconvertir.',
            'Une reconversion ne me convient pas.',
            `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
          ].map(reason => ({name: reason, value: reason}))}
          values={reasons} />

      <div style={{color: Colors.DARK_TWO}}>
        Autres :
        <textarea
            style={textareaStyle} ref="others"
            placeholder="Dites-nous ce qui ne vous a pas plu." />
      </div>

      <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 25}}>
        <RoundButton onClick={onClose} type="discreet" style={{marginRight: 15}}>
          Annuler
        </RoundButton>
        <RoundButton onClick={this.handleSubmit} type="validation">
          Terminer
        </RoundButton>
      </div>
    </Modal>
  }
}
const DeclineModal = connect(({user}) => ({gender: user.profile.gender}))(DeclineModalBase)


class TransitionToCoachModal extends React.Component {
  static propTypes = {
    onSubmit: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  render() {
    const {onSubmit, project, ...extraProps} = this.props
    const style = {
      fontSize: 14,
      lineHeight: 1.57,
      padding: '0 60px 50px',
      textAlign: 'center',
      width: 480,
    }
    return <Modal {...extraProps} title="Merci pour votre aide" style={style}>
      <img src={require('images/thumb-up.svg')} style={{margin: 40}} />
      <div>
        {config.productName} ce n'est pas que de la reconversion&nbsp;! Nous allons
        <strong> vous aider pour votre projet </strong>
        {maybeContract('de ', "d'", project.title)}{lowerFirstLetter(project.title)}.
        <br />
        <br />
        Nous vous accompagnerons quotidiennement en vous proposant <strong>des
        astuces et des offres</strong> qui vous aideront à retrouver un emploi
        le plus vite possible.
      </div>
      <RoundButton onClick={onSubmit} type="validation" style={{marginTop: 40}}>
        C'est parti&nbsp;!
      </RoundButton>
    </Modal>
  }
}


class TransitionToEngagementModal extends React.Component {
  static propTypes = {
    onSubmit: React.PropTypes.func.isRequired,
  }

  render() {
    const {onSubmit, ...extraProps} = this.props
    const style = {
      fontSize: 14,
      lineHeight: 1.57,
      padding: '0 60px 50px',
      textAlign: 'center',
      width: 480,
    }
    return <Modal {...extraProps} title="Trouvons votre futur métier&nbsp;!" style={style}>
      <img src={require('images/thumb-up.svg')} style={{margin: 40}} />
      <div>
        Nous allons chercher ensemble, étape par étape, un métier qui vous
        plaira et qui vous permettra de trouver un emploi <strong>plus vite et
        plus facilement</strong>.
      </div>
      <RoundButton onClick={onSubmit} type="validation" style={{marginTop: 40}}>
        C'est parti&nbsp;!
      </RoundButton>
    </Modal>
  }
}


class MarketStress extends React.Component {
  static propTypes = {
    candidates: React.PropTypes.number,
    children: React.PropTypes.node,
    offers: React.PropTypes.number,
  }

  render() {
    const {candidates, children, offers} = this.props
    const chartTitleStyle = {
      color: Colors.DARK,
      fontSize: 15,
      fontStyle: 'italic',
      fontWeight: 500,
      marginTop: 45,
    }
    return <div>
      <div style={chartTitleStyle}>
        {children}
      </div>
      <div style={{alignItems: 'center', display: 'flex', margin: '15px 0'}}>
        <MarketStressChart
            style={{flexShrink: 0}}
            numOffers={offers}
            numCandidates={candidates} />
        <div style={{fontSize: 15, fontStyle: 'italic', padding: '0 40px'}}>
          {computeOffersPerCandidateText(offers, candidates)}, ce qui
          est <strong>{getOfferEstimateFormulation(offers/candidates)}</strong>.
        </div>
      </div>
    </div>
  }
}


export {ReorientationAdvice}
