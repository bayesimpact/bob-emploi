import Radium from 'radium'
import React from 'react'
import PropTypes from 'prop-types'

import {AppearingList, Colors, GrowingNumber, Icon, Markdown, PaddedOnMobile,
  SmoothTransitions, Styles, Tag} from 'components/theme'

import emailTemplates from './data/email_templates.json'


class AdviceCard extends React.Component {
  render() {
    return <div style={{display: 'flex'}}>
      <div style={{flex: 1}}>
        <div style={{fontSize: 30, lineHeight: 1.03}}>
          En <strong>30 à 60 secondes</strong> le recruteur doit être
          convaincu. Ça commence dès l'email de candidature.
        </div>
      </div>
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {adviceId} = this.props.advice
    const templates = emailTemplates[adviceId] || []
    const boxStyle = index => ({
      marginTop: index ? -1 : 0,
    })
    return <div>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15}}>
        Nous avons trouvé <strong><GrowingNumber number={templates.length} /> exemples</strong> de
        structures d'email
      </PaddedOnMobile>

      <AppearingList>
        {templates.map((template, index) => <EmailTemplate
          {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </AppearingList>
    </div>
  }
}


const typeTags = {
  'apply-to-offer': {
    color: Colors.SQUASH,
    value: 'candidature à une offre',
  },
  'spontaneous-application': {
    color: Colors.GREENISH_TEAL,
    value: 'candidature spontanée',
  },
}


class EmailTemplateBase extends React.Component {
  static propTypes = {
    content: PropTypes.string.isRequired,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
    type: PropTypes.oneOf(Object.keys(typeTags)),
  }

  state = {
    isContentShown: false,
  }

  renderType() {
    const {type} = this.props
    const {color, value} = typeTags[type]
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
    const {content, style, title} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : Colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px',
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
    }
    const contentStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 13,
      margin: isContentShown ? '25px 0' : 0,
      maxHeight: isContentShown ? 600 : 0,
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      paddingLeft: 15,
      ...SmoothTransitions,
    }
    const linkStyle = {
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={containerStyle}>
      <header style={headerStyle} onClick={() => this.setState({isContentShown: !isContentShown})}>
        <strong style={Styles.CENTER_FONT_VERTICALLY}>
          {title}
        </strong>
        {this.renderType()}
        <span style={{flex: 1}} />
        <span style={linkStyle}>
          Voir {isContentShown ? 'moins ' : "l'email "}
        </span>
        <Icon
          name={isContentShown ? 'chevron-up' : 'chevron-down'}
          style={{fontSize: 20, lineHeight: '13px', marginLeft: 5}} />
      </header>

      <div style={contentStyle}>
        <Markdown content={content} />
      </div>
    </div>
  }
}
const EmailTemplate = Radium(EmailTemplateBase)


export default {AdviceCard, ExpandedAdviceCardContent}
