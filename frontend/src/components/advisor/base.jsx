import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import VisibilitySensor from 'react-visibility-sensor'

import {adviceCardIsShown, seeAdvice} from 'store/actions'
import {PERSONALIZATION_IDS, filterPersonalizations,
        getPersonalizations} from 'store/personalizations'
import {USER_PROFILE_SHAPE} from 'store/user'

import {FeatureLikeDislikeButtons} from 'components/like'
import {Colors, Icon, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'

import adviceModuleProperties from './data/advice_modules.json'


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
    children: React.PropTypes.node,
    dispatch: React.PropTypes.func.isRequired,
    isInAdvicePage: React.PropTypes.bool,
    onShow: React.PropTypes.func,
    priority: React.PropTypes.number.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
    reasons: React.PropTypes.arrayOf(React.PropTypes.oneOf(PERSONALIZATION_IDS).isRequired),
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    hasBeenSeen: false,
    isHovered: false,
    reasons: [],
  }

  componentWillMount() {
    const {advice, dispatch, priority, project, reasons} = this.props
    dispatch(adviceCardIsShown(project, advice, priority))
    this.updateReasons(reasons)
  }

  componentWillReceiveProps(nextProps) {
    const {reasons} = nextProps
    if (reasons !== this.props.reasons) {
      this.updateReasons(reasons)
    }
  }

  updateReasons(reasons) {
    const {project, profile} = this.props
    this.setState({
      reasons: getPersonalizations(reasons, profile, project).
        map(({youToldUs}) => youToldUs),
    })
  }

  gotoAdvicePage = () => {
    const {advice, project} = this.props
    browserHistory.push(`${Routes.PROJECT_PAGE}/${project.projectId}/conseil/${advice.adviceId}`)
  }

  handleVisibilityChange = isVisible => {
    if (!isVisible) {
      return
    }
    const {advice, dispatch, onShow, priority, project} = this.props
    this.setState({hasBeenSeen: true})
    dispatch(seeAdvice(project, advice, priority))
    onShow && onShow()
  }

  renderTitle() {
    const {advice} = this.props
    const style = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 25,
      fontStyle: 'italic',
      fontWeight: 'bold',
      padding: '15px 0 0',
    }
    const {title} = adviceModuleProperties[advice.adviceId] || {}
    return <header style={style}>
      {title}
    </header>
  }

  renderTags() {
    const {reasons} = this.state
    const tagStyle = {
      backgroundColor: Colors.SOFT_BLUE,
      borderRadius: 100,
      color: '#fff',
      display: 'inline-block',
      fontSize: 13,
      margin: '4px 4px 0 0',
      padding: '2px 8px',
    }
    return <div style={{margin: '2px 0 17px'}}>
      {reasons.map((reason, index) => <span key={index} style={tagStyle}>
        <span style={Styles.CENTER_FONT_VERTICALLY}>{reason}</span>
      </span>)}
    </div>
  }

  renderButtonBar() {
    const {advice} = this.props
    const {callToAction} = adviceModuleProperties[advice.adviceId] || {}
    const {isHovered} = this.state
    const isAdviceUnread = advice.status === 'ADVICE_RECOMMENDED'
    const unreadStyle = {
      backgroundColor: 'rgba(0, 0, 0, .4)',
      borderRadius: 2,
      fontWeight: 500,
      marginRight: 20,
      padding: '2px 6px',
    }
    const tooltipStyle = {
      color: Colors.DARK,
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: 'normal',
      padding: 20,
      width: 200,
    }
    const buttonBarStyle = {
      alignItems: 'center',
      backgroundColor: isHovered ? Colors.LIGHT_NAVY_BLUE : Colors.WINDOWS_BLUE,
      borderRadius: 0,
      color: '#fff',
      display: 'flex',
      fontSize: 14,
      fontWeight: 'bold',
      height: 40,
      padding: '0 20px',
      ...SmoothTransitions,
    }
    const chevronStyle = {
      fontSize: 25,
    }
    return <div style={buttonBarStyle}>
      <span>
        {callToAction || "Accédez à l'outil"}
      </span>
      <span style={{flex: 1}} />
      {isAdviceUnread ? <span style={unreadStyle} className="tooltip">
        {/* TODO(pascal): Show this tooltip when scrolling if it was not shown yet. */}
        <div className="tooltiptext" style={tooltipStyle}>
          Cliquez sur sur la carte pour découvrir notre outil dédié à ce sujet.
        </div>
        <div style={Styles.CENTER_FONT_VERTICALLY}>Non vu</div>
      </span> : null}
      <Icon name="chevron-right" style={chevronStyle} />
    </div>
  }

  renderTitleAndTags(style) {
    return <div style={style}>
      {this.renderTitle()}
      {this.renderTags()}
    </div>
  }

  render() {
    const {children, isInAdvicePage, style} = this.props
    const {isHovered} = this.state
    const {isMobileVersion} = this.context
    const cardStyle = {
      backgroundColor: '#fff',
      boxShadow: isHovered && !isInAdvicePage ? '0 5px 25px 0 rgba(0, 0, 0, 0.1)' : 'initial',
      color: Colors.CHARCOAL_GREY,
      cursor: isInAdvicePage ? 'default' : 'pointer',
    }
    const contentStyle = {
      borderBottom: isMobileVersion ? `solid 1px ${Colors.BACKGROUND_GREY}` : 'initial',
      borderRight: isMobileVersion ? 'initial' : `solid 1px ${Colors.BACKGROUND_GREY}`,
      flex: 2,
      padding: '35px 40px',
    }
    const titleInCardStyle = {
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px 10px',
    }
    return <div style={style}>
      {isInAdvicePage ? null : this.renderTitleAndTags({})}
      <section
        style={cardStyle} onClick={this.gotoAdvicePage}
        onMouseEnter={() => this.setState({isHovered: true})}
        onMouseLeave={() => this.setState({isHovered: false})}>
        <div style={{flex: 1}}>
          {isInAdvicePage ? this.renderTitleAndTags(titleInCardStyle) : null}
          <VisibilitySensor
              active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={50}
              partialVisibility={true} onChange={this.handleVisibilityChange}>
            <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column' : 'row'}}>
              <div style={contentStyle}>
                {children}
              </div>
            </div>
          </VisibilitySensor>
        </div>
        {isInAdvicePage ? null : this.renderButtonBar()}
      </section>
    </div>
  }
}
const AdviceCard = connect(({user}) => ({gender: user.profile.gender}))(AdviceCardBase)


