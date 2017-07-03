import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {getInterviewTips} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, CircularProgress, Colors, Icon, Markdown,
  PaddedOnMobile, Styles, Tag} from 'components/theme'


function getSimpleSkills(improveSuccessRateData, numSkills) {
  const skillsSoup = improveSuccessRateData && improveSuccessRateData.requirements &&
    improveSuccessRateData.requirements.skillsShortText || ''
  return skillsSoup.split('\n').filter(skill => skill).slice(0, numSkills).
    map(skill => skill.replace(/^\* /, '').replace(/, .*$/, '')).
    map(skill => skill.toLocaleLowerCase())
}


class AdviceCard extends React.Component {
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


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    preparations: PropTypes.arrayOf(PropTypes.shape({
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
      dispatch(getInterviewTips(project))
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
    const {preparations, qualities} = this.props
    if (!qualities || !preparations) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    return <div>
      {this.renderSection(
        'qualities', 'Qualités les plus attendues par les recruteurs :',
        qualities, {marginBottom: 40})}
      {this.renderSection('improve', 'Pour préparer votre entretien', preparations)}
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => ({
  ...app.interviewTips[project.projectId],
}))(ExpandedAdviceCardContentBase)


export default {AdviceCard, ExpandedAdviceCardContent}
