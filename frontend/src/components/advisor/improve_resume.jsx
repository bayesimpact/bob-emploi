import React from 'react'
import PropTypes from 'prop-types'

import {lowerFirstLetter} from 'store/french'
import {genderizeJob} from 'store/job'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, Colors, Icon, Markdown, PaddedOnMobile, Styles} from 'components/theme'


function splitBullets(markdownContent) {
  if (!markdownContent) {
    return []
  }
  return markdownContent.replace(/^\* /, '').split('\n* ')
}

function getPersonalizedItems(improveSuccessRateData) {
  const {bonusSkillsShortText, trainingsShortText} =
    improveSuccessRateData && improveSuccessRateData.requirements || {}
  return splitBullets(bonusSkillsShortText || '').concat(splitBullets(trainingsShortText || ''))
}


const defaultMeans = [
  'Faites relire votre CV par un proche',
  'Réutilisez les mots-clés des fiches de postes dans vos CV',
  'Envoyez des emails de relance aux recruteurs',
]


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice, project} = this.props
    const {improveSuccessRateData} = advice
    const personalizedItems = getPersonalizedItems(improveSuccessRateData)
    if (personalizedItems.length) {
      return <div style={{fontSize: 30}}>
        <strong>{personalizedItems[0]}</strong> pour augmenter vos chances
        quand vous postulez
        comme <strong>{lowerFirstLetter(genderizeJob(project.targetJob))}</strong>.
      </div>
    }
    return <div style={{fontSize: 30}}>
      En <strong>expliquant bien pourquoi votre profil est adapté pour
      le poste</strong> votre candidature aura beaucoup plus de poids.
    </div>
  }
}


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  state = {}

  renderSection(id, title, items, style) {
    const areAllItemsShownId = `areAllItemsShown-${id}`
    const areAllItemsShown = this.state[areAllItemsShownId]
    const itemStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      fontSize: 13,
      minHeight: 50,
      padding: '10px 20px',
    }
    const showMoreStyle = {
      ...itemStyle,
      cursor: 'pointer',
      fontWeight: 500,
      marginTop: -1,
    }
    return <section style={style}>
      <PaddedOnMobile style={{marginBottom: 15}}>{title}</PaddedOnMobile>
      <AppearingList maxNumChildren={areAllItemsShown ? 0 : 4}>
        {items.map((advice, index) => <div
            key={`advice-${id}-${index}`} style={{marginTop: index ? -1 : 0, ...itemStyle}}>
          <Markdown content={advice.content || advice} />
          {advice.isSpecificToJob ?
            this.renderTag('Pour votre métier', Colors.GREENISH_TEAL) : null}
          {advice.isImportant ? this.renderTag('Important', Colors.RED_PINK) : null}
        </div>)}
      </AppearingList>
      {(areAllItemsShown || items.length <= 4) ? null : <div
          key={`${id}-more`} style={showMoreStyle}
          onClick={() => this.setState({[areAllItemsShownId]: true})}>
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir plus
        </span>
        <Icon name="chevron-down" style={{fontSize: 20}} />
      </div>}
    </section>
  }

  renderTag(content, backgroundColor) {
    const tagStyle = {
      backgroundColor,
      borderRadius: 2,
      color: '#fff',
      display: 'inline-block',
      flexShrink: 0,
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: .3,
      marginLeft: 15,
      padding: 6,
      textTransform: 'uppercase',
    }
    return <span style={tagStyle}>
      <div style={Styles.CENTER_FONT_VERTICALLY}>{content}</div>
    </span>
  }

  render() {
    const {advice, profile} = this.props
    const {improveSuccessRateData} = advice
    const isFeminine = profile.gender === 'FEMININE'
    const skills = splitBullets(
      improveSuccessRateData && improveSuccessRateData.requirements &&
      improveSuccessRateData.requirements.skillsShortText)
    const defaultSkills = [
      `Vous êtes organisé${isFeminine ? 'e' : ''} et ` +
      `travailleu${isFeminine ? 'se' : 'r'}`,
      'Vous savez vous adapter et trouver des solutions',
      'Vous savez gérer votre stress et garder le sourire',
    ]
    const personalizedItems = getPersonalizedItems(improveSuccessRateData)
    return <div>
      {this.renderSection(
        'personalize', 'Pour personnaliser votre candidature',
        personalizedItems.map(content => ({content, isSpecificToJob: true})).concat(defaultMeans),
        {marginBottom: 40})}
      {this.renderSection(
        'qualities',
        <span>
          Qualités les plus attendues par les recruteurs
          {skills.length ? <span> pour <strong>votre métier</strong></span> :null}
        </span>,
        (skills.length ? skills : defaultSkills).
          map((content, index) => ({content, isImportant: index < 2})))}
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
