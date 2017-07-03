import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {getResumeTips} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {genderizeJob} from 'store/job'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, CircularProgress, Colors, Icon, Markdown,
  PaddedOnMobile, Styles, Tag} from 'components/theme'


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


class AdviceCard extends React.Component {
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


// TODO(pascal): Factorize with Improve Resume.
class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    improvements: PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      contentMasculine: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired),
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    qualities: PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      contentMasculine: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired),
  }

  state = {}

  componentWillMount() {
    const {dispatch, project, qualities} = this.props
    if (!qualities) {
      dispatch(getResumeTips(project))
    }
  }

  renderSection(id, title, items, style) {
    const {profile} = this.props
    const isMasculine = profile.gender === 'MASCULINE'
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
    const isSpecificToJob = ({filters}) => (filters || []).some(f => f.match(/^for-job-group/))
    return <section style={style}>
      <PaddedOnMobile style={{marginBottom: 15}}>{title}</PaddedOnMobile>
      <AppearingList maxNumChildren={areAllItemsShown ? 0 : 4}>
        {items.map((tip, index) => <div
          key={`tip-${id}-${index}`} style={{marginTop: index ? -1 : 0, ...itemStyle}}>
          <Markdown content={isMasculine && tip.contentMasculine || tip.content} />
          {isSpecificToJob(tip) ?
            this.renderTag('Pour votre métier', Colors.GREENISH_TEAL) : null}
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
      marginLeft: 15,
    }
    return <Tag style={tagStyle}>{content}</Tag>
  }

  render() {
    const {improvements, qualities} = this.props
    if (!qualities || !improvements) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    return <div>
      {this.renderSection(
        'qualities', 'Qualités les plus attendues par les recruteurs :',
        qualities, {marginBottom: 40})}
      {this.renderSection('improve', 'Pour améliorer votre candidature', improvements)}
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => ({
  ...app.resumeTips[project.projectId],
}))(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent}
