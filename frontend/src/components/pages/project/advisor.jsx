import React from 'react'

import {PageWithNavigationBar} from 'components/navigation'
import {Colors, RoundButton} from 'components/theme'


const maybeS = count => count > 1 ? 's' : ''


class AdvisorPage extends React.Component {
  static propTypes = {
    onContinue: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  renderTitleBox() {
    const {project} = this.props
    const style = {
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px 0 #d6d9e3',
      color: Colors.DARK,
      margin: '30px 0',
      padding: '40px 50px',
    }
    const headerStyle = {
      borderBottom: 'solid 3px ' + Colors.BACKGROUND_GREY,
      fontSize: 30,
      fontWeight: 'bold',
      marginBottom: 40,
      paddingBottom: 30,
      textTransform: 'uppercase',
    }
    const subTitleStyle = {
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: .8,
      marginBottom: 13,
      textTransform: 'uppercase',
    }
    // TODO(pascal): Make the diagnosis dynamic.
    return <div style={style}>
      <header style={headerStyle}>
        {project.title}
      </header>
      <div style={subTitleStyle}>
        Notre diagnostic
      </div>
      <ul style={{fontSize: 18, lineHeight: '26px'}}>
        <li>Le marché semble assez bouché pour votre métier.</li>
        <li>Mais d'autres opportunités peuvent être bonne à prendre.</li>
      </ul>
    </div>
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    // TODO(pascal): Make the content more dynamic.
    const localStats = project.localStats || {}
    const sectionStyle = {
      color: Colors.DARK_TWO,
      fontSize: 16,
      padding: '30px 0',
    }
    const sectionHeaderStyle = {
      fontSize: 18,
      fontWeight: 'bold',
    }
    return <div style={{padding: '15px 50px'}}>
      <header style={{color: Colors.COOL_GREY, fontSize: 18, textDecoration: 'underline'}}>
        Analyse détaillée
      </header>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>Votre marché</header>
        {this.renderMarketCompetition()}
        {this.renderUnemploymentDuration()}
        {this.renderOffersEvolution()}
      </section>

      {localStats.lessStressfulJobGroups ?
        this.renderReorientation(project, localStats.lessStressfulJobGroups) : null}

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>Conclusion</header>
        <p>
          Votre marché est favorable à l'embauche dans votre secteur et vous
          devriez pouvoir trouver un emploi.<br />
          Cependant la réorientation offre des possibilités intéressantes pour
          votre profil (embauche plus rapide, meilleur contrat, salaire plus
          élevé).
        </p>
        <p>
          <strong>Nous vous recommendons d'envisager une réorientation.</strong>
          Nous pouvons vous accompagner pas à pas
          pour vous aider à trouver le futur métier parfait pour vous.
        </p>
      </section>
    </div>
  }

  renderMarketCompetition() {
    const {localStats} = this.props.project
    if (!localStats || !localStats.imt || !localStats.imt.yearlyAvgOffersDenominator) {
      return null
    }
    // TODO(pascal): Improve estimation.
    const estimate = 'beaucoup'
    return <p>
      Il y a {estimate} de concurrence (en moyenne {
        localStats.imt.yearlyAvgOffersPer10Openings || 0} offre
      {maybeS(localStats.imt.yearlyAvgOffersPer10Openings)} pour {
        localStats.imt.yearlyAvgOffersDenominator} candidat
      {maybeS(localStats.imt.yearlyAvgOffersDenominator)}).
    </p>
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
    // TODO(pascal): Factorize that in a component instead of duplicating styling code.
    const sectionStyle = {
      color: Colors.DARK_TWO,
      fontSize: 16,
      padding: '30px 0',
    }
    const sectionHeaderStyle = {
      fontSize: 18,
      fontWeight: 'bold',
    }
    const {jobGroup, localStats} = lessStressfulJobGroups[0]
    if (!jobGroup || !localStats || !jobGroup.name || !localStats.imt) {
      return null
    }
    return <section style={sectionStyle}>
      <header style={sectionHeaderStyle}>Les autres opportunités</header>
      <p>
        Toutefois, certains métiers proches du vôtre sont beaucoup plus ouverts
        à l'emploi. Par exemple un emploi en {jobGroup.name} propose <strong>
          {localStats.imt.yearlyAvgOffersPer10Openings} offre
          {maybeS(localStats.imt.yearlyAvgOffersPer10Openings)} pour {
            localStats.imt.yearlyAvgOffersDenominator} candidat
          {maybeS(localStats.imt.yearlyAvgOffersDenominator)}.
        </strong>
      </p>
    </section>
  }

  renderButtons() {
    const {onContinue} = this.props
    // TODO(pascal): Make the buttons do something different.
    return <div style={{display: 'flex', padding: '0 50px'}}>
      <RoundButton type="validation" style={{flex: 1}} onClick={onContinue}>
        Je souhaite me réorienter
      </RoundButton>
      <span style={{width: 20}} />
      <RoundButton type="validation" style={{flex: 1}} onClick={onContinue}>
        Je continue sur mon métier
      </RoundButton>
    </div>
  }

  render() {
    return <PageWithNavigationBar page="advisor" style={{padding: 30}} isContentScrollable={true}>
      <div style={{margin: 'auto', width: 700}}>
        {this.renderTitleBox()}
        {this.renderDetailedAnalysis()}
        {this.renderButtons()}
      </div>
    </PageWithNavigationBar>
  }
}


export {AdvisorPage}
