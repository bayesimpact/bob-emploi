import _partition from 'lodash/partition'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {Link} from 'react-router-dom'

import {getAdviceGoal} from 'store/advice'
import {upperFirstLetter} from 'store/french'

import {isMobileVersion} from 'components/mobile'


class DiagnosticAdvice extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      isForAlphaOnly: PropTypes.bool,
      status: PropTypes.string,
    }).isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  renderAlphaTag() {
    const containerStyle = {
      backgroundColor: colors.RED_PINK,
      borderRadius: 5,
      color: '#fff',
      padding: 5,
    }
    return <div
      style={containerStyle}
      title="Ce conseil n'est donné qu'aux utilisateurs de la version alpha">
      α
    </div>
  }

  render() {
    const {advice: {adviceId, goal, isForAlphaOnly, status},
      makeAdviceLink, style, userYou} = this.props
    const {isHovered} = this.state
    const isRead = status === 'ADVICE_READ'
    const containerStyle = {
      color: 'inherit',
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
      position: 'relative',
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
    return <Link
      onMouseEnter={() => this.setState({isHovered: true})}
      onMouseLeave={() => this.setState({isHovered: false})}
      to={makeAdviceLink(adviceId)} key={adviceId}
      style={containerStyle}>
      <div style={cardStyle}>
        {isRead ? null : <div style={bulletStyle} />}
        <span style={titleStyle}>
          {upperFirstLetter(getAdviceGoal({adviceId: adviceId, goal: goal}, userYou))}
        </span>
        <div style={{flex: 1}} />
        {isForAlphaOnly ? this.renderAlphaTag() : null}
        <ChevronRightIcon size={20} style={{flexShrink: 0, marginRight: -7}} />
      </div>
    </Link>
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
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {}

  render() {
    const {adviceStyle, advices = [], children, makeAdviceLink, style,
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
            style={adviceStyle} key={advice.adviceId} {...{advice, makeAdviceLink, userYou}} />)}
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
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advices = [], makeAdviceLink, style, userYou} = this.props
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
        advices={mainAdvices} style={{flex: 1}} {...{makeAdviceLink, userYou}}>
        Commence{userYou('', 'z')} par
      </DiagnosticAdviceList>
      <DiagnosticAdviceList
        advices={otherAdvices} style={{flex: 1}} areAdvicesLocked={true}
        {...{makeAdviceLink, userYou}}>
        {mainAdvices.length ? 'Puis éventuellement' : `Essaye${userYou('', 'z')} de`}
      </DiagnosticAdviceList>
    </div>
  }

}

export {DiagnosticAdvices}
