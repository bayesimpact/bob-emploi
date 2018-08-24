import _keyBy from 'lodash/keyBy'
import _partition from 'lodash/partition'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'
import setPropType from 'es6-set-proptypes'

import {unlockAdvice} from 'store/actions'
import {getAdviceModules, upperFirstLetter, lowerFirstLetter} from 'store/french'
import {BOB_SUB_METRICS, colorFromPercent, computeBobScore} from 'store/score'
import {USER_PROFILE_SHAPE} from 'store/user'


import {ExplorerAdviceCard} from 'components/advisor'
import {isMobileVersion} from 'components/mobile'
import {PointsCounter, UnlockablePointsContainer} from 'components/points'
import categories from 'components/advisor/data/categories.json'
import {Button, PercentBar, SmoothTransitions, Styles} from 'components/theme'

import {DisableableLink} from './disableable_link'


const THREE_STARS = 'three-stars'
const ADVICE_CARD_GROUP_PROPS = [
  {
    title: (userYou, count) =>
      `${count} conseil${count > 1 ? 's' : ''} à regarder en priorité`,
    topic: THREE_STARS,
  },
  ...BOB_SUB_METRICS.map(({title, ...others}) => ({
    title: userYou => `Pour ${lowerFirstLetter(title(userYou))}`,
    ...others,
  })),
]
const ADVICE_CARD_GROUP_PROPS_BY_TOPIC = _keyBy(ADVICE_CARD_GROUP_PROPS, ({topic}) => topic)


const HOVERABLE_COLOR_SHAPE = PropTypes.shape({
  ':hover': PropTypes.shape({
    color: PropTypes.string,
  }),
  color: PropTypes.string,
})

// A hoverable button containing only an MDI SVG icon.
// Move to theme if useful somewhere else.
class IconButton extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    icon: PropTypes.func.isRequired,
    iconStyle: HOVERABLE_COLOR_SHAPE,
    isShown: PropTypes.bool.isRequired,
    style: HOVERABLE_COLOR_SHAPE,
  }

  static defaultProps = {
    isShown: true,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {children, icon, iconStyle, isShown, style, ...extraProps} = this.props
    const {isHovered} = this.state
    const fill = isHovered ?
      iconStyle && iconStyle[':hover'] && iconStyle[':hover'].color : iconStyle && iconStyle.color
    const Icon = icon
    const containerStyle = {
      alignItems: 'center',
      cursor: isShown ? 'pointer' : 'default',
      display: 'flex',
      opacity: isShown ? (isHovered ? 1 : 0.8) : 0,
      ...style,
    }
    const chevronIconStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 45,
      boxShadow: '0 2px 3px 0 rgba(0, 0, 0, 0.2)',
      display: 'flex',
      height: 45,
      justifyContent: 'center',
      width: 45,
      ...iconStyle,
    }
    return <div style={containerStyle}
      onMouseEnter={() => this.setState({isHovered: true})}
      onMouseLeave={() => this.setState({isHovered: false})}
      {...extraProps}>
      {children}
      <span style={{display: 'inline-block'}}><span style={chevronIconStyle}>
        <Icon style={{fill}} />
      </span></span>
    </div>
  }
}


class AdviceSection extends React.Component {
  static propTypes = {
    adviceSelection: setPropType,
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    category: PropTypes.oneOf(Object.keys(ADVICE_CARD_GROUP_PROPS_BY_TOPIC)).isRequired,
    forceExpandAdviceId: PropTypes.string,
    isHorizontal: PropTypes.bool,
    isShownAsFlat: PropTypes.bool,
    isTitleShown: PropTypes.bool,
    maxWidth: PropTypes.number.isRequired,
    onSelectAdvice: PropTypes.func,
    onUnselectAdvice: PropTypes.func,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    scrollTo: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    adviceShownIndex: 0,
  }

  componentWillUnmount() {
    clearTimeout(this.mountTimeout)
  }

  handleSelectAdvice = advice => {
    const {advices, onSelectAdvice} = this.props
    const {adviceShownIndex} = this.state
    onSelectAdvice && onSelectAdvice(advice)
    if (adviceShownIndex + 1 >= advices.length) {
      return
    }
    this.setState({
      onAdviceSelectionTransitionEnd: () => {
        this.setState({
          adviceShownIndex: adviceShownIndex + 1,
          onAdviceSelectionTransitionEnd: null,
        })
      },
    })
  }

