import _partition from 'lodash/partition'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {Link} from 'react-router-dom'

import {getAdviceGoal} from 'store/advice'
import {YouChooser, upperFirstLetter} from 'store/french'

import {isMobileVersion} from 'components/mobile'


interface DiagnosticAdviceProps {
  advice: bayes.bob.Advice
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
  teaser?: string
  userYou: YouChooser
}


class AlphaTag extends React.PureComponent<{children?: never; style?: React.CSSProperties}> {
  public render(): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      backgroundColor: colors.RED_PINK,
      borderRadius: 5,
      color: '#fff',
      padding: 5,
      ...this.props.style,
    }
    return <div
      style={containerStyle}
      title="Ce conseil n'est donné qu'aux utilisateurs de la version alpha">
      α
    </div>
  }
}


class DiagnosticAdviceBase extends React.PureComponent<DiagnosticAdviceProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      goal: PropTypes.string,
      isForAlphaOnly: PropTypes.bool,
      status: PropTypes.string,
    }).isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    teaser: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {advice: {adviceId, goal, isForAlphaOnly, status},
      makeAdviceLink, style, teaser, userYou} = this.props
    const isRead = status === 'ADVICE_READ'
    const containerStyle: React.CSSProperties = {
      color: 'inherit',
      cursor: 'pointer',
      display: 'block',
      textDecoration: 'none',
      ...style,
    }
    const desktopCardStyle: RadiumCSSProperties = {
      ':hover': {
        border: `solid 1px ${colors.PINKISH_GREY}`,
      },
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    }
    const cardStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 5,
      display: 'flex',
      padding: '11px 15px',
      position: 'relative',
      ...isMobileVersion ? {} : desktopCardStyle,
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: isRead ? 'normal' : 'bold',
    }
    const bulletStyle: React.CSSProperties = {
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 6,
      flexShrink: 0,
      height: 6,
      marginRight: 10,
      width: 6,
    }
    const shownTeaser = teaser || getAdviceGoal({adviceId: adviceId, goal: goal}, userYou)
    return <Link
      to={makeAdviceLink(adviceId)} key={adviceId}
      style={containerStyle}>
      <div style={cardStyle}>
        {isRead ? null : <div style={bulletStyle} />}
        <span style={titleStyle}>
          {upperFirstLetter(shownTeaser)}
        </span>
        <div style={{flex: 1}} />
        {isForAlphaOnly ? <AlphaTag /> : null}
        <ChevronRightIcon size={20} style={{flexShrink: 0, marginRight: -7}} />
      </div>
    </Link>
  }
}
const DiagnosticAdvice = Radium(DiagnosticAdviceBase)


interface DiagnosticAdviceListProps {
  adviceStyle?: React.CSSProperties
  advices: bayes.bob.Advice[]
  children: React.ReactNode
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
  userYou: YouChooser
}


class DiagnosticAdviceList extends React.PureComponent<DiagnosticAdviceListProps> {
  public static propTypes = {
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

  public render(): React.ReactNode {
    const {adviceStyle, advices = [], children, makeAdviceLink, style,
      userYou} = this.props
    if (!advices.length) {
      return null
    }
    const headerStyle: React.CSSProperties = {
      fontWeight: 'bold',
      margin: '10px 0',
    }
    const listStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'initial',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    }
    const adviceUpdatedStyle: React.CSSProperties = {
      marginBottom: 10,
      [isMobileVersion ? 'maxWidth' : 'width']: 290,
      ...adviceStyle,
    }
    return <div style={style}>
      <div style={headerStyle}>{children}</div>
      <div style={listStyle}>
        {advices.map((advice: bayes.bob.Advice): React.ReactNode =>
          <DiagnosticAdvice
            style={adviceUpdatedStyle} key={advice.adviceId}
            {...{advice, makeAdviceLink, userYou}} />)}
      </div>
    </div>
  }
}


interface DiagnosticAdvicesProps {
  advices: bayes.bob.Advice[]
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
  userYou: YouChooser
}


class DiagnosticAdvices extends React.PureComponent<DiagnosticAdvicesProps> {
  public static propTypes = {
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
      numStars: PropTypes.number,
    }).isRequired),
    makeAdviceLink: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {advices = [], makeAdviceLink, style, userYou} = this.props
    if (!advices.length) {
      return null
    }
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const [mainAdvices, otherAdvices] = _partition(advices, ({numStars}): boolean => numStars === 3)
    return <div style={containerStyle}>
      <DiagnosticAdviceList
        advices={mainAdvices} style={{flex: 1}} {...{makeAdviceLink, userYou}}>
        Commence{userYou('', 'z')} par
      </DiagnosticAdviceList>
      <DiagnosticAdviceList
        advices={otherAdvices} style={{flex: 1}}
        {...{makeAdviceLink, userYou}}>
        {mainAdvices.length ? 'Puis éventuellement' : `Essaye${userYou('', 'z')} de`}
      </DiagnosticAdviceList>
    </div>
  }

}

export {AlphaTag, DiagnosticAdvice, DiagnosticAdvices}
