import React from 'react'

import {USER_PROFILE_SHAPE} from 'store/user'

import {Colors, GrowingNumber, PaddedOnMobile, Styles} from 'components/theme'

import {AdviceCard, PersonalizationBoxes} from './base'
import {WorkBox} from './improve_success_rate'

class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  renderNumber(number, style) {
    const containerStyle = {
      alignItems: 'center',
      border: 'solid 12px',
      borderRadius: 100,
      color: Colors.SQUASH,
      display: 'flex',
      fontSize: 70,
      fontWeight: 'bold',
      height: 120,
      justifyContent: 'center',
      width: 120,
      ...Styles.CENTER_FONT_VERTICALLY,
      ...style,
    }
    return <div style={containerStyle}>
      <GrowingNumber number={number} />
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const textStyle = {
      flex: 1,
      fontSize: 20,
      lineHeight: 1.4,
      marginLeft: 50,
    }
    return <AdviceCard
        {...this.props}
        reasons={['COUNT_INTERVIEWS', 'ATYPIC_PROFILE', 'INTERVIEW']}>
      <div style={{alignItems: 'center', display: 'flex'}}>
        {isMobileVersion ? null : this.renderNumber(5)}
        <div style={textStyle}>
          En général il suffit de <strong>5 entretiens</strong> pour retrouver
          un emploi dans votre métier.
        </div>
      </div>
    </AdviceCard>
  }
}


const personalizations = [
  {
    filters: ['YOUNG_AGE'],
    tip: `Quand on est jeune ce qu'il faut mettre en avant c'est son potentiel
      et sa capacité à apprendre vite`,
  },
  {
    filters: ['ATYPIC_PROFILE'],
    tip: `Mettez-vous à la place des recruteurs et demandez-vous ce qui dans
      votre profil pourrait les convaincre`,
  },
  {
    filters: ['OLD_AGE'],
    tip: `Essayez de rassurer les recruteurs sur vos prétentions salariales car
      c'est souvent ce qui bloquent`,
  },
  {
    filters: ['INTERVIEW'],
    tip: 'Entraînez-vous le plus possible pour essayer de dédramatiser les entretiens',
  },
  {
    filters: ['NO_OFFER_ANSWERS'],
    tip: `Après l'entretien, envoyez toujours un mail pour remercier et
      profitez-en pour demander les prochaines étapes du recrutement`,
  },
  {
    filters: ['NEW_JOB', 'FIRST_JOB_SEARCH', 'YOUNG_AGE'],
    tip: 'Montrez que vous êtes flexible et enthousiaste et que vous apprenez vite',
  },
]


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {advice, profile, project} = this.props
    const {isMobileVersion} = this.context
    const {improveSuccessRateData} = advice
    const isFeminine = profile.gender === 'FEMININE'
    const skills =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.skillsShortText ||
      (`* Vous êtes organisé${isFeminine ? 'e' : ''} et ` +
      `travailleu${isFeminine ? 'r' : 'se'}\n` +
      '* Vous savez vous adapter et trouver des solutions\n' +
      '* Gérez votre stress et gardez le sourire\n')
    const bonusSkills =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.bonusSkillsShortText ||
      ("* Renseignez-vous sur l'entreprise avant l'entretien\n" +
      "* Expliquez ce qui vous motive dans l'entreprise\n" +
      "* Envoyez un email après l'entretien pour redire votre motivation")
    return <div>
      <PaddedOnMobile>Pour votre métier :</PaddedOnMobile>
      <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
        <WorkBox
            featureId="improve-interview-qualities"
            featureName="qualités" subTitle="à montrer lors de vos entretiens"
            features={skills} style={{flex: 1}} />
        <div style={{height: 30, width: 30}} />
        <WorkBox
            featureId="improve-interview-means"
            featureName="moyens" subTitle="efficaces pour réussir vos entretiens"
            features={bonusSkills} style={{flex: 1}} />
      </div>

      <PersonalizationBoxes
          style={{marginTop: 30}} profile={profile} project={project}
          personalizations={personalizations} />
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
