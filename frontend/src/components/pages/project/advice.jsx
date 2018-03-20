import keyBy from 'lodash/keyBy'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'
import setPropType from 'es6-set-proptypes'

import {lowerFirstLetter} from 'store/french'
import {BOB_SUB_METRICS, colorFromPercent, computeNewBobScore} from 'store/score'
import {USER_PROFILE_SHAPE} from 'store/user'


import {ExplorerAdviceCard} from 'components/advisor'
import categories from 'components/advisor/data/categories.json'
import {Button, Colors, PercentBar, SmoothTransitions, Styles} from 'components/theme'


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
const ADVICE_CARD_GROUP_PROPS_BY_TOPIC = keyBy(ADVICE_CARD_GROUP_PROPS, ({topic}) => topic)


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
        <Icon fill={fill} />
      </span></span>
    </div>
  }
}


class AdviceSection extends React.Component {
  static propTypes = {
    adviceSelection: setPropType,
    adviceShownOnMount: PropTypes.string,
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    category: PropTypes.oneOf(Object.keys(ADVICE_CARD_GROUP_PROPS_BY_TOPIC)).isRequired,
    forceExpandAdviceId: PropTypes.string,
    isHorizontal: PropTypes.bool,
    isMain: PropTypes.bool,
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

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {adviceShownOnMount, advices, isShownAsFlat} = this.props
    const isCollapsable = !isShownAsFlat
    const adviceShownIndex =
      isCollapsable && adviceShownOnMount &&
      advices.findIndex(a => a.adviceId === adviceShownOnMount) || 0
    this.setState({
      adviceShownIndex: adviceShownIndex >= 0 ? adviceShownIndex : 0,
      isCollapsable,
    })
  }

  componentDidMount() {
    const {adviceShownOnMount, scrollTo} = this.props
    if (!adviceShownOnMount || !scrollTo || !this.cards || !this.cards[adviceShownOnMount]) {
      return
    }
    this.mountTimeout = setTimeout(() => scrollTo(this.cards[adviceShownOnMount]), 100)
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
      project} = this.props
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
      isScorable={true} isFeedbackButtonShown={true}
      {...{profile, project}} {...otherProps} />
  }

  renderCollapsed() {
    const {advices, maxWidth} = this.props
    const {adviceShownIndex} = this.state
    const {isMobileVersion} = this.context
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
    const {isMobileVersion} = this.context
    const isPreviousShown = !!adviceShownIndex
    const isNextShown = adviceShownIndex + 1 < advices.length
    const advice = advices[adviceShownIndex]
    const isSelected = !!(adviceSelection && adviceSelection.has(advice.adviceId))
    const chevronStyle = {
      ':hover': {
        color: Colors.CHARCOAL_GREY,
      },
      color: Colors.PINKISH_GREY,
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
    const {advices, isMain} = this.props
    const {adviceShownIndex} = this.state
    if (advices.length <= 1) {
      return null
    }
    const bulletStyle = isSelected => ({
      backgroundColor: isSelected ?
        isMain ? '#fff' : Colors.BOB_BLUE :
        isMain ? 'rgba(255, 255, 255, .4)' : Colors.SILVER,
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
    const {advices, category, isMain, isTitleShown, maxWidth, project,
      userYou, style} = this.props
    const {isCollapsable} = this.state
    const {isMobileVersion} = this.context
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
    const mainContainerStyle = isMain ? {
      backgroundColor: Colors.BOB_BLUE,
      color: '#fff',
    } : {}
    const containerStyle = {
      padding: isTitleShown ? '41px 0 33px' : 0,
      ...mainContainerStyle,
      ...style,
    }
    const {components} = computeNewBobScore(project.diagnostic || {})
    const {percent} = components.find(({topic}) => topic === category) || {}
    const percentColor = percent && colorFromPercent(percent)
    return <div
      style={containerStyle} ref={isMobileVersion ? null : dom => this.scrollElement = dom}>
      {isTitleShown ? <div style={titleLinestyle}>
        {title(userYou, advices.length)}
        {percent ? <PercentBar percent={percent} color={percentColor} style={{marginTop: 10}} />
          : null}
        {isMobileVersion ? this.renderBullets() : null}
      </div> : null}
      {this.renderCollapsed()}
      {isCollapsable ? this.renderCollapseButtons() : null}
    </div>
  }
}


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
          isMain={topic === THREE_STARS} advices={adviceGroups[topic]} category={topic}
          maxWidth={960} {...extraProps} />
      )}
    </div>
  }
}

export {AllAdviceSections}
