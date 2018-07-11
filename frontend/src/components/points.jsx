import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import whiteStarIcon from 'images/star-white.svg'
import {Modal} from 'components/modal'
import {Button} from 'components/theme'


class PointsCounter extends React.Component {
  static propTypes = {
    backgroundColor: PropTypes.string,
    count: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {backgroundColor, count, style, ...otherProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      // TODO(cyrille): Remove once this is the default font.
      fontFamily: 'Lato, Helvetica',
      fontSize: 13,
      fontWeight: 'bold',
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const counterContainerStyle = {
      backgroundColor: backgroundColor || 'rgba(255, 255, 255, .4)',
      borderRadius: 4,
      lineHeight: 1,
      padding: '3px 16px 3px 8px',
    }
    return <div style={containerStyle} {...otherProps}>
      <div style={counterContainerStyle}>{count}</div>
      <PointsStar style={{marginLeft: -8, width: 27, zIndex: 1}} />
    </div>
  }
}


class PointsStar extends React.Component {
  static propTypes = {
    style: PropTypes.shape({
      width: PropTypes.number,
    }),
  }

  render() {
    const {style, ...otherProps} = this.props
    const width = style && style.width || 27
    const starWidth = width * 15 / 27
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: colors.AMBER_YELLOW,
      borderRadius: width,
      boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.2)',
      display: 'inline-flex',
      height: width,
      justifyContent: 'center',
      width,
      ...style,
    }
    return <div style={containerStyle} {...otherProps}>
      <img src={whiteStarIcon} alt="points" style={{margin: '0 auto', width: starWidth}} />
    </div>
  }
}


class UnlockablePointsContainerBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    count: PropTypes.number.isRequired,
    dispatch: PropTypes.func.isRequired,
    goal: PropTypes.node.isRequired,
    hasEnoughPoints: PropTypes.bool.isRequired,
    isLocked: PropTypes.bool,
    unlockAction: PropTypes.oneOfType([
      PropTypes.func.isRequired,
      PropTypes.shape({
        type: PropTypes.string.isRequired,
      }).isRequired,
    ]).isRequired,
  }

  state = {
    isModalShown: false,
  }

  render() {
    const {children, count, dispatch, goal, hasEnoughPoints, isLocked, unlockAction,
      ...otherProps} = this.props
    const {isModalShown} = this.state
    if (!isLocked) {
      return <div {...otherProps}>{children}</div>
    }
    if (!hasEnoughPoints) {
      // TODO(pascal): On click, show the modal to indicate how to gain points.
      return <div {...otherProps} onClick={() => alert('Pas assez de points')}>
        {children}
      </div>
    }
    const modalStyle = {
      borderRadius: 20,
      color: colors.DARK_TWO,
      fontFamily: 'Lato, Helvetica',
      margin: 20,
      padding: '40px 30px',
      textAlign: 'center',
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 35,
      justifyContent: 'center',
      marginBottom: 20,
    }
    return <div
      {...otherProps} onClick={isModalShown ? null : () => this.setState({isModalShown: true})}>
      <Modal isShown={isModalShown} style={modalStyle}>
        <div style={titleStyle}>
          <PointsStar style={{marginRight: 15, width: 35}} />
          {count}
        </div>
        Utiliser {count} point{count > 1 ? 's' : null} pour {goal}&nbsp;?
        <div style={{marginTop: 25}}>
          <Button
            onClick={() => this.setState({isModalShown: false})} isRound={true} type="back">
            Non
          </Button>
          <Button
            isRound={true} style={{marginLeft: 25}}
            onClick={() => this.setState({isModalShown: false}, () => dispatch(unlockAction))}>
            Oui
          </Button>
        </div>
      </Modal>
      {children}
    </div>
  }
}
const UnlockablePointsContainer = connect(({user: {appPoints: {current = 0} = {}}}, {count}) => ({
  hasEnoughPoints: current >= count,
}))(UnlockablePointsContainerBase)


class EarnPointsListBase extends React.Component {
  static propTypes = {
    count: PropTypes.number.isRequired,
  }

  renderCard(title, buttonTitle, count, backgroundColor) {
    const borderRadius = 10
    const cardStyle = {
      backgroundColor: '#fff',
      borderRadius,
      boxShadow: '0 4px 25px 0 rgba(0, 0, 0, 0.14)',
      color: colors.DARK_TWO,
      display: 'flex',
      fontSize: 13,
      fontWeight: 900,
      margin: '0 25px 30px',
    }
    const buttonStyle = {
      ':active': {
        boxShadow: 'initial',
      },
      ':hover': {
        boxShadow: 'initial',
      },
      backgroundColor: colors.PALE_GREY,
      boxShadow: 'initial',
      color: colors.CHARCOAL_GREY,
      fontSize: 13,
      fontWeight: 'bold',
      padding: '4px 12px',
    }
    const pointsContainerStyle = {
      alignItems: 'center',
      backgroundColor,
      borderRadius: `0 ${borderRadius}px ${borderRadius}px 0`,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '15px 20px',
    }
    // TODO(pascal): Handle the onClick properly.
    return <div style={cardStyle}>
      <div style={{flex: 1, padding: 15}}>
        <div style={{marginBottom: 8}}>{title}</div>
        <Button style={buttonStyle} onClick={() => alert('Bientôt disponible…')}>
          {buttonTitle}
        </Button>
      </div>
      <div style={pointsContainerStyle}>
        <PointsStar style={{marginBottom: 6, width: 26}} />
        +&nbsp;{count}
      </div>
    </div>
  }

  renderShareCard(network) {
    return this.renderCard(
      `Partager ${config.productName} sur ${network}`,
      'Partager',
      100,
      colors.BOB_BLUE,
    )
  }

  render() {
    const {count} = this.props
    const titleStyle = {
      alignItems: 'center',
      borderBottom: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.GREYISH_BROWN,
      display: 'flex',
      fontSize: 35,
      justifyContent: 'center',
      margin: '0 25px 30px',
      padding: 30,
    }
    return <React.Fragment>
      <div style={titleStyle}>
        <PointsStar style={{marginRight: 15, width: 35}} />
        {count}
      </div>
      <div>
        {this.renderShareCard('Facebook')}
        {this.renderShareCard('Twitter')}
        {this.renderShareCard('LinkedIn')}
        {this.renderCard(
          `Écrire un avis sur ${config.productName}`,
          'Écrire un avis',
          150,
          colors.GREENISH_TEAL,
        )}
      </div>
    </React.Fragment>
  }
}
const EarnPointsList =
  connect(({user: {appPoints: {current: count = 0} = {}}}) => ({count}))(EarnPointsListBase)


export {EarnPointsList, PointsCounter, UnlockablePointsContainer}
