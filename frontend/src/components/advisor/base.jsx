import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {USER_PROFILE_SHAPE} from 'store/user'

import {FeatureLikeDislikeButtons} from 'components/like'
import {AppearingList, CircularProgress, Colors, Icon, Markdown,
  PaddedOnMobile, SmoothTransitions, Styles, Tag} from 'components/theme'

// Todo(guillaume)#lutins: Clean up.
class AdviceBox extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    feature: PropTypes.string.isRequired,
    header: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, feature, header, style} = this.props
    const {padding, ...outerStyle} = style
    const containerStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      ...outerStyle,
    }
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: '4px 4px 0 0',
      display: 'flex',
      fontSize: 16,
      justifyContent: 'center',
      padding: 30,
      textAlign: 'center',
    }
    const contentStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      fontSize: 13,
      padding: (padding || padding === 0) ? padding : '20px 35px',
      position: 'relative',
    }
    return <div style={containerStyle}>
      <header style={headerStyle}>
        {header}
      </header>

      <div style={contentStyle}>
        <FeatureLikeDislikeButtons
          style={{position: 'absolute', right: 30, top: -16}}
          feature={feature} />
        {children}
      </div>
    </div>
  }
}


// TODO: Find a better place for those tags if we don't need them elsewhere in this file.
const typeTags = {
  'apply-to-offer': {
    color: Colors.SQUASH,
    value: 'candidature à une offre',
  },
  'spontaneous-application': {
    color: Colors.GREENISH_TEAL,
    value: 'candidature spontanée',
  },
}


class EmailTemplateBase extends React.Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
    type: PropTypes.oneOf(Object.keys(typeTags)),
    whyForYou: PropTypes.string,
  }

  state = {
    isContentShown: false,
  }

  renderType() {
    const {type} = this.props
    const {color, value} = typeTags[type] || {}
    if (!value) {
      return null
    }
    const tagStyle = {
      backgroundColor: color,
      marginLeft: 10,
    }
    return <Tag style={tagStyle}>{value}</Tag>
  }

  render() {
    const {content, style, title, whyForYou} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : Colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
    }
    const contentStyle = {
      borderLeft: `solid 4px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      fontSize: 13,
      margin: isContentShown ? '25px 0' : 0,
      maxHeight: isContentShown ? 600 : 0,
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      paddingLeft: 15,
      ...SmoothTransitions,
    }
    const linkStyle = {
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    // TODO(guillaume): Print reason when the user mouseovers the tag.
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={() => this.setState({isContentShown: !isContentShown})}>
        <strong style={Styles.CENTER_FONT_VERTICALLY}>
          {title}
        </strong>
        {whyForYou ? <Tag style={{backgroundColor: Colors.SKY_BLUE, marginLeft: 10}}>
          Selectionné pour vous
        </Tag> : null}
        {this.renderType()}
        <span style={{flex: 1}} />
        <span style={linkStyle}>
          Voir {isContentShown ? 'moins ' : "l'email "}
        </span>
        <Icon
          name={isContentShown ? 'chevron-up' : 'chevron-down'}
          style={{fontSize: 20, lineHeight: '13px', marginLeft: 5}} />
      </header>

      <div style={contentStyle}>
        <Markdown content={content} />
      </div>
    </div>
  }
}
const EmailTemplate = Radium(EmailTemplateBase)

class ToolCardBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    href: PropTypes.string.isRequired,
    imageSrc: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {children, imageSrc, href, style} = this.props
    const cardStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      cursor: 'pointer',
      display: 'flex',
      padding: 10,
      ...SmoothTransitions,
      ...style,
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      fontSize: 14,
      fontWeight: 'bold',
    }
    return <div style={cardStyle} onClick={() => window.open(href, '_blank')}>
      <div style={titleStyle}>
        <img src={imageSrc}
          style={{height: 55, width: 55}} />
        <div style={{paddingLeft: 20}}>{children}</div>
      </div>
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const ToolCard = Radium(ToolCardBase)


class ImproveApplicationTipsBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    getTipsAction: PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    sections: PropTypes.arrayOf(PropTypes.shape({
      data: PropTypes.string.isRequired,
      title: PropTypes.node.isRequired,
    }).isRequired).isRequired,
    tips: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      contentMasculine: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired)).isRequired,
  }

  state = {}

  componentWillMount() {
    const {dispatch, getTipsAction, project, sections, tips} = this.props
    if (sections.some(({data}) => !tips[data])) {
      dispatch(getTipsAction(project))
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
    const {sections, tips} = this.props
    if (sections.some(({data}) => !tips[data])) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    return <div>
      {sections.map(({data, title}, index) => this.renderSection(
        data, title, tips[data], index ? {marginTop: 40} : {}))}
    </div>
  }
}
const ImproveApplicationTips = connect(({app}, {project, tipsCacheField}) => ({
  tips: app[tipsCacheField][project.projectId] || {},
}))(ImproveApplicationTipsBase)


export {AdviceBox, ToolCard, EmailTemplate, ImproveApplicationTips}