  showAdvice = index => {
    this.props.scrollTo(this.scrollElement)
    this.setState({adviceShownIndex: index})
  }

  renderAdviceCard(advice, style, adviceIndex, otherProps) {
    const {adviceSelection, forceExpandAdviceId, onUnselectAdvice, profile,
      project, userYou} = this.props
    const isSelected = !!(adviceSelection && adviceSelection.has(advice.adviceId))
    const {adviceShownIndex, onAdviceSelectionTransitionEnd} = this.state
    const onClick = adviceIndex === adviceShownIndex ?
      isSelected ?
        onUnselectAdvice && (() => onUnselectAdvice(advice)) :
        () => this.handleSelectAdvice(advice) :
      () => this.setState({
        adviceShownIndex: adviceIndex,
        onAdviceSelectionTransitionEnd: null,
      })
    return <ExplorerAdviceCard
      key={advice.adviceId} advice={advice} style={style}
      refDom={card => {
        this.cards = this.cards || {}
        this.cards[advice.adviceId] = card
      }}
      shouldStartExpanded={forceExpandAdviceId === advice.adviceId}
      onClick={onClick} isSelected={isSelected}
      onSelectionTransitionEnd={onAdviceSelectionTransitionEnd}
      isFeedbackButtonShown={true}
      howToSeeMore={`Découvre${userYou('', 'z')} d'autres astuces en sélectionnant ce conseil.`}
      {...{profile, project, userYou}} {...otherProps} />
  }

  renderCollapsed() {
    const {advices, maxWidth} = this.props
    const {adviceShownIndex} = this.state
    const isNextShown = adviceShownIndex + 1 < advices.length
    const containerStyle = {
      height: 416,
      margin: isMobileVersion ? '10px auto 35px' : '35px auto',
      maxWidth,
      position: 'relative',
    }
    const adviceStyle = {
      height: containerStyle.height,
      position: 'absolute',
      top: 0,
      width: '100%',
      ...SmoothTransitions,
    }
    const floatingAdviceStyle = {
      ...adviceStyle,
      opacity: .6,
    }
    return <div
      style={{overflow: 'hidden'}} ref={isMobileVersion ? dom => this.scrollElement = dom : null}>
      <div style={{padding: '0 20px'}}>
        <div style={containerStyle}>
          {adviceShownIndex ? this.renderAdviceCard(
            advices[adviceShownIndex - 1], {
              ...floatingAdviceStyle,
              transform: 'translateX(-100%) scale(.8)',
            }, adviceShownIndex - 1) : null}
          {this.renderAdviceCard(
            advices[adviceShownIndex], adviceStyle, adviceShownIndex, {
              onSwipedLeft: isNextShown ?
                () => this.showAdvice(adviceShownIndex + 1) : null,
              onSwipedRight: adviceShownIndex ?
                () => this.showAdvice(adviceShownIndex - 1) : null,
            })}
          {isNextShown ? this.renderAdviceCard(
            advices[adviceShownIndex + 1], {
              ...floatingAdviceStyle,
              transform: 'translateX(100%) scale(.8)',
            }, adviceShownIndex + 1) : null}
        </div>
      </div>
    </div>
  }

  renderCollapseButtons() {
    const {adviceSelection, advices, onUnselectAdvice} = this.props
    const {adviceShownIndex} = this.state
    const isPreviousShown = !!adviceShownIndex
    const isNextShown = adviceShownIndex + 1 < advices.length
    const advice = advices[adviceShownIndex]
    const isSelected = !!(adviceSelection && adviceSelection.has(advice.adviceId))
    const chevronStyle = {
      ':hover': {
        color: colors.CHARCOAL_GREY,
      },
      color: colors.PINKISH_GREY,
    }
    const labelStyle = {
      color: 'inherit',
    }
    const removeButtonStyle = {
      backgroundColor: 'rgba(255, 255, 255, .2)',
      color: 'inherit',
    }

    return <div style={{
      alignItems: 'center',
      display: 'flex',
      margin: 'auto',
      maxWidth: this.props.maxWidth,
    }}>
      {isMobileVersion ? null : <IconButton
        icon={ChevronLeftIcon} iconStyle={chevronStyle} isShown={isPreviousShown}
        style={{flexDirection: 'row-reverse', ...labelStyle}} onClick={() =>
          isPreviousShown && this.setState({adviceShownIndex: adviceShownIndex - 1})}>
        <span style={{marginLeft: 15, ...Styles.CENTER_FONT_VERTICALLY}}>Précédent</span>
      </IconButton>}
      <span style={{flex: 1}} />

      {isSelected ? null : <Button
        style={{height: 38}}
        onClick={() => !isSelected && this.handleSelectAdvice(advice)}
        type="validation" isNarrow={true} isOldStyle={true}>
         + Ajouter ce conseil à ma liste
      </Button>}
      {isSelected ? <Button
        onClick={() => onUnselectAdvice && onUnselectAdvice(advice)} type="discreet"
        isNarrow={true} style={removeButtonStyle} isOldStyle={true}>
        Retirer de ma liste
      </Button> : null}

      <span style={{flex: 1}} />
      {isMobileVersion ? null : <IconButton
        icon={ChevronRightIcon} iconStyle={chevronStyle} isShown={isNextShown} style={labelStyle}
        onClick={() =>
          isNextShown && this.setState({adviceShownIndex: adviceShownIndex + 1})}>
        <span style={{marginRight: 15, ...Styles.CENTER_FONT_VERTICALLY}}>Suivant</span>
      </IconButton>}
    </div>
  }