class GrowingNumber extends React.Component {
  static propTypes = {
    durationMillisec: React.PropTypes.number.isRequired,
    isSteady: React.PropTypes.bool,
    number: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
  }
  static defaultProps = {
    durationMillisec: 1000,
  }

  componentWillMount() {
    this.setState({growingForMillisec: 0, hasGrown: false, hasStartedGrowing: false})
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  startGrowing = isVisible => {
    if (!isVisible) {
      return
    }
    this.grow(0)
  }

  grow(growingForMillisec) {
    clearTimeout(this.timeout)
    if (growingForMillisec >= this.props.durationMillisec) {
      this.setState({hasGrown: true})
      return
    }
    this.setState({
      growingForMillisec,
      hasStartedGrowing: true,
    })
    this.timeout = setTimeout(() => this.grow(growingForMillisec + 50), 50)
  }

  render() {
    const {durationMillisec, isSteady, number, style} = this.props
    const {growingForMillisec, hasGrown, hasStartedGrowing} = this.state
    const maxNumDigits = Math.floor(Math.log10(number)) + 1
    const containerStyle = isSteady ? {
      display: 'inline-block',
      textAlign: 'right',
      // 0.625 was found empirically.
      width: `${maxNumDigits * 0.625}em`,
      ...style,
    } : style
    return <span style={containerStyle}>
      <VisibilitySensor
          active={!hasStartedGrowing} intervalDelay={250}
          onChange={this.startGrowing} />
      {hasGrown ? number :
        Math.round(growingForMillisec / durationMillisec * number)}
    </span>
  }
}


class PersonalizationBox extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    header: React.PropTypes.node,
    style: React.PropTypes.object,
  }

  render() {
    const {children, header, style} = this.props
    const containerStyle = {
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      maxWidth: 300,
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.SKY_BLUE,
      borderRadius: '4px 4px 0 0',
      color: '#fff',
      display: 'flex',
      fontStyle: 'italic',
      fontWeight: 500,
      padding: 15,
      position: 'relative',
    }
    const contentStyle = {
      backgroundColor: '#fff',
      borderRadius: '0 0 4px 4px',
      flex: 1,
      lineHeight: 1.7,
      padding: 20,
    }
    const notchContainerStyle = {
      left: 15,
      position: 'absolute',
      top: '100%',
      width: 29,
    }
    const notchStyle = {
      borderLeft: 'solid 5px transparent',
      borderRight: 'solid 5px transparent',
      borderTop: `solid 5px ${Colors.SKY_BLUE}`,
      margin: 'auto',
      width: 1,
    }
    return <div style={containerStyle}>
      <header style={headerStyle}>
        <img src={require('images/user-picto.svg')} style={{paddingRight: 15}} />
        {header}
        <div style={notchContainerStyle}>
          <div style={notchStyle} />
        </div>
      </header>
      <div style={contentStyle}>
        {children}
      </div>
    </div>
  }
}


