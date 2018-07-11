import _forEach from 'lodash/forEach'
import _mapValues from 'lodash/mapValues'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import {Scrollbars} from 'react-custom-scrollbars'
import {connect} from 'react-redux'
import {Link, Redirect} from 'react-router-dom'
import setPropType from 'es6-set-proptypes'

import {advicePageIsShown, unlockAdvice, workbenchIsShown} from 'store/actions'
import {getAdviceShortTitle, getAdviceTitle, getTopicUrl,
  getTopicFromUrl} from 'store/advice'
import {getAdviceModules, upperFirstLetter} from 'store/french'
import {getLockedAdvices} from 'store/points'
import {colorFromPercent, computeBobScore} from 'store/score'
import {youForUser} from 'store/user'

import {AdviceCard, AdvicePicto} from 'components/advisor'
import categories from 'components/advisor/data/categories.json'
import {isMobileVersion} from 'components/mobile'
import {NAVIGATION_BAR_HEIGHT, PageWithNavigationBar} from 'components/navigation'
import {PointsCounter, UnlockablePointsContainer} from 'components/points'
import {RocketChain} from 'components/rocket_chain'
import {ShareModal} from 'components/share'
import {Button, PercentBar, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'

import {DisableableLink} from './disableable_link'
import {FeedbackBar} from './feedback_bar'

const categoriesAdviceSets = _mapValues(categories, adviceIds => new Set(adviceIds))
const topicPerAdvice = {}
_forEach(categories, (adviceIds, topic) => adviceIds.forEach(adviceId => {
  // If an advice ends up in several topics, we take any of them.
  topicPerAdvice[adviceId] = topic
}))


// TODO(pascal): Merge back with the WorkbenchWithAdvice below.
class WorkbenchBase extends React.Component {
  static getAddedAdvice(adviceId, advices, isForced, showAdvicePredicate) {
    if (!adviceId) {
      return null
    }
    const matchedAdvice = advices.find(a => a.adviceId.startsWith(adviceId))
    if (matchedAdvice && showAdvicePredicate(matchedAdvice)) {
      return null
    }
    if (matchedAdvice) {
      return matchedAdvice
    }
    if (isForced) {
      return {adviceId, numStars: 3, score: 10}
    }
    return null
  }

  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    isForcedAllowed: PropTypes.bool,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    lockedAdvices: setPropType.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        adviceId: PropTypes.string,
        topicOrAdvice: PropTypes.string,
      }).isRequired,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.arrayOf(PropTypes.shape({
        adviceId: PropTypes.string.isRequired,
        score: PropTypes.number,
      }).isRequired),
    }).isRequired,
  }

  state = {
    advices: this.props.project.advices || [],
  }

  static getDerivedStateFromProps(nextProps) {
    const {
      isForcedAllowed,
      location: {search},
      match: {params: {adviceId, topicOrAdvice}},
      project: {advices = []},
    } = nextProps
    const {forced} = parse(search.substr(1))
    const adviceIdsSet = categoriesAdviceSets[getTopicFromUrl(topicOrAdvice)]
    const showAdvicePredicate = adviceIdsSet ?
      // If a category is set, show all advices from that category.
      ({adviceId}) => adviceIdsSet.has(adviceId) :
      // Otherwise show all of them (render will probably redirect anyways).
      () => true
    const addedAdvice = WorkbenchBase.getAddedAdvice(
      adviceId, advices, isForcedAllowed && forced, showAdvicePredicate)

    return {
      advices: advices.filter(showAdvicePredicate).concat(addedAdvice ? [addedAdvice] : []),
    }
  }

  render() {
    const {
      baseUrl,
      location: {hash, search},
      lockedAdvices,
      match: {params: {adviceId, topicOrAdvice}},
    } = this.props

    // If there's no adviceId and topicOrAdvice is an advice, redirect to get a topic as well.
    if (!adviceId) {
      const topic = topicPerAdvice[topicOrAdvice]
      if (topic) {
        const topicUrl = getTopicUrl(topic)
        if (!topicUrl) {
          // TODO(pascal): Log an error to Sentry.
          return <Redirect to={`${baseUrl}${search}${hash}`} />
        }
        return <Redirect to={`${baseUrl}/${topicUrl}/${topicOrAdvice}${search}${hash}`} />
      }
    }

    const {advices = []} = this.state
    const unlockedAdvices = advices.filter(adviceId => !lockedAdvices.has(adviceId))
    const getAdviceUrl = ({adviceId}) => `${baseUrl}/${topicOrAdvice}/${adviceId}${search}${hash}`
    const selectedAdviceIndex = adviceId ? advices.findIndex(a => a.adviceId === adviceId) : -1
    const selectedAdvice = advices[selectedAdviceIndex]
    const topic = getTopicFromUrl(topicOrAdvice)

    if (!selectedAdvice) {
      if (unlockedAdvices.length) {
        // Select the first advice that is shown.
        return <Redirect to={getAdviceUrl(unlockedAdvices[0])} />
      }
      if (advices.length) {
        // All the pieces of advice are locked.
        return <Redirect to={Routes.PROJECT_PAGE} />
      }
      // We're lost, go back to root.
      return <Redirect to={Routes.ROOT + search + hash} />
    }

    // TODO(marielaure): Find a better way to handle mobile navigation when trying to access
    // a locked advice using chevrons.
    if (lockedAdvices.has(selectedAdvice.adviceId)) {
      // The selected advice is locked.
      return <Redirect to={Routes.PROJECT_PAGE} />
    }

    const previousAdviceUrl = selectedAdviceIndex > 0 ?
      getAdviceUrl(advices[selectedAdviceIndex - 1]) : ''

    const nextAdviceUrl = selectedAdviceIndex < advices.length - 1 ?
      getAdviceUrl(advices[selectedAdviceIndex + 1]) : ''

    return <WorkbenchWithAdvice
      {...this.props} advice={selectedAdvice}
      {...{advices, getAdviceUrl, lockedAdvices, nextAdviceUrl, previousAdviceUrl, topic}} />
  }
}
const Workbench = connect(({user}, {project: {advices = []}}) => ({
  isForcedAllowed: user.featuresEnabled && user.featuresEnabled.alpha || {},
  lockedAdvices: getLockedAdvices(user, advices),
}))(WorkbenchBase)


