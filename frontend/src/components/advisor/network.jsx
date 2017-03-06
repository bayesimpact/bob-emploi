import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AdviceCard, AdvicePage, ApplicationModeChart, HowToBox, Section} from './base'
import {Colors} from 'components/theme'


class RecommendPageBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    project: React.PropTypes.object.isRequired,
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    const applicationModes = project.localStats && project.localStats.imt &&
      project.localStats.imt.applicationModes || null
    return <div>
      <Section header="Opportunités proposées en développant son réseau">
        <p>
          Le réseau est un levier de retour à l'emploi très puissant.
          On estime que seulement <strong>40% du marché de l'emploi est
          visible,</strong> c'est-à-dire que la plupart des embauches
          ne passe pas par des annonces.
        </p>
        <ApplicationModeChart applicationModes={applicationModes} />
        <p>
          Dans votre métier cette tendance est particulièrement prononcée.
          Le réseau est considéré comme le canal numéro 1 pour trouver
          un emploi devant les candidatures spontanées ou les intermédiaires de
          placement par exemple.
        </p>
      </Section>
      <Section header="Conclusion">
        {this.renderConclusion()}
      </Section>
    </div>
  }

  renderConclusion() {
    return <div>
      <p><strong>Nous vous encourageons à développer votre réseau.</strong></p>
      <p>
        Développer et mobiliser votre réseau en parallèle de vos candidatures
        vous aidera à affiner vos demandes et trouver un emploi plus
        facilement.
      </p>
      <p>
        Nous pouvons vous aider à cultiver votre réseau actuel pour
        l'enrichir, le développer et en faire un véritable atout pour
        retrouver un emploi.
      </p>
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      summary={<li>
        Le réseau semble être un atout essentiel pour trouver un emploi dans
        votre secteur.
      </li>}
      declineReasonTitle="Améliorer votre réseau ne vous convient pas&nbsp;?"
      declineReasonOptions={[
        'Je préfère passer par un autre canal de recrutement.',
        "J'ai déjà un très bon réseau et je l'utilise bien.",
        'Passer par mon réseau ne me convient pas.',
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage =
  connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


// A graph to compare the offers coming from web offers and those coming from network.
// For now, we give the same graph to everybody, so the data is not passed by the props.
class JobOriginChart extends React.Component {
  static propTypes = {
    style: React.PropTypes.object,
  }

  renderBar({percentage, title}, isHighlighted) {
    const style = {
      display: 'inline-block',
      textAlign: 'center',
      verticalAlign: 'top',
      width: 130,
    }
    const titleStyle = {
      color: Colors.SLATE,
      fontSize: 12,
      lineHeight: 1.19,
      marginBottom: 5,
      padding: 5,
    }
    const valueStyle = {
      color: isHighlighted ? Colors.SKY_BLUE : Colors.SILVER,
      fontSize: 12,
      fontWeight: 'bold',
      lineHeight: 1.19,
      padding: 5,
    }
    const barAndTextStyle = {
      borderBottom: '1px solid',
      borderColor: Colors.SILVER,
      display: 'flex',
      flexDirection: 'column',
      height: 100,
      justifyContent: 'flex-end',
    }
    const coloredBarStyle = {
      backgroundColor: isHighlighted ? Colors.SKY_BLUE : Colors.SILVER,
      height: 2 * percentage,
      marginLeft: 32,
      marginRight: 32,
    }
    return <div style={style}>
      <div style={barAndTextStyle}>
        <div style={valueStyle}>
          {percentage} %
        </div>
        <div>
          <div style={coloredBarStyle}></div>
        </div>
      </div>
      <div style={titleStyle}>
        {title}
      </div>
    </div>
  }

  render() {
    const graphData = [{percentage: 12, title: 'Retour grâce à des offres internet'},
                       {percentage: 44, title: "Retour grâce à l'etourage et les contacts"}]
    const graphStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 0,
      ...this.props.style,
    }
    return <div style={graphStyle}>
      <div>
        {this.renderBar(graphData[0], false)}
        {this.renderBar(graphData[1], true)}
      </div>
    </div>
  }
}


class FullAdviceCard extends React.Component {
  static propTypes = {
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  renderNetworkGraph() {
    const headerStyle = {
      fontSize: 12,
      fontWeight: 'bold',
      padding: 20,
      textTransform: 'uppercase',
    }
    return <section>
      <header style={headerStyle}>
        le réseau est le moyen le plus efficace de retour à l'emploi*
      </header>
      <JobOriginChart />
    </section>
  }

  renderHow(sectionStyle) {
    const {profile, project} = this.props
    const titleStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 1.31,
      textTransform: 'uppercase',
    }
    return <div style={sectionStyle}>
      <div style={titleStyle}>Comment&nbsp;:</div>
      <HowToBox
          title="Un bon réseau est un réseau gagnant-gagnant"
          style={{marginTop: 10}}>
        Indiquez à vos contacts ce qu'ils auraient à gagner en
        entrant en contact avec vous ou au moins rassurez-les
        en précisant l'objectif de votre demande.
      </HowToBox>
      <HowToBox
          disabled={project.previousJobSimilarity !== 'DONE_THIS'}
          title="Revenez vers vos anciens clients"
          reason="Vous nous avez dit avoir déjà fait un métier similaire">
        Ils pourraient avoir eu vent de bonnes opportunités qui
        pourraient vous intéresser.
      </HowToBox>
      <HowToBox
          disabled={(profile.frustrations || []).indexOf('MOTIVATION') < 0}
          title="Garder le moral au top"
          reason="Vous nous avez dit ne pas avoir le moral dans votre recherche">
        Parler de votre situation avec vos proches ou vos
        contacts vous permettra de faire un point et de récueillir
        des conseils ou de l'aide en fonction de vos besoin.
      </HowToBox>
    </div>
  }

  renderWhy(sectionStyle) {
    const titleStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 1.31,
      textTransform: 'uppercase',
    }
    const explanationStyle = {
      fontSize: 16,
      lineHeight: 1.31,
      marginTop: 15,
      paddingTop: 10,
    }
    const boxContentStyle = {
      border: 'solid 1px',
      borderColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 4,
      fontSize: 13,
      marginTop: 10,
      padding: 5,
    }
    const footnoteStyle = {
      color: Colors.COOL_GREY,
      fontSize: 13,
      marginTop: 6,
    }
    return <section style={sectionStyle}>
      <header style={titleStyle}>Pourquoi&nbsp;:</header>
      <div style={boxContentStyle}>
        {this.renderNetworkGraph()}
      </div>
      <div style={footnoteStyle}>
        *source : Enquète IFOP 2016
      </div>
      <div style={explanationStyle}>
        <strong style={{color: Colors.SKY_BLUE}}>44%</strong> des gens retrouvent
        un emploi grâce à <strong>leurs contacts</strong> contre
        seulement <strong style={{color: Colors.SQUASH}}>12%</strong> via des
        offres sur internet.
      </div>
    </section>
  }

  render() {
    return <AdviceCard
        title="Contactez vos proches et vos anciens clients pour booster votre recherche"
        goal="construire votre réseau"
        {...this.props}>
      <div style={{display: 'flex'}}>
        {this.renderWhy({flex: 1, padding: 25})}
        {this.renderHow({flex: 2, marginRight: 30, padding: 25})}
      </div>
    </AdviceCard>
  }
}


export default {FullAdviceCard, RecommendPage}