// This component avoids that the element touches the border when on mobile.
// For now, we only use is for text, hence a solution that does not require a component would be,
// better, but we didn't find one yet.
class PaddedOnMobile extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const style = {
      padding: this.context.isMobileVersion ? '0 20px' : 0,
    }
    return <div style={style}>{this.props.children}</div>
  }
}


class PersonalizationBoxes extends React.Component {
  static propTypes = {
    maxNumberBoxes: React.PropTypes.number,
    personalizations: React.PropTypes.arrayOf(React.PropTypes.shape({
      filters: React.PropTypes.arrayOf(React.PropTypes.string.isRequired).isRequired,
      tip: React.PropTypes.oneOfType([React.PropTypes.node, React.PropTypes.func]).isRequired,
    }).isRequired).isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }
  static defaultProps = {
    maxNumberBoxes: 3,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {maxNumberBoxes, personalizations, profile, project, style} = this.props
    const {isMobileVersion} = this.context
    const personalizationCards = filterPersonalizations(personalizations, profile, project)
    if (maxNumberBoxes) {
      personalizationCards.splice(maxNumberBoxes)
    }

    if (!personalizationCards.length) {
      return null
    }

    const cardsContainerStyle = {
      alignItems: isMobileVersion ? 'center' : 'initial',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      flexWrap: isMobileVersion ? 'initial' : 'wrap',
    }

    const cardStyle = index => ({
      marginBottom: 30,
      marginRight: (isMobileVersion || index === personalizationCards.length -1) ? 'initial' : 25,
    })

    return <div style={style}>
      <PaddedOnMobile>Pour vous&nbsp;:</PaddedOnMobile>
      <div style={cardsContainerStyle}>
        {personalizationCards.map(({tip, title}, index) => <PersonalizationBox
            header={title} key={index} style={cardStyle(index)}>
          {typeof(tip) === 'function' ? tip(profile, project) : tip}
        </PersonalizationBox>)}
      </div>
    </div>
  }
}


class AdviceBox extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    feature: React.PropTypes.string.isRequired,
    header: React.PropTypes.node,
    style: React.PropTypes.object,
  }

  render() {
    const {children, feature, header, style} = this.props
    const containerStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      ...style,
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
      padding: '20px 35px',
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


export {AdviceCard, AdviceBox, PaddedOnMobile, PersonalizationBoxes, GrowingNumber}