const menuWidth = 300
const contentStyle = {
  marginLeft: menuWidth + 50,
  marginRight: 50,
}


class WorkbenchWithAdviceBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      score: PropTypes.number,
    }).isRequired,
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    dispatch: PropTypes.func.isRequired,
    evaluationUrl: PropTypes.string.isRequired,
    getAdviceUrl: PropTypes.func.isRequired,
    lockedAdvices: setPropType.isRequired,
    nextAdviceUrl: PropTypes.string,
    previousAdviceUrl: PropTypes.string,
    profile: PropTypes.object.isRequired,
    project: PropTypes.shape({
      feedback: PropTypes.shape({
        score: PropTypes.number,
      }),
    }).isRequired,
    topicScore: PropTypes.shape({
      isDefined: PropTypes.bool.isRequired,
      percent: PropTypes.number.isRequired,
      title: PropTypes.func.isRequired,
    }).isRequired,
    urlOnClose: PropTypes.string.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    adviceId: this.props.advice.adviceId,
    hoveredAdvice: null,
    isShareBobShown: false,
    score: this.props.project.feedback && this.props.project.feedback.score || 0,
  }

  static getDerivedStateFromProps({advice: {adviceId}, project}, prevState) {
    const {feedback: {score = 0} = {}} = project
    if (score === prevState.score && adviceId === prevState.adviceId) {
      return null
    }
    const newState = {
      adviceId,
      score,
    }
    if (score !== prevState.score && score >= 4) {
      newState.isShareBobShown = true
    }
    return newState
  }

  componentDidMount() {
    const {advice, dispatch, project} = this.props
    dispatch(workbenchIsShown(project))
    dispatch(advicePageIsShown(project, advice))
  }

  componentDidUpdate(prevProps) {
    const {advice, dispatch, project} = this.props
    if (advice.adviceId === prevProps.advice.adviceId) {
      return
    }

    if (this.pageDom) {
      this.pageDom.scroll({behavior: 'smooth', top: 0})
    }

    // Opening a new advice page.
    dispatch(advicePageIsShown(project, advice))
  }

  getAdviceGoal = adviceId =>
    upperFirstLetter((getAdviceModules(this.props.userYou)[adviceId] || {}).goal)

  renderUnreadBullet(style, isSelected, isRead) {
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
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
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 10,
      boxShadow: '1px 5px 4px 0 rgba(0, 0, 0, 0.2)',
      height: 9,
      width: 9,
    }
    return <div style={containerStyle}>
      <span style={bulletStyle} />
    </div>
  }

  renderNumberUnreadBubble(style) {
    const {project: {advices = []}} = this.props
    const numUnread = advices.filter(({score, status}) => score && status !== 'ADVICE_READ').length
    if (!numUnread) {
      return null
    }
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 21,
      color: '#fff',
      display: 'flex',
      fontSize: 14,
      fontWeight: 'bold',
      height: 21,
      justifyContent: 'center',
      width: 21,
      ...style,
    }
    return <div style={containerStyle}>
      {numUnread}
    </div>
  }

  renderCardList(adviceCards, areRead) {
    if (!adviceCards.length) {
      return null
    }
    const {getAdviceUrl, lockedAdvices} = this.props
    const maybeS = cards => cards.length > 1 ? 's' : ''
    const isLocked = advice => lockedAdvices.has(advice.adviceId)
    const titleStyle = {
      padding: '10px 0',
    }
    const adviceLinkStyle = advice => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 5,
      color: isLocked(advice) ? colors.COOL_GREY : colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      flexShrink: 0,
      marginBottom: 15,
      padding: '15px 8px 15px 15px',
      position: 'relative',
      textDecoration: 'none',
    })
    const pictoStyle = {
      height: 34,
      maxWidth: 34,
    }
    const unreadBulletStyle = {
      backgroundColor: '#fff',
      bottom: 0,
      position: 'absolute',
      right: 0,
    }

    return <React.Fragment>
      <div style={titleStyle}>
        {areRead ? <div style={titleStyle}>
          Autre{maybeS(adviceCards)} conseil{maybeS(adviceCards)}
        </div> : <React.Fragment>Conseil{maybeS(adviceCards)} non consulté{maybeS(adviceCards)}
          <span style={{display: 'inline-block', marginLeft: 6}}>
            {this.renderNumberUnreadBubble()}
          </span>
        </React.Fragment>}
      </div>
      {adviceCards.map((advice) => <UnlockablePointsContainer
        count={100} goal="déverrouiller ce conseil" isLocked={isLocked(advice)}
        key={`nav-bottom-advice-${advice.adviceId}`}
        unlockAction={unlockAdvice(advice.adviceId)}>
        <DisableableLink
          to={isLocked(advice) ? null : getAdviceUrl(advice)}
          style={adviceLinkStyle(advice)}>
          <span style={{marginRight: 10, position: 'relative'}}>
            <AdvicePicto adviceId={advice.adviceId} style={pictoStyle} />
            {areRead ? null : this.renderUnreadBullet(unreadBulletStyle)}
          </span>
          <div style={Styles.CENTER_FONT_VERTICALLY}>{this.getAdviceGoal(advice.adviceId)}</div>
          <div style={{flex: 1}} />
          {isLocked(advice) ?
            <PointsCounter
              backgroundColor={colors.NEW_GREY} count={100}
              style={{color: colors.CHARCOAL_GREY, marginLeft: 15}} /> : <ChevronRightIcon />}
        </DisableableLink>
      </UnlockablePointsContainer>)}
    </React.Fragment>
  }

  renderOtherAdviceCards() {
    const {advice: selectedAdvice, advices} = this.props
    const isRead = advice => advice.status === 'ADVICE_READ'
    const containerStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      color: colors.DARK,
      fontSize: 14,
      fontWeight: 'bold',
      padding: 15,
    }
    const otherAdviceCards = advices.filter(advice =>
      !(advice && selectedAdvice && advice.adviceId === selectedAdvice.adviceId))
    if (!otherAdviceCards) {
      return null
    }
    const readCards = otherAdviceCards.filter(isRead)
    const unreadCards = otherAdviceCards.filter(advice => !isRead(advice))

    return <nav style={containerStyle}>
      {this.renderCardList(unreadCards)}
      {this.renderCardList(readCards, true)}
    </nav>
  }

  renderNavBar(style) {
    const {advice: selectedAdvice, advices, getAdviceUrl, lockedAdvices, userYou} = this.props
    const {hoveredAdvice, isShareBobShown} = this.state
    const isHovered = advice =>
      !!(advice && hoveredAdvice && advice.adviceId === hoveredAdvice.adviceId)
    const isSelected = advice =>
      !!(advice && selectedAdvice && advice.adviceId === selectedAdvice.adviceId)
    const isRead = advice => advice.status === 'ADVICE_READ'
    const isLocked = advice => lockedAdvices.has(advice.adviceId)
    // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
    const containerStyle = {
      fontFamily: 'GTWalsheim',
      fontSize: 16,
      fontWeight: 'bold',
      paddingTop: 26,
      width: 300,
      ...(style || {}),
    }
    const adviceCardStyle = (advice) => ({
      alignItems: 'center',
      backgroundColor: (isHovered(advice) || isSelected(advice)) ?
        colors.BACKGROUND_GREY : 'transparent',
      borderRadius: 5,
      color: isLocked(advice) ? colors.COOL_GREY : colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      flexShrink: 0,
      fontSize: 14,
      fontWeight: isSelected(advice) ? 'bold' : 'initial',
      margin: '0 10px 10px',
      padding: 15,
      position: 'relative',
      textDecoration: 'none',
      transition: `${SmoothTransitions.transition}, font-weight 0s`,
    })
    const pictoStyle = isSelected => ({
      borderRadius: 17,
      boxShadow: isSelected ? 'initial' : '0 3px 5px 0 rgba(0, 0, 0, 0.2)',
      height: 34,
      maxWidth: 34,
    })
    const unreadBulletStyle = advice => ({
      backgroundColor: isHovered(advice) ? colors.BACKGROUND_GREY : '#fff',
      bottom: 0,
      position: 'absolute',
      right: 0,
    })
    return <div style={containerStyle}>
      {advices.map((advice) =>
        <UnlockablePointsContainer
          key={`nav-advice-${advice.adviceId}`}
          count={100} goal="déverrouiller ce conseil" isLocked={isLocked(advice)}
          unlockAction={unlockAdvice(advice.adviceId)}>
          <DisableableLink
            to={isLocked(advice) ? null : getAdviceUrl(advice)}
            onMouseEnter={() => this.setState({hoveredAdvice: advice})}
            onMouseLeave={(advice === hoveredAdvice) ?
              () => this.setState({hoveredAdvice: null}) : null}
            style={adviceCardStyle(advice)}>
            <span style={{marginRight: 10, position: 'relative'}}>
              <AdvicePicto adviceId={advice.adviceId} style={pictoStyle(isSelected(advice))} />
              {this.renderUnreadBullet(
                unreadBulletStyle(advice), isSelected(advice), isRead(advice))}
            </span>
            <div style={Styles.CENTER_FONT_VERTICALLY}>{this.getAdviceGoal(advice.adviceId)}</div>
            <div style={{flex: 1}} />
            {isLocked(advice) ?
              <PointsCounter
                backgroundColor={colors.NEW_GREY} count={100}
                style={{color: colors.CHARCOAL_GREY, marginLeft: 20}} /> : null}
          </DisableableLink>
        </UnlockablePointsContainer>)}
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

  renderAdvice() {
    const {advice, evaluationUrl, nextAdviceUrl, previousAdviceUrl, profile,
      project, userYou} = this.props
    const {numStars} = advice
    const rocketsWidth = 130
    // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
    const adviceTitleStyle = {
      borderBottom: isMobileVersion ? 'none' : `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.DARK,
      fontFamily: 'GTWalsheim',
      fontSize: isMobileVersion ? 20 : 24,
      fontWeight: 900,
      padding: isMobileVersion ? '35px 20px' : `35px ${rocketsWidth}px 35px 0`,
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'left',
    }
    const rocketsDivStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      borderRadius: isMobileVersion ? 5 : '5px 5px 0 0',
      bottom: -1,
      display: 'flex',
      justifyContent: 'center',
      margin: `${isMobileVersion ? '15px' : 0} auto 0`,
      padding: '11px 15px',
      position: isMobileVersion ? 'static' : 'absolute',
      right: 0,
      width: rocketsWidth,
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
    const containerFeedbackStyle = {
      bottom: 10,
      left: 0,
      pointerEvents: 'none',
      position: 'fixed',
      right: 0,
      zIndex: 1,
    }
    // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
    const feedbackStyle = {
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 5,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      fontFamily: 'GTWalsheim',
      margin: 'auto',
      padding: '10px 10px 5px',
      pointerEvents: 'initial',
      width: 310,
    }

    return <React.Fragment>
      <div style={adviceTitleStyle}>
        {getAdviceTitle(advice, userYou)}
        <div style={rocketsDivStyle}>
          <RocketChain areEmptyRocketsShown={true} numStars={numStars} rocketHeight={18} />
        </div>
        {isMobileVersion && previousAdviceUrl ?
          <Link style={previousAdviceStyle} to={previousAdviceUrl}>
            <ChevronLeftIcon style={{fill: colors.COOL_GREY}} />
          </Link> : null}
        {isMobileVersion && nextAdviceUrl ?
          <Link style={nextAdviceStyle} to={nextAdviceUrl}>
            <ChevronRightIcon style={{fill: colors.COOL_GREY}} />
          </Link> : null}
      </div>
      {/* TODO(marielaure): Propagate font family to children that still needs GTWalsheim. */}
      <div style={{fontFamily: 'GTWalsheim', padding: isMobileVersion ? 20 : '0 0 120px'}}>
        <AdviceCard
          {...{advice, profile, project}}
          isTitleShown={false}
          style={{border: 0, margin: `${isMobileVersion ? 0 : '40px'} 0`}}
        />
      </div>
      {isMobileVersion ? null : <div style={containerFeedbackStyle}>
        <FeedbackBar
          project={project} style={feedbackStyle} evaluationUrl={evaluationUrl} />
      </div>}
    </React.Fragment>
  }

  renderBreadCrumbs(style) {
    const {topicScore: {isDefined, percent, title}, urlOnClose, userYou} = this.props
    // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
    const containerStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 2px 5px 0 rgba(0, 0, 0, 0.1)',
      fontFamily: 'GTWalsheim',
      padding: 8,
      position: 'relative',
      ...style,
    }
    const backButtonStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      boxShadow: 'initial',
      color: colors.DARK_TWO,
      fontSize: 14,
      fontWeight: 'bold',
      left: 8,
      padding: '8px 15px',
      position: 'absolute',
      top: 8,
    }
    const chevronStyle = {
      fill: colors.DARK_TWO,
      margin: '-6px 5px -6px -8px',
      verticalAlign: 'middle',
    }
    const breadCrumbContentStyle = {
      ...contentStyle,
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      fontSize: 15,
      fontWeight: 600,
      height: '100%',
    }
    const color = colorFromPercent(percent)
    return <div style={containerStyle}>
      <Link to={urlOnClose}>
        <Button type="discreet" style={backButtonStyle}>
          <ChevronLeftIcon style={chevronStyle} />
          Retour à l'évaluation
        </Button>
      </Link>
      {isDefined ? <div style={breadCrumbContentStyle}>
        {title(userYou)}
        <span style={{flex: 2}} />
        <PercentBar
          style={{flex: 1, height: 10, marginBottom: 0}} percent={percent}
          color={color} isPercentShown={false} />
        <span style={{color, fontSize: 14, fontWeight: 900, marginLeft: 15}}>
          {Math.round(percent)}%
        </span>
      </div> : null}
    </div>
  }

  renderPageContent(style) {
    if (isMobileVersion) {
      return <div style={{backgroundColor: '#fff', position: 'relative', ...style}}>
        {this.renderAdvice()}
        {this.renderOtherAdviceCards()}
      </div>
    }
    const menuStyle = {
      display: 'flex',
      flexDirection: 'column',
      width: menuWidth,
    }
    const menuContainerStyle = {
      bottom: 0,
      display: 'flex',
      left: 0,
      position: 'fixed',
      top: NAVIGATION_BAR_HEIGHT + 50,
      width: menuWidth,
      zIndex: 1,
    }
    return <div style={{backgroundColor: '#fff', flexShrink: 0, ...style}}>
      {this.renderBreadCrumbs({height: 50})}
      <div style={menuContainerStyle}>
        <Scrollbars
          style={menuStyle} autoHide={true}
          renderView={({style, ...props}) => <div
            style={{...style, display: 'flex', flex: 1}} {...props} />}>
          {this.renderNavBar({flex: 1})}
        </Scrollbars>
      </div>
      <div style={contentStyle}>
        {this.renderAdvice()}
      </div>
    </div>
  }

  render() {
    const {advice, urlOnClose, userYou} = this.props

    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }

    return <PageWithNavigationBar
      page="workbench"
      navBarContent={getAdviceShortTitle(advice, userYou)}
      onBackClick={urlOnClose}
      isContentScrollable={true}
      ref={dom => this.pageDom = dom} isChatButtonShown={true} style={pageStyle}>
      {this.renderPageContent({style: 1})}
    </PageWithNavigationBar>
  }
}
const WorkbenchWithAdvice = connect(({user}, {project, topic}) => ({
  profile: user.profile,
  topicScore: computeBobScore(project.diagnostic).components.
    find(({topic: componentTopic}) => topic === componentTopic),
  userYou: youForUser(user),
}))(WorkbenchWithAdviceBase)


export {Workbench}
