import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, CircularProgress, Colors, Icon, Markdown,
  PaddedOnMobile, SmoothTransitions, Styles, Tag} from 'components/theme'

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
          style={{height: 55, width: 55}} alt="" />
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
  tips: (app.adviceData[project.projectId] || {})[tipsCacheField] || {},
}))(ImproveApplicationTipsBase)


class PercentageBoxes extends React.Component {
  // This class enables to represent a percentage in form of little boxes, for instance
  // 250% will be represented as 2.5 boxes
  // Percentages below 100% are not displayed.

  static propTypes = {
    percentage: PropTypes.number,
  }

  renderBox(percentage, isTarget, key) {
    const boxStyle = {
      backgroundColor: isTarget ? Colors.SLATE : Colors.HOVER_GREEN,
      borderRadius: 2,
      marginLeft: 5,
      width: `${percentage * 22}px`,
    }
    return <div style={boxStyle} key={`box-${key}`} />
  }

  render() {
    const {percentage} = this.props
    // Do not represent values below 1.
    if (percentage < 1) {
      return null
    }
    const maxBoxes = 8
    const nbBoxes = Math.floor(percentage)

    const boxes = []

    if (nbBoxes >= maxBoxes) {
      boxes.push({percentage: .5})
      new Array(maxBoxes / 2 - 1).fill().forEach(() => boxes.push({percentage: 1}))
      const dotsStyle = {
        color: Colors.HOVER_GREEN,
        fontWeight: 'bold',
        marginLeft: 5,
        marginTop: 8,
      }
      boxes.push({
        component: <div style={dotsStyle} key="dots">…</div>,
      })
      new Array(maxBoxes / 2 - 1).fill().forEach(() => boxes.push({percentage: 1}))
    } else {
      boxes.push({percentage: percentage - nbBoxes})
      new Array(nbBoxes - 1).fill().forEach(() => boxes.push({percentage: 1}))
    }
    boxes.push({isTarget: true, percentage: 1})

    return <div style={{display: 'flex', height: 22}}>
      {boxes.map(({component, isTarget, percentage}, index) =>
        component || this.renderBox(percentage, isTarget, index))}
    </div>
  }
}


class AdviceSuggestionList extends React.Component {
  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    isNotClickable: PropTypes.bool,
  }

  render() {
    const {children, isNotClickable, ...extraProps} = this.props
    const childStyle = (index, props) => ({
      ':hover': (isNotClickable || props.isNotClickable) ? {} : {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: (isNotClickable || props.isNotClickable) ? 'initial' : 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      marginTop: index ? -1 : 0,
      minHeight: 50,
      padding: '0 20px',
      ...SmoothTransitions,
      ...props.style,
    })
    return <AppearingList {...extraProps}>
      {children.map((child, index) => React.cloneElement(child, {
        style: childStyle(index, child.props),
      }))}
    </AppearingList>
  }
}

class TipBase extends React.Component {
  static propTypes = {
    style: PropTypes.string,
    tip: PropTypes.string.isRequired,
  }

  render() {
    const {tip, style} = this.props
    const tipStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...style,
    }
    return <div style={tipStyle} >
      {tip}
    </div>
  }
}
const Tip = Radium(TipBase)


export {ToolCard, EmailTemplate, ImproveApplicationTips, AdviceSuggestionList, Tip, PercentageBoxes}
