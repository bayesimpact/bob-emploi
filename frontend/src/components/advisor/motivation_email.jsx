import React from 'react'
import PropTypes from 'prop-types'

import improveEmailImage from 'images/improve-email-picto.svg'
import {Colors, GrowingNumber, Icon, Markdown, PaddedOnMobile,
  SmoothTransitions, Styles} from 'components/theme'

import emailTemplates from './data/email_templates.json'


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    return <div style={{display: 'flex'}}>
      <div style={{flex: 1}}>
        <div style={{fontSize: 30, lineHeight: 1.03}}>
          Si vous n'aviez que <strong>30 secondes pour convaincre&nbsp;?</strong>
        </div>
        <div style={{fontSize: 16, lineHeight: 1.25, marginTop: 30}}>
          Les recruteurs prennent entre 30 et 60 secondes pour étudier une
          candidature; assurez-vous que l'essentiel est dans le corps du mail.
        </div>
      </div>

      {isMobileVersion ? null : <div style={{fontSize: 13}}>
        <div style={{fontWeight: 500, marginBottom: 20, textAlign: 'center'}}>
          Répartition du temps passé sur une candidature
        </div>
        <img src={improveEmailImage} />
      </div>}
    </div>
  }
}


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {adviceId} = this.props.advice
    const {isMobileVersion} = this.context
    const templates = emailTemplates[adviceId] || []
    const boxStyle = index => ({
      display: 'inline-block',
      marginBottom: 35,
      marginRight: (index % 2 || isMobileVersion) ? 0 : 35,
      verticalAlign: 'top',
      width: isMobileVersion ? '100%' : 450,
    })
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <strong><GrowingNumber number={templates.length} /> exemples</strong> de
        structures d'email
      </PaddedOnMobile>

      <div>
        {templates.map((template, index) => <EmailTemplateBox
            {...template} style={boxStyle(index)} key={`template-${index}`} />)}
      </div>
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


class EmailTemplateBox extends React.Component {
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
      borderRadius: 2,
      color: '#fff',
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: .3,
      marginLeft: 10,
      padding: 6,
      textTransform: 'uppercase',
    }
    return <div style={{marginTop: 5}}>
      <span style={{fontWeight: 500}}>
        Type&nbsp;: <span style={tagStyle}>
          <div style={Styles.CENTER_FONT_VERTICALLY}>{value}</div>
        </span>
      </span>
    </div>
  }

  render() {
    const {content, style, title} = this.props
    const {isContentShown} = this.state
    const containerStyle = {
      backgroundColor: '#fff',
      color: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      padding: '0 25px',
      ...style,
    }
    const headerStyle = {
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      color: Colors.CHARCOAL_GREY,
      padding: '25px 0',
    }
    const contentStyle = {
      borderLeft: `solid 4px ${Colors.BACKGROUND_GREY}`,
      color: Colors.CHARCOAL_GREY,
      margin: isContentShown ? '25px 0' : 0,
      maxHeight: isContentShown ? 600 : 0,
      opacity: isContentShown ? 1 : 0,
      overflow: 'hidden',
      paddingLeft: 20,
      ...SmoothTransitions,
    }
    const linkStyle = {
      borderTop: `solid ${isContentShown ? '1px' : 0} ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      fontWeight: 500,
      padding: '20px 0',
    }
    return <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={{fontSize: 17, fontWeight: 'bold'}}>{title}</div>
        {this.renderType()}
      </header>

      <div style={contentStyle}>
        <Markdown content={content} />
      </div>

      <div
          style={linkStyle}
          onClick={() => this.setState({isContentShown: !isContentShown})}>
        Voir {isContentShown ? 'moins ' : "l'email "}
        <Icon
            name={isContentShown ? 'chevron-up' : 'chevron-down'}
            style={{fontSize: 20, lineHeight: '13px', verticalAlign: 'middle'}} />
      </div>
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
