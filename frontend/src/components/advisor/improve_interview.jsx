import React from 'react'
import PropTypes from 'prop-types'

import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, Colors, Markdown, PaddedOnMobile} from 'components/theme'


function getSimpleSkills(improveSuccessRateData, numSkills) {
  const skillsSoup = improveSuccessRateData && improveSuccessRateData.requirements &&
    improveSuccessRateData.requirements.skillsShortText || ''
  return skillsSoup.split('\n').filter(skill => skill).slice(0, numSkills).
    map(skill => skill.replace(/^\* /, '').replace(/, .*$/, '')).
    map(skill => skill.toLocaleLowerCase())
}


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {improveSuccessRateData} = this.props.advice
    const skills = getSimpleSkills(improveSuccessRateData, 3)
    if (!skills.length) {
      return <div style={{fontSize: 30}}>
        En expliquant bien pourquoi <strong>votre profil est adapté pour
        le poste</strong> vous augmenterez vos chances en entretien.
      </div>
    }
    return <div style={{fontSize: 30}}>
      En mettant en avant votre <strong>{skills.join(', ')}…</strong> vous
      commencez à montrer votre motivation.
    </div>
  }
}


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  renderSection(id, title, content, style) {
    const items = ('\n' + content).split('\n* ').slice(1)
    const itemStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      fontSize: 13,
      minHeight: 50,
      padding: '10px 20px',
    }
    return <section style={style}>
      <PaddedOnMobile style={{marginBottom: 15}}>{title}</PaddedOnMobile>
      <AppearingList>
        {items.map((advice, index) => <div
            key={`advice-id-${index}`} style={{marginTop: index ? -1 : 0, ...itemStyle}}>
          <Markdown content={advice} />
        </div>)}
      </AppearingList>
    </section>
  }

  render() {
    const {advice, profile} = this.props
    const {improveSuccessRateData} = advice
    const isFeminine = profile.gender === 'FEMININE'
    const personalize =
      "* Montrez que vous connaissez l'entreprise et ses enjeux\n" +
      '* Expliquez en quoi le poste est important\n' +
      '* Expliquez pourquoi votre profil est adapté pour le poste\n' +
      `* Montrez que l'expérience que vous avez acquise de précédent(s)
      emploi(s) ou stage(s) sera un atout pour le poste`
    const bonusSkills =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.bonusSkillsShortText
    const skills =
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.skillsShortText ||
      (`* Vous êtes organisé${isFeminine ? 'e' : ''} et ` +
      `travailleu${isFeminine ? 'se' : 'r'}\n` +
      '* Vous savez vous adapter et trouver des solutions\n' +
      '* Gérez votre stress et gardez le sourire') + (bonusSkills ? ('\n' + bonusSkills) : '')
    return <div>
      {this.renderSection(
        'personalize', 'Pour personnaliser votre candidature', personalize,
        {marginBottom: 40})}
      {this.renderSection(
        'qualities', 'Qualités attendues par les recruteurs pour votre métier', skills)}
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
