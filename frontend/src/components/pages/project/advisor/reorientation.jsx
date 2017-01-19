import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {MarketStressChart, Section, TitleBox} from './base'
import {CheckboxList, Colors, RoundButton} from 'components/theme'
import {Modal} from 'components/modal'


const maybeS = count => count > 1 ? 's' : ''


class ReorientationAdvice extends React.Component {
  static propTypes = {
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    isDeclineModalShown: false,
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
      return <li>Il y a une très forte concurence dans votre situation actuelle.</li>
    }
    if (offersPer10Candidates < 5) {
      return <li>Il y a une forte concurence dans votre situation actuelle.</li>
    }
    if (offersPer10Candidates < 9) {
      return <li>Il y a une concurence modérée dans votre situation actuelle.</li>
    }
    return <li>Il y a peu de concurence dans votre situation actuelle.</li>
  }

  getOfferEstimateFormulation(offersPer10Candidates) {
    if (offersPer10Candidates < 3) {
      return 'beaucoup moins que la moyenne'
    }
    if (offersPer10Candidates < 4) {
      return 'moins que la moyenne'
    }
    if (offersPer10Candidates < 8) {
      return 'dans la moyenne'
    }
    if (offersPer10Candidates < 10) {
      return 'plus que la moyenne'
    }
    return 'bien plus que la moyenne'
  }

  renderTitleBox() {
    const {project} = this.props
    return <TitleBox project={project}>
      {this.getDiagnosis()}
      <li>Mais d'autres opportunités peuvent être bonne à prendre.</li>
    </TitleBox>
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    // TODO(pascal): Make the content more dynamic.
    const localStats = project.localStats || {}
    return <div style={{padding: '15px 50px'}}>
      <header style={{color: Colors.COOL_GREY, fontSize: 18, textDecoration: 'underline'}}>
        Analyse détaillée
      </header>

      <Section header="Votre marché">
        {this.renderMarketCompetition()}
        {this.renderUnemploymentDuration()}
        {this.renderOffersEvolution()}
      </Section>

      {localStats.lessStressfulJobGroups ?
        this.renderReorientation(project, localStats.lessStressfulJobGroups) : null}

      <Section header="Conclusion">
        <p>
          Votre marché est favorable à l'embauche dans votre secteur et vous
          devriez pouvoir trouver un emploi.<br />
          Cependant la réorientation offre des possibilités intéressantes pour
          votre profil (embauche plus rapide, meilleur contrat, salaire plus
          élevé).
        </p>
        <p>
          <strong>Nous vous recommendons d'envisager une réorientation.</strong> Nous
          pouvons vous accompagner pas à pas pour vous aider à trouver le futur
          métier parfait pour vous.
        </p>
      </Section>
    </div>
  }

  renderMarketCompetition() {
    const {localStats} = this.props.project
    if (!localStats || !localStats.imt || !localStats.imt.yearlyAvgOffersDenominator) {
      return null
    }
    const offers = localStats.imt.yearlyAvgOffersPer10Openings || 0
    const offersPer10Candidates = 10 * offers / localStats.imt.yearlyAvgOffersDenominator
    const estimate = this.getOfferEstimateFormulation(offersPer10Candidates)

    return <div style={{alignItems: 'center', display: 'flex', margin: '15px 0'}}>
      <MarketStressChart
          style={{flexShrink: 0}}
          numOffers={offersPer10Candidates}
          numCandidates={localStats.imt.yearlyAvgOffersDenominator} />
      <div style={{fontSize: 15, fontStyle: 'italic', padding: '0 40px'}}>
        {offersPer10Candidates} offre{maybeS(offersPer10Candidates)} pour {
          localStats.imt.yearlyAvgOffersDenominator} candidat
        {maybeS(localStats.imt.yearlyAvgOffersDenominator)}, ce qui
        est <strong>{estimate}</strong>.
      </div>
    </div>
  }

  renderUnemploymentDuration() {
    const {localStats} = this.props.project
    if (!localStats || !localStats.unemploymentDuration) {
      return null
    }
    const months = Math.ceil(localStats.unemploymentDuration.days / 30)
    // TODO(pascal): Improve estimation.
    const estimate = 'assez long'
    return <p>
      Les personnes dans votre département ayant la même expérience que
      vous mettent <strong>en moyenne {months} mois à trouver un emploi</strong> pour
      ce métier, ce qui est {estimate}.
    </p>
  }

  renderOffersEvolution() {
    const {localStats} = this.props.project
    if (!localStats || !localStats.numJobOffersPreviousYear ||
        localStats.numJobOffersPreviousYear < 5 || !localStats.jobOffersChange) {
      return null
    }
    const upOrDown = localStats.jobOffersChange > 0 ? 'progressé' : 'diminué'
    return <p>
      De plus, depuis 2015 le nombre d'offres
      a {upOrDown} de {Math.abs(localStats.jobOffersChange)}%.
    </p>
  }

  renderReorientation(project, lessStressfulJobGroups) {
    const {jobGroup, localStats} = lessStressfulJobGroups[0]
    if (!jobGroup || !localStats || !jobGroup.name || !localStats.imt) {
      return null
    }
    return <Section header="Les autres opportunités">
      <p>
        Toutefois, certains métiers proches du vôtre sont beaucoup plus ouverts
        à l'emploi. Par exemple un emploi en {jobGroup.name} propose <strong>
          {localStats.imt.yearlyAvgOffersPer10Openings} offre
          {maybeS(localStats.imt.yearlyAvgOffersPer10Openings)} pour {
            localStats.imt.yearlyAvgOffersDenominator} candidat
          {maybeS(localStats.imt.yearlyAvgOffersDenominator)}.
        </strong>
      </p>
    </Section>
  }

  renderButtons() {
    const {onAccept} = this.props
    return <div style={{display: 'flex', padding: '0 50px'}}>
      <RoundButton type="validation" style={{flex: 1}} onClick={onAccept}>
        Je souhaite me réorienter
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
    const {onDecline, style} = this.props
    const {isDeclineModalShown} = this.state
    return <div style={style}>
      <DeclineModalShown
          onClose={() => this.setState({isDeclineModalShown: false})}
          isShown={isDeclineModalShown}
          onSubmit={reason => onDecline(reason)} />
      {this.renderTitleBox()}
      {this.renderDetailedAnalysis()}
      {this.renderButtons()}
    </div>
  }
}


class DeclineModalShownBase extends React.Component {
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
            "J'aime mon métier et je souhaite le continuer.",
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
const DeclineModalShown = connect(({user}) => ({gender: user.profile.gender}))(
    DeclineModalShownBase)


export {ReorientationAdvice}
