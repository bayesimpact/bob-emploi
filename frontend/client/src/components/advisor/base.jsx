import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {getExpandedCardContent} from 'store/actions'
import {assetProps} from 'store/skills'

import {isMobileVersion} from 'components/mobile'
import {AppearingList, Button, CircularProgress, ExternalLink, Markdown,
  PaddedOnMobile, SmoothTransitions, Tag, UpDownIcon} from 'components/theme'

// TODO: Find a better place for those tags if we don't need them elsewhere in this file.
const typeTags = {
  'apply-to-offer': {
    color: colors.SQUASH,
    value: 'candidature à une offre',
  },
  'spontaneous-application': {
    color: colors.GREENISH_TEAL,
    value: 'candidature spontanée',
  },
}


class ExpandableActionBase extends React.Component {
  static propTypes = {
    children: PropTypes.element,
    contentName: PropTypes.string.isRequired,
    onContentShown: PropTypes.func,
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

  handleClick = () => {
    const {isContentShown} = this.state
    const {onContentShown} = this.props
    this.setState({isContentShown: !isContentShown})
    if (!isContentShown) {
      onContentShown && onContentShown()
    }
  }

  renderType() {
    if (isMobileVersion) {
      return null
    }
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
        backgroundColor: isContentShown ? '#fff' : colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      padding: isMobileVersion ? '0 15px' : '0 25px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      color: colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
    }
    const iconStyle = {
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
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
      <header style={headerStyle} onClick={this.handleClick}>
        <strong>
          {title}
        </strong>
        {whyForYou ? <Tag style={{backgroundColor: colors.BOB_BLUE, marginLeft: 10}}>
          {userYou('Selectionné pour toi', 'Selectionné pour vous')}
        </Tag> : null}
        {this.renderType()}
        <span style={{flex: 1}} />
        {isMobileVersion ? null : <span>
          Voir {isContentShown ? 'moins' : contentName}{' '}
        </span>}
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
      borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
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
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  handleClick = () => {
    const {href, onClick} = this.props
    window.open(href, '_blank')
    onClick && onClick()
  }

  render() {
    const {children, imageSrc, style} = this.props
    const cardStyle = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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
    return <div style={cardStyle} onClick={this.handleClick}>
      <div style={titleStyle}>
        <img src={imageSrc}
          style={{height: 55, width: 55}} alt="" />
        <div style={{paddingLeft: 20}}>{children}</div>
      </div>
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, width: 20}} />
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
        projectId: PropTypes.string,
      }).isRequired,
    }

    componentDidMount() {
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
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    sections: PropTypes.arrayOf(PropTypes.shape({
      data: PropTypes.string.isRequired,
      title: PropTypes.node.isRequired,
    }).isRequired).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  renderSection(id, title, items, style) {
    const {onExplore, profile, userYou} = this.props
    const isMasculine = profile.gender === 'MASCULINE'
    const areAllItemsShownId = `areAllItemsShown-${id}`
    const areAllItemsShown = this.state[areAllItemsShownId]
    const itemStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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
      <div style={{marginBottom: 15}}>{title}</div>
      <AppearingList maxNumChildren={areAllItemsShown ? 0 : 4}>
        {items.map((tip, index) => <div
          key={`tip-${id}-${index}`} style={{marginTop: index ? -1 : 0, ...itemStyle}}>
          <Markdown content={isMasculine && tip.contentMasculine || tip.content} />
          {isSpecificToJob(tip) ?
            this.renderTag(
              userYou('Pour ton métier', 'Pour votre métier'),
              colors.GREENISH_TEAL,
            ) : null
          }
        </div>)}
      </AppearingList>
      {(areAllItemsShown || items.length <= 4) ? null : <div
        key={`${id}-more`} style={showMoreStyle}
        onClick={() => {
          this.setState({[areAllItemsShownId]: true})
          onExplore(`more tips ${id}`)
        }}>
        <span>
          Voir plus
        </span>
        <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
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
      backgroundColor: isTarget ? colors.SLATE : colors.HOVER_GREEN,
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
        color: colors.HOVER_GREEN,
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
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      cursor: (isNotClickable || props.isNotClickable) ? 'initial' : 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      marginTop: index ? -1 : 0,
      minHeight: 50,
      paddingLeft: isMobileVersion ? 10 : 20,
      paddingRight: isMobileVersion ? 10 : 20,
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
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  handleClick = () => {
    const {job, onClick} = this.props
    window.open(`https://www.google.fr/search?q=${encodeURIComponent(job.name)}`, '_blank')
    onClick && onClick()
  }

  renderCaption(style) {
    const captionStyle = {
      fontStyle: 'normal',
      marginRight: 10,
    }
    return <div style={style}>
      <span style={captionStyle}>
        Offres par candidat par rapport à votre métier&nbsp;:
      </span>
    </div>
  }

  renderJob(style) {
    const {job} = this.props
    const multiplierStyle = {
      color: colors.HOVER_GREEN,
      flex: 1,
      fontWeight: 'bold',
      marginRight: 0,
    }
    const jobNameStyle = {
      flex: isMobileVersion ? 4 : 1,
      fontWeight: 'bold',
      marginRight: isMobileVersion ? 10 : 'initial',
    }
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
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
          {isMobileVersion ? null : <div>Découvrir ce métier</div>}
          <ChevronRightIcon style={chevronStyle} />
        </span>
      </div>
    </div>
  }

  render() {
    const {isCaption, style} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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
    onContentShown: PropTypes.func,
    style: PropTypes.object,
    title: PropTypes.string,
  }

  state = {
    isContentShown: false,
  }

  handleClick = () => {
    const {isContentShown} = this.state
    const {onContentShown} = this.props
    this.setState({isContentShown: !isContentShown})
    if (!isContentShown) {
      onContentShown && onContentShown()
    }
  }

  render() {
    const {aggregatorName, associationName, description, isAvailableEverywhere,
      link, style, title} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      color: colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
    }
    const contentStyle = {
      borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
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
      backgroundColor: colors.GREENISH_TEAL,
      marginLeft: 15,
    }
    const chevronStyle = {
      flexShrink: 0,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={this.handleClick}>
        <strong>
          {associationName}
        </strong>
        {isAvailableEverywhere && !isMobileVersion ? <Tag style={tagStyle}>
          depuis chez vous
        </Tag> : null}
        <span style={{flex: 1}} />
        <span>
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
        Lire la suite sur <ExternalLink href={link}>{aggregatorName}</ExternalLink>
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
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 25px',
      ...style,
    }
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    return <div style={containerStyle} {...extraProps}>
      <strong>
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
      color: colors.COOL_GREY,
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


class StaticAdviceCardContent extends React.Component {
  static propTypes = {
    expandedCardHeader: PropTypes.string,
    expandedCardItems: PropTypes.arrayOf(PropTypes.string.isRequired),
  }

  render() {
    const {expandedCardHeader, expandedCardItems} = this.props
    return <div>
      <Markdown content={expandedCardHeader} />
      <AdviceSuggestionList isNotClickable={true}>
        {(expandedCardItems || []).map((content, index) => <div
          key={`item-${index}`} style={{fontWeight: 'normal'}}>
          <Markdown content={content} />
        </div>)}
      </AdviceSuggestionList>
    </div>
  }
}


class SkillAsset extends React.Component {
  static propTypes = {
    asset: PropTypes.string.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {asset, style, userYou} = this.props
    const {description, icon, name} = assetProps[asset] || {}
    if (!name) {
      return null
    }
    const assetStyle = {
      alignItems: 'center',
      borderBottom: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      marginTop: 10,
      paddingBottom: 10,
      ...style,
    }
    const imageStyle = {
      height: 48,
      marginRight: '1em',
      width: 48,
    }
    const nameStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: '.8em',
      fontWeight: 'bold',
      marginBottom: 3,
      textTransform: 'uppercase',
    }
    return <div style={assetStyle}>
      <img src={icon} style={imageStyle} alt="" />
      <div style={{flex: 1}}>
        <div style={nameStyle}>{name}</div>
        <div>{description(userYou)}</div>
      </div>
    </div>
  }
}


class Skill extends React.Component {
  static propTypes = {
    assets: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    description: PropTypes.string.isRequired,
    discoverUrl: PropTypes.string,
    isRecommended: PropTypes.bool,
    name: PropTypes.string.isRequired,
    onExplore: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  renderTag() {
    if (!this.props.isRecommended) {
      return null
    }
    return <Tag style={{backgroundColor: colors.GREENISH_TEAL, marginLeft: 10}}>
      Recommandée
    </Tag>
  }

  render() {
    const {assets, description, discoverUrl, name, onExplore, style, userYou} = this.props
    const descriptionStyle = {
      borderLeft: `solid 3px ${colors.SILVER}`,
      fontSize: 'larger',
      fontWeight: 'bold',
      maxWidth: 600,
      padding: 15,
    }
    return <ExpandableAction
      onContentShown={() => onExplore('see-skill')} {...{style, userYou}} title={<span
        style={{alignItems: 'center', display: 'flex'}}>
        {name} {this.renderTag()}
      </span>}>
      <div style={{fontSize: '.875em', paddingBottom: 20}}>
        <div style={descriptionStyle}>
          {description}
        </div>
        {assets && assets.length ? <div style={{fontSize: '.93em', marginTop: 25}}>
          {assets.length === 1 ? "L'atout" : 'Les atouts'} de cette compétence&nbsp;:
          {assets.map((asset, index) => <SkillAsset
            key={`${name}-${asset}`}{...{asset, userYou}}
            style={index === assets.length - 1 && !discoverUrl ? {borderBottom: 0} : null} />)}
        </div> : null}
        {discoverUrl ? <div style={{marginTop: 20, textAlign: 'center'}}>
          <ExternalLink href={discoverUrl} onClick={() => onExplore('link-skill')}>
            <Button>Découvrir cette compétence</Button>
          </ExternalLink>
        </div> : null}
      </div>
    </ExpandableAction>
  }
}


export {ToolCard, EmailTemplate, ImproveApplicationTips, AdviceSuggestionList, Skill,
  StaticAdviceCardContent, Tip, PercentageBoxes, connectExpandedCardWithContent, JobSuggestion,
  ExpandableAction, Mission, MoreMissionsLink, DataSource}