  renderBullets() {
    const {advices} = this.props
    const {adviceShownIndex} = this.state
    if (advices.length <= 1) {
      return null
    }
    const bulletStyle = isSelected => ({
      backgroundColor: isSelected ? colors.BOB_BLUE : colors.SILVER,
      borderRadius: 5,
      display: 'inline-block',
      height: 8,
      margin: 5,
      width: 8,
      ...SmoothTransitions,
    })
    return <div style={{marginTop: 5}}>
      {advices.map((advice, index) =>
        <span style={bulletStyle(index === adviceShownIndex)} key={`bullet-${index}`} />)}
    </div>
  }

  render() {
    const {advices, category, isTitleShown, maxWidth, project,
      userYou, style} = this.props
    if (!advices || !advices.length) {
      return null
    }
    const titleSidePadding = isMobileVersion ? 30 : 70
    const titleLinestyle = {
      fontSize: 18,
      fontWeight: 500,
      margin: '0 auto',
      maxWidth,
      padding: `0 ${titleSidePadding}px`,
      textAlign: isMobileVersion ? 'center' : 'initial',
    }
    const {title} = ADVICE_CARD_GROUP_PROPS_BY_TOPIC[category] || {}
    const containerStyle = {
      padding: isTitleShown ? '41px 0 33px' : 0,
      ...style,
    }
    const {components} = computeBobScore(project.diagnostic || {})
    const {percent} = components.find(({topic}) => topic === category) || {}
    const percentColor = percent && colorFromPercent(percent)
    return <div
      style={containerStyle} ref={isMobileVersion ? null : dom => this.scrollElement = dom}>
      {isTitleShown ? <div style={titleLinestyle}>
        {title(userYou, advices.length)}
        {percent ? <PercentBar
          percent={percent} color={percentColor} style={{marginTop: 10, maxWidth: 425}} />
          : null}
        {isMobileVersion ? this.renderBullets() : null}
      </div> : null}
      {this.renderCollapsed()}
      {this.renderCollapseButtons()}
    </div>
  }
}


