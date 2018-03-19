import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {getExpandedCardContent} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user'

import {AppearingList, CircularProgress, Colors, UpDownIcon, Markdown,
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


class ExpandableActionBase extends React.Component {
  static propTypes = {
    children: PropTypes.element,
    contentName: PropTypes.string.isRequired,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
    type: PropTypes.oneOf(Object.keys(typeTags)),
    userYou: PropTypes.func.isRequired,
    whyForYou: PropTypes.string,
  }

  static defaultProps = {
    contentName: 'plus',
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
    const {children, contentName, style, title, userYou, whyForYou} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : Colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
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
    const iconStyle = {
      fill: Colors.CHARCOAL_GREY,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    const linkStyle = {
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const hiddenContentStyle = {
      marginBottom: 0,
      marginTop: 0,
      maxHeight: 0,
      opacity: 0,
      overflow: 'hidden',
      paddingBottom: 0,
      paddingTop: 0,
    }
    const childStyle = props => ({
      ...props.style || {},
      ...isContentShown ? {} : hiddenContentStyle,
      ...SmoothTransitions,
    })
    // TODO(guillaume): Print reason when the user mouseovers the tag.
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={() => this.setState({isContentShown: !isContentShown})}>
        <strong style={Styles.CENTER_FONT_VERTICALLY}>
          {title}
        </strong>
        {whyForYou ? <Tag style={{backgroundColor: Colors.BOB_BLUE, marginLeft: 10}}>
          {userYou('Selectionné pour toi', 'Selectionné pour vous')}
        </Tag> : null}
        {this.renderType()}
        <span style={{flex: 1}} />
        <span style={linkStyle}>
          Voir {isContentShown ? 'moins' : contentName}{' '}
        </span>
        <UpDownIcon icon="chevron" isUp={isContentShown} style={iconStyle} />
      </header>
      {React.cloneElement(children, {
        style: childStyle(children.props),
      })}
    </div>
  }
}
const ExpandableAction = Radium(ExpandableActionBase)

class EmailTemplate extends React.Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    style: PropTypes.object,
    tip: PropTypes.string,
    title: PropTypes.node.isRequired,
    userYou: PropTypes.func.isRequired,
    whyForYou: PropTypes.string,
  }

  render() {
    const {content, tip} = this.props
    const contentStyle = {
      borderLeft: `solid 4px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      fontSize: 13,
      marginBottom: tip ? 10 : 25,
      marginTop: 25,
      maxHeight: 600,
      overflow: 'hidden',
      paddingLeft: 15,
    }
    const tipStyle = {
      fontSize: 13,
      opacity: 1,
      paddingBottom: 15,
      paddingLeft: 15,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <ExpandableAction {...this.props} contentName="l'email">
      <div>
        <div style={contentStyle}>
          <Markdown style={{}} content={content} />
        </div>
        {tip ? <div style={tipStyle}><strong>Astuce&nbsp;: </strong>{tip}</div> : null}
      </div>
    </ExpandableAction>
  }
}

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
      <ChevronRightIcon style={{fill: Colors.CHARCOAL_GREY, width: 20}} />
    </div>
  }
}
const ToolCard = Radium(ToolCardBase)


// Extended version of redux' connect function (it should be used exactly the
// same way), but augment the wrapped component with: an extra prop called
// `adviceData` and a dispatch call just before the component is mounted to
// populate it.
const connectExpandedCardWithContent = reduceFunc => Component => {
  class ExpandedCardWithContentBase extends React.Component {
    static propTypes = {
      advice: PropTypes.shape({
        adviceId: PropTypes.string.isRequired,
      }).isRequired,
      dispatch: PropTypes.func.isRequired,
      project: PropTypes.shape({
        projectId: PropTypes.string.isRequired,
      }).isRequired,
    }

    componentWillMount() {
      const {advice, dispatch, project} = this.props
      dispatch(getExpandedCardContent(project, advice.adviceId))
    }

    render() {
      return <Component {...this.props} />
    }
  }
  return connect(function({app}, {advice, project}) {
    return {
      adviceData: (app.adviceData[project.projectId] || {})[advice.adviceId] || {},
      ...reduceFunc && reduceFunc.apply(this, arguments),
    }
  })(ExpandedCardWithContentBase)
}


class ImproveApplicationTipsBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      contentMasculine: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    }).isRequired)).isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    sections: PropTypes.arrayOf(PropTypes.shape({
      data: PropTypes.string.isRequired,
      title: PropTypes.node.isRequired,
    }).isRequired).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  renderSection(id, title, items, style) {
    const {profile, userYou} = this.props
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
    return <section style={style} key={`section-${id}`}>
      <PaddedOnMobile style={{marginBottom: 15}}>{title}</PaddedOnMobile>
      <AppearingList maxNumChildren={areAllItemsShown ? 0 : 4}>
        {items.map((tip, index) => <div
          key={`tip-${id}-${index}`} style={{marginTop: index ? -1 : 0, ...itemStyle}}>
          <Markdown content={isMasculine && tip.contentMasculine || tip.content} />
          {isSpecificToJob(tip) ?
            this.renderTag(
              userYou('Pour ton métier', 'Pour votre métier'),
              Colors.GREENISH_TEAL,
            ) : null
          }
        </div>)}
      </AppearingList>
      {(areAllItemsShown || items.length <= 4) ? null : <div
        key={`${id}-more`} style={showMoreStyle}
        onClick={() => this.setState({[areAllItemsShownId]: true})}>
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir plus
        </span>
        <ChevronDownIcon style={{fill: Colors.CHARCOAL_GREY, height: 20, width: 20}} />
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
    const {sections, adviceData} = this.props
    if (sections.some(({data}) => !adviceData[data])) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    return <div>
      {sections.map(({data, title}, index) => this.renderSection(
        data, title, adviceData[data], index ? {marginTop: 40} : {}))}
    </div>
  }
}
const ImproveApplicationTips = connectExpandedCardWithContent()(ImproveApplicationTipsBase)


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


class AdviceSuggestionListBase extends React.Component {
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
      paddingLeft: 20,
      paddingRight: 20,
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
const AdviceSuggestionList = Radium(AdviceSuggestionListBase)

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

class JobSuggestionBase extends React.Component {
  static propTypes = {
    isCaption: PropTypes.bool,
    job: PropTypes.object,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  handleClick = () => {
    const {job} = this.props
    window.open(`https://www.google.fr/search?q=${encodeURIComponent(job.name)}`, '_blank')
  }

  renderCaption(style) {
    const captionStyle = {
      fontStyle: 'normal',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={style}>
      <span style={captionStyle}>
        Offres par candidat par rapport à votre métier&nbsp;:
      </span>
    </div>
  }

  renderJob(style) {
    const {job} = this.props
    const {isMobileVersion} = this.context
    const multiplierStyle = {
      color: Colors.HOVER_GREEN,
      flex: 1,
      fontWeight: 'bold',
      marginRight: 0,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const jobNameStyle = {
      flex: isMobileVersion ? 4 : 1,
      fontWeight: 'bold',
      marginRight: isMobileVersion ? 10 : 'initial',
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
    }
    const textStyle = {
      ...Styles.CENTER_FONT_VERTICALLY,
    }

    const roundedPercentGain = Math.round(job.offersPercentGain * 10) / 10

    if (!job) {
      return null
    }

    return <div style={style} onClick={this.handleClick}>
      <div style={jobNameStyle}>
        {job.name}
      </div>
      <div style={{flex: 1}}>
        <span style={{alignItems: 'center', display: 'flex'}}>
          {roundedPercentGain > 0.1 ? <div style={multiplierStyle}>
            +{roundedPercentGain}% d'offres
          </div> : null}
          {isMobileVersion ? null : <div style={textStyle}>Découvrir ce métier</div>}
          <ChevronRightIcon style={chevronStyle} />
        </span>
      </div>
    </div>
  }

  render() {
    const {isCaption, style} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      minHeight: isMobileVersion ? 'initial' : 50,
      ...style,
    }
    if (isCaption) {
      return this.renderCaption(containerStyle)
    }
    return this.renderJob(containerStyle)
  }
}
const JobSuggestion = Radium(JobSuggestionBase)

class MissionBase extends React.Component {
  static propTypes = {
    aggregatorName: PropTypes.string,
    associationName: PropTypes.node,
    description: PropTypes.node,
    isAvailableEverywhere: PropTypes.bool,
    link: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string,
  }

  state = {
    isContentShown: false,
  }

  render() {
    const {aggregatorName, associationName, description, isAvailableEverywhere,
      link, style, title} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : Colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
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
      lineHeight: 1.6,
      margin: isContentShown ? '25px 0' : 0,
      maxHeight: isContentShown ? 600 : 0,
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      paddingLeft: 15,
      ...SmoothTransitions,
    }
    const tagStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      marginLeft: 15,
    }
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
      flexShrink: 0,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={() => this.setState({isContentShown: !isContentShown})}>
        <strong style={Styles.CENTER_FONT_VERTICALLY}>
          {associationName}
        </strong>
        {isAvailableEverywhere ? <Tag style={tagStyle}>
          depuis chez vous
        </Tag> : null}
        <span style={{flex: 1}} />
        <span style={Styles.CENTER_FONT_VERTICALLY}>
          Voir {isContentShown ? 'moins ' : 'la mission '}
        </span>
        <UpDownIcon
          icon="chevron"
          isUp={isContentShown}
          style={chevronStyle}
        />
      </header>

      <div style={contentStyle}>
        <div style={{marginBottom: 20}}>
          <strong>Intitulé de la mission&nbsp;:</strong><br />
          {title}
        </div>

        <div>
          <strong>Description&nbsp;:</strong><br />
          <Markdown content={description} />
        </div>

        {link ? <div style={{marginTop: 20}}>
        Lire la suite sur <a href={link} target="_blank" rel="noopener noreferrer">{aggregatorName}
          </a>
        </div> : null}
      </div>
    </div>
  }
}
const Mission = Radium(MissionBase)


class MoreMissionsLinkBase extends React.Component {
  static propTypes = {
    altLogo: PropTypes.string,
    children: PropTypes.node,
    logo: PropTypes.string,
    style: PropTypes.object,
  }

  render() {
    const {altLogo, children, logo, style, ...extraProps} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 25px',
      ...style,
    }
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    return <div style={containerStyle} {...extraProps}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={logo} style={{height: 25}} alt={altLogo} />
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const MoreMissionsLink = Radium(MoreMissionsLinkBase)

class DataSource extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, style} = this.props
    const sourceStyle = {
      color: Colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
      margin: '15px 0',
      ...style,
    }

    return <PaddedOnMobile style={sourceStyle}>
      *Source&nbsp;: {children}
    </PaddedOnMobile>
  }
}


export {ToolCard, EmailTemplate, ImproveApplicationTips, AdviceSuggestionList,
  Tip, PercentageBoxes, connectExpandedCardWithContent, JobSuggestion, ExpandableAction,
  Mission, MoreMissionsLink, DataSource}
