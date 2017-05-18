import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {filterPersonalizations} from 'store/personalizations'
import {USER_PROFILE_SHAPE} from 'store/user'

import userImage from 'images/user-picto.svg'
import {FeatureLikeDislikeButtons} from 'components/like'
import {Colors, Icon, PaddedOnMobile, SmoothTransitions} from 'components/theme'


class PersonalizationBox extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    header: PropTypes.node,
    style: PropTypes.object,
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
        <img src={userImage} style={{paddingRight: 15}} />
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


class PersonalizationBoxes extends React.Component {
  static propTypes = {
    maxNumberBoxes: PropTypes.number,
    personalizations: PropTypes.arrayOf(PropTypes.shape({
      filters: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
      tip: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
    }).isRequired).isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }
  static defaultProps = {
    maxNumberBoxes: 3,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
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
    children: PropTypes.node,
    feature: PropTypes.string.isRequired,
    header: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, feature, header, style} = this.props
    const {padding, ...outerStyle} = style
    const containerStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      ...outerStyle,
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
      padding: (padding || padding === 0) ? padding : '20px 35px',
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
          style={{height: 55, width: 55}} />
        <div style={{paddingLeft: 20}}>{children}</div>
      </div>
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const ToolCard = Radium(ToolCardBase)


export {AdviceBox, PersonalizationBoxes, ToolCard}