// TODO(pascal): Check if it is used and maybe cleanup.
class AllAdviceSections extends React.Component {
  static propTypes = {
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    areCategoryTitlesShown: PropTypes.bool,
    project: PropTypes.shape({
      targetJob: PropTypes.shape({
        jobGroup: PropTypes.shape({
          romeId: PropTypes.string.isRequired,
        }).isRequired,
      }).isRequired,
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advices, areCategoryTitlesShown, style, ...extraProps} = this.props
    const cardsContainerStyle = {
      margin: '0 auto',
      ...style,
    }
    const adviceGroups = {[THREE_STARS]: advices.filter(({numStars}) => numStars === 3)}
    advices.forEach(advice => {
      Object.keys(categories).forEach(topic => {
        if (categories[topic].includes(advice.adviceId)) {
          if (adviceGroups[topic]) {
            adviceGroups[topic].push(advice)
          } else {
            adviceGroups[topic] = [advice]
          }
        }
      })
    })
    return <div style={cardsContainerStyle}>
      {ADVICE_CARD_GROUP_PROPS.filter(({topic}) =>
        adviceGroups[topic] && adviceGroups[topic].length
      ).map(({topic}) =>
        <AdviceSection key={`advices-${topic}`} isTitleShown={areCategoryTitlesShown}
          advices={adviceGroups[topic]} category={topic}
          maxWidth={960} {...extraProps} />
      )}
    </div>
  }
}


class DiagnosticAdvice extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      status: PropTypes.string,
    }).isRequired,
    isAdviceLocked: PropTypes.bool,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {}


  render() {
    const {advice: {adviceId, status}, isAdviceLocked, makeAdviceLink, style, userYou} = this.props
    const {isHovered} = this.state
    const isRead = status === 'ADVICE_READ'
    const containerStyle = {
      color: isAdviceLocked ? colors.COOL_GREY : 'inherit',
      cursor: 'pointer',
      textDecoration: 'none',
      ...style,
    }
    const desktopCardStyle = {
      border: `solid 1px ${isHovered ? colors.PINKISH_GREY : colors.MODAL_PROJECT_GREY}`,
      width: 290,
    }
    const cardStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 5,
      display: 'flex',
      marginBottom: 10,
      padding: 15,
      ...isMobileVersion ? {} : desktopCardStyle,
    }
    const titleStyle = {
      fontSize: 13,
      fontWeight: isRead ? 'normal' : 'bold',
    }
    const bulletStyle = {
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 6,
      flexShrink: 0,
      height: 6,
      marginRight: 10,
      width: 6,
    }
    const {goal} = getAdviceModules(userYou)[adviceId] || {}
    return <UnlockablePointsContainer
      count={100} goal="déverrouiller ce conseil" isLocked={isAdviceLocked}
      unlockAction={unlockAdvice(adviceId)}>
      <DisableableLink
        onMouseEnter={() => this.setState({isHovered: true})}
        onMouseLeave={() => this.setState({isHovered: false})}
        to={isAdviceLocked ? null : makeAdviceLink(adviceId)} key={adviceId}
        onClick={isAdviceLocked ? this.handleAdviceUnlock : null}
        style={containerStyle}>
        <div style={cardStyle}>
          {isRead ? null : <div style={bulletStyle} />}
          <span style={titleStyle}>{upperFirstLetter(goal)}</span>
          <div style={{flex: 1}} />
          {isAdviceLocked ?
            <PointsCounter
              backgroundColor={colors.NEW_GREY} count={100}
              style={{color: colors.CHARCOAL_GREY}} /> :
            <ChevronRightIcon size={20} style={{flexShrink: 0, marginRight: -7}} />}
        </div>
      </DisableableLink>
    </UnlockablePointsContainer>
  }
}


class DiagnosticAdviceList extends React.Component {
  static propTypes = {
    adviceStyle: PropTypes.object,
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      numStars: PropTypes.number,
    }).isRequired).isRequired,
    children: PropTypes.node,
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  render() {
    const {adviceStyle, advices = [], children, lockedAdvices, makeAdviceLink, style,
      userYou} = this.props
    if (!advices.length) {
      return null
    }
    const headerStyle = {
      fontWeight: 'bold',
      margin: '10px 0',
    }
    const listStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'initial',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    }
    return <div style={style}>
      <div style={headerStyle}>{children}</div>
      <div style={listStyle}>
        {advices.map(advice =>
          <DiagnosticAdvice
            style={adviceStyle} key={advice.adviceId} {...{advice, makeAdviceLink, userYou}}
            isAdviceLocked={lockedAdvices.has(advice.adviceId)} />)}
      </div>
    </div>
  }
}


class DiagnosticAdvices extends React.Component {
  static propTypes = {
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      numStars: PropTypes.number,
    }).isRequired),
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advices = [], lockedAdvices, makeAdviceLink, style, userYou} = this.props
    if (!advices.length) {
      return null
    }
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const [mainAdvices, otherAdvices] = _partition(advices, ({numStars}) => numStars === 3)
    return <div style={containerStyle}>
      <DiagnosticAdviceList
        advices={mainAdvices} style={{flex: 1}} {...{lockedAdvices, makeAdviceLink, userYou}}>
        Commence{userYou('', 'z')} par
      </DiagnosticAdviceList>
      <DiagnosticAdviceList
        advices={otherAdvices} style={{flex: 1}} areAdvicesLocked={true}
        {...{lockedAdvices, makeAdviceLink, userYou}}>
        {mainAdvices.length ? 'Puis éventuellement' : `Essaye${userYou('', 'z')} de`}
      </DiagnosticAdviceList>
    </div>
  }

}

export {AllAdviceSections, DiagnosticAdvices}
