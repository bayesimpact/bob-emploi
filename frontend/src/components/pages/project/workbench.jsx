import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Link, Redirect} from 'react-router-dom'

import rocketIcon from 'images/rocket.svg'

import {advicePageIsShown} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {youForUser} from 'store/user'

import {AdviceCard, AdvicePicto} from 'components/advisor'
import {ShareModal} from 'components/share'
import {Colors, OutsideClickHandler, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'

import {FeedbackBar} from './feedback_bar'


// TODO(pascal): Merge back with the WorkbenchWithAdvice below.
class Workbench extends React.Component {
  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        adviceId: PropTypes.string,
      }).isRequired,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.arrayOf(PropTypes.shape({
        adviceId: PropTypes.string.isRequired,
        score: PropTypes.number,
      }).isRequired),
    }).isRequired,
  }

  render() {
    const {
      baseUrl,
      location: {hash, search},
      match: {params: {adviceId}},
      project: {advices},
    } = this.props
    const selectedAdviceIndex = adviceId ?
      (advices || []).findIndex(a => a.adviceId === adviceId) : -1

    if (selectedAdviceIndex < 0) {
      // Select the first advice that is scored.
      const firstAdvice = (advices || []).find(({score}) => score)
      if (firstAdvice) {
        return <Redirect to={`${baseUrl}/${firstAdvice.adviceId}${search}${hash}`} />
      }

      // We're lost, go back to root.
      return <Redirect to={Routes.ROOT + search + hash} />
    }

    const selectedAdvice = advices[selectedAdviceIndex]

    const previousAdvices =
      advices.filter(({score}, index) => score && index < selectedAdviceIndex)
    const previousAdviceUrl = previousAdvices.length ?
      `${baseUrl}/${previousAdvices[previousAdvices.length - 1].adviceId}` : ''

    const nextAdviceIndex =
      advices.findIndex(({score}, index) => score && index > selectedAdviceIndex)
    const nextAdviceUrl = nextAdviceIndex >= 0 ?
      `${baseUrl}/${advices[nextAdviceIndex].adviceId}` : ''

    return <WorkbenchWithAdvice
      {...this.props} advice={selectedAdvice}
      nextAdviceUrl={nextAdviceUrl} previousAdviceUrl={previousAdviceUrl} />
  }
}


class WorkbenchWithAdviceBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      score: PropTypes.number,
    }).isRequired,
    baseUrl: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    nextAdviceUrl: PropTypes.string,
    previousAdviceUrl: PropTypes.string,
    profile: PropTypes.object.isRequired,
    project: PropTypes.shape({
      advices: PropTypes.arrayOf(PropTypes.shape({
        adviceId: PropTypes.string.isRequired,
      }).isRequired).isRequired,
      feedback: PropTypes.shape({
        score: PropTypes.number,
      }),
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  state = {
    hoveredAdvice: null,
    isMenuShown: !this.context.isMobileVersion && this.props.advice.score,
    isShareBobShown: false,
  }

  componentWillMount() {
    const {advice, dispatch, project} = this.props
    dispatch(advicePageIsShown(project, advice))
  }

  componentWillReceiveProps(nextProps) {
    const {advice, dispatch, project} = nextProps
    const {feedback: {score = 0} = {}} = project
    if (score >= 4 && !this.props.project.feedback) {
      this.setState({isShareBobShown: true})
    }
    if (advice.adviceId === this.props.advice.adviceId) {
      return
    }
    dispatch(advicePageIsShown(project, advice))
  }

  handleMenuClick = advice => () => {
    const {history, isMobileVersion} = this.context
    this.setState({
      isMenuShown: !isMobileVersion,
    })
    history.push(`${this.props.baseUrl}/${advice.adviceId}`)
  }

  renderUnreadBullet(style, isSelected, isRead) {
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: isSelected ? Colors.DODGER_BLUE : Colors.BOB_BLUE,
      borderRadius: 20,
      display: 'flex',
      height: 17,
      justifyContent: 'center',
      opacity: isRead ? 0 : 1,
      width: 17,
      ...SmoothTransitions,
      ...style,
    }
    const bulletStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      borderRadius: 10,
      boxShadow: '1px 5px 4px 0 rgba(0, 0, 0, 0.2)',
      height: 9,
      width: 9,
    }
    return <div style={containerStyle}>
      <span style={bulletStyle} />
    </div>
  }

  // TODO(marielaure): When opening the menu go to the top so that firs advice are visible.
  renderMenuIcon(style) {
    const {isMobileVersion} = this.context
    const menuIconContainerStyle = {
      alignItems: 'center',
      backgroundColor: isMobileVersion ? Colors.BOB_BLUE : 'inherit',
      borderRadius: 100,
      bottom: 10,
      boxShadow: isMobileVersion ? '0 2px 4px 0 rgba(0, 0, 0, 0.5)' : 'initial',
      display: 'flex',
      flexShrink: 0,
      height: isMobileVersion ? 48 : 'inherit',
      justifyContent: 'center',
      left: 10,
      position: 'fixed',
      width: isMobileVersion ? 48 : 'inherit',
      ...(style || {}),
    }
    const menuIconStyle = {
      cursor: 'pointer',
      fill: isMobileVersion ? '#fff' : Colors.SILVER,
    }

    return <div style={menuIconContainerStyle}>
      <MenuIcon style={menuIconStyle} onClick={this.switchShowSelection} />
    </div>
  }

  renderNavBar(style) {
    const {advice: selectedAdvice, project, userYou} = this.props
    const {hoveredAdvice, isMenuShown, isShareBobShown} = this.state
    const {isMobileVersion} = this.context
    const advices = project.advices.filter(({score}) => score)
    const isHovered = advice =>
      !!(advice && hoveredAdvice && advice.adviceId === hoveredAdvice.adviceId)
    const isSelected = advice =>
      !!(advice && selectedAdvice && advice.adviceId === selectedAdvice.adviceId)
    const isRead = advice => advice.status === 'ADVICE_READ'
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'bold',
      overflow: 'visible',
      paddingTop: 26,
      width: isMobileVersion ? '90vw' : 300,
      ...(style || {}),
    }
    const adviceCardStyle = (advice) => ({
      alignItems: 'center',
      backgroundColor: isSelected(advice) ? Colors.DODGER_BLUE : 'transparent',
      boxShadow: isSelected(advice) ? '0 2px 4px 0 rgba(0, 0, 0, 0.1)' : 'none',
      color: (isHovered(advice) || isSelected(advice)) ? '#fff' : Colors.LIGHT_BLUE,
      cursor: 'pointer',
      display: 'flex',
      flexShrink: 0,
      fontSize: 14,
      marginBottom: 10,
      padding: '20px 10px',
      position: 'relative',
      ...SmoothTransitions,
    })
    const selectorContainerStyle = {
      alignItems: 'center',
      display: 'flex',
      height: '100%',
      position: 'absolute',
      right: 0,
      top: 0,
    }
    const selectorStyle = (isAdviceSelected) => ({
      // TODO(pascal): Make the arrow larger (as high as the div) by using ReactHeight.
      borderBottom: 'solid 13px transparent',
      borderLeft: `solid 13px ${Colors.DODGER_BLUE}`,
      borderTop: 'solid 13px transparent',
      height: 0,
      opacity: (isAdviceSelected && isMenuShown) ? 1 : 0,
      transform: 'translateX(13px)',
      ...SmoothTransitions,
    })
    const pictoStyle = {
      height: 34,
      maxWidth: 34,
    }
    const unreadBulletStyle = {
      bottom: 0,
      position: 'absolute',
      right: 0,
    }
    const feedbackStyle = {
      backgroundColor: 'inherit',
      borderTop: `1px solid ${Colors.SEA_BLUE}`,
      flexShrink: 0,
      padding: 10,
    }
    return <div style={containerStyle}>
      {advices.map((advice) => <div
        key={`nav-advice-${advice.adviceId}`}
        onClick={this.handleMenuClick(advice)}
        onMouseEnter={() => this.setState({hoveredAdvice: advice})}
        onMouseLeave={(advice === hoveredAdvice) ?
          () => this.setState({hoveredAdvice: null}) : null}
        style={adviceCardStyle(advice)}>
        <div style={selectorContainerStyle}>
          <div style={selectorStyle(isSelected(advice))} />
        </div>
        <span style={{marginRight: 10, position: 'relative'}}>
          <AdvicePicto adviceId={advice.adviceId} style={pictoStyle} />
          {this.renderUnreadBullet(unreadBulletStyle, isSelected(advice), isRead(advice))}
        </span>
        <div style={Styles.CENTER_FONT_VERTICALLY}>{getAdviceTitle(advice)}</div>
      </div>)}
      <div style={{flex: 1}} />
      <FeedbackBar project={project} style={feedbackStyle} />
      <ShareModal
        onClose={() => this.setState({isShareBobShown: false})} isShown={isShareBobShown}
        title={userYou('Toi aussi, aide tes amis', 'Vous aussi, aidez vos amis')}
        campaign="fs" visualElement="feedback"
        intro={<React.Fragment>
          <strong>{userYou('Envoie', 'Envoyez')}-leur directement ce lien <br /></strong>
          et on s'occupe du reste&nbsp;!
        </React.Fragment>} />
    </div>
  }

  switchShowSelection = () => {
    this.setState({isMenuShown: !this.state.isMenuShown})
  }

  renderAdvice() {
    const {advice, nextAdviceUrl, previousAdviceUrl, profile, project} = this.props
    const {isMobileVersion} = this.context
    const {numStars} = advice
    const sidePadding = isMobileVersion ? 10 : 30
    const adviceTitleStyle = {
      backgroundColor: '#fff',
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: isMobileVersion ? 20 : 26,
      fontWeight: 'bold',
      height: 132,
      justifyContent: 'center',
      padding: `0 ${sidePadding}px`,
      position: 'relative',
      textAlign: 'center',
    }
    const rocketsDivStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 2,
    }
    const pictoContainerStyle = {
      bottom: -30,
      left: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'right',
    }
    const pictoStyle = {
      borderRadius: 60,
      boxShadow: '0 12px 15px 0 rgba(0, 0, 0, 0.2)',
      height: 60,
      maxWidth: 60,
    }
    const nextAdviceStyle = {
      height: 24,
      position: 'absolute',
      right: 0,
      top: '50%',
      transform: 'translateY(-50%)',
    }
    const previousAdviceStyle = {
      height: 24,
      left: 0,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    }
    return <div style={{alignItems: 'center', flex: '1 0', flexDirection: 'column'}}>
      <div style={adviceTitleStyle}>
        <div style={{alignItems: 'center', display: 'flex'}}>
          {/* TODO(cyrille): Add hover style. */}
          {isMobileVersion ? null : this.renderMenuIcon()}
          <div style={{flex: 1, padding: '0 10px'}}>{getAdviceTitle(advice)}</div>
        </div>
        <div style={rocketsDivStyle}>{
          new Array(Math.floor(numStars)).fill(undefined).map((unused, index) =>
            <img
              src={rocketIcon}
              style={{height: 26}}
              key={`rocket-${index}`}
              alt={`${numStars} étoiles`}
            />
          )
        }</div>
        <div style={pictoContainerStyle}>
          <div style={{margin: 'auto', maxWidth: 960}}>
            <AdvicePicto adviceId={advice.adviceId} style={pictoStyle} />
          </div>
        </div>
        {isMobileVersion && previousAdviceUrl ?
          <Link style={previousAdviceStyle} to={previousAdviceUrl}>
            <ChevronLeftIcon fill={Colors.COOL_GREY} />
          </Link> : null}
        {isMobileVersion && nextAdviceUrl ?
          <Link style={nextAdviceStyle} to={nextAdviceUrl}>
            <ChevronRightIcon fill={Colors.COOL_GREY} />
          </Link> : null}
      </div>
      <div style={{padding: '10px'}}>
        <AdviceCard
          {...{advice, profile, project}}
          isTitleShown={false}
          style={{border: 0, margin: '40px auto', maxWidth: 960}}
        />
        <div style={{height: 48}}>
          {isMobileVersion ? this.renderMenuIcon() : null}
        </div>
      </div>
    </div>
  }

  render() {
    const {style} = this.props
    const {isMenuShown} = this.state
    const mobileMenuStyle = {
      backgroundColor: Colors.BOB_BLUE,
      height: '100%',
      left: 0,
      overflowX: 'hidden',
      position: 'absolute',
      top: 0,
      width: isMenuShown ? '90vw' : 0,
      zIndex: 1,
      ...SmoothTransitions,
    }
    if (this.context.isMobileVersion) {
      return <div style={{position: 'relative', ...style}}>
        <OutsideClickHandler
          onOutsideClick={() => this.setState({isMenuShown: false})} style={mobileMenuStyle}>
          {this.renderNavBar()}
        </OutsideClickHandler>
        {this.renderAdvice()}
      </div>
    }
    const menuStyle = {
      display: 'flex',
      flexDirection: 'column',
      transform: `translateX(${isMenuShown ? 0 : -300}px)`,
      width: 300,
      ...SmoothTransitions,
    }
    const menuContainerStyle = {
      backgroundColor: Colors.BOB_BLUE,
      boxShadow: isMenuShown ? '0 2px 4px 0 rgba(0, 0, 0, 0.5)' : 'none',
      display: 'flex',
      width: isMenuShown ? 300 : 0,
      zIndex: 1,
      ...SmoothTransitions,
    }
    return <div style={{display: 'flex', flexShrink: 0, ...style}}>
      <div style={menuContainerStyle}>
        <div style={menuStyle}>
          {this.renderNavBar({flex: 1})}
        </div>
      </div>
      <div style={{flex: 1}}>
        {this.renderAdvice()}
      </div>
    </div>
  }
}
const WorkbenchWithAdvice = connect(({user}) => ({
  profile: user.profile,
  userYou: youForUser(user),
}))(WorkbenchWithAdviceBase)


export {Workbench}
