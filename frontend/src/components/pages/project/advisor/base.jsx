import React from 'react'

import {Modal} from 'components/modal'
import {ShortKey} from 'components/shortkey'
import {CheckboxList, Colors, RoundButton} from 'components/theme'


class TitleBox extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    numRecommendations: React.PropTypes.number.isRequired,
    recommendationNumber: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const {children, numRecommendations, recommendationNumber} = this.props
    const style = {
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      color: Colors.DARK,
      padding: '40px 50px',
      ...this.props.style,
    }
    const headerStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 15,
      fontWeight: 'bold',
      textAlign: 'center',
      textTransform: 'uppercase',
    }
    return <div style={style}>
      <header style={headerStyle}>
        Solution n°{recommendationNumber}/{numRecommendations}
      </header>
      <ul style={{fontSize: 18, lineHeight: '26px', marginBottom: 0}}>
        {children}
      </ul>
    </div>
  }
}


class Section extends React.Component{
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    header: React.PropTypes.node.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const {children, header, style} = this.props
    const sectionStyle = {
      color: Colors.DARK_TWO,
      fontSize: 16,
      lineHeight: '26px',
      padding: '30px 0',
      ...style,
    }
    const sectionHeaderStyle = {
      fontSize: 20,
      fontWeight: 'bold',
    }
    return <section style={sectionStyle}>
      <header style={sectionHeaderStyle}>{header}</header>
      {children}
    </section>
  }
}

class MarketStressChart extends React.Component {
  static propTypes = {
    maxNumOffersShown: React.PropTypes.number,
    numCandidates: React.PropTypes.number.isRequired,
    numOffers: React.PropTypes.number.isRequired,
  }

  static defaultProps = {
    maxNumOffersShown: 18,
  }

  render() {
    const {numCandidates, numOffers, maxNumOffersShown, ...extraProps} = this.props
    const numOffersToShow = Math.min(numOffers, maxNumOffersShown)
    const arrayOfLength = length => new Array(length).fill(undefined)
    let offerImage
    if (numCandidates > 0 && numOffers/numCandidates > .7) {
      offerImage = require('images/offer-green.svg')
    } else if (numCandidates > 0 && numOffers/numCandidates > .4) {
      offerImage = require('images/offer-orange.svg')
    } else {
      offerImage = require('images/offer-red.svg')
    }
    const additionalOffers = numOffersToShow < numOffers ? '+' + (numOffers - numOffersToShow) : ''
    const additionalOffersStyle = {
      fontWeight: 'bold',
      lineHeight: '27px',
      marginTop: 15,
      verticalAlign: 'middle',
    }

    return <div {...extraProps}>
      <div>
        {arrayOfLength(numCandidates).map((unused, index) =>
          <img
              key={`candidate-${index}`} src={require('images/jobseeker.svg')}
              style={{marginRight: 10}} />)}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', maxWidth: 360}}>
        {arrayOfLength(numOffersToShow).map((unused, index) =>
          <img
              key={`offer-${index}`} src={offerImage}
              style={{marginLeft: 1, marginRight: 11, marginTop: 10}} />)}
        <span style={additionalOffersStyle}>{additionalOffers}</span>
      </div>
    </div>
  }
}


const APPLICATION_TITLES = {
  PERSONAL_OR_PROFESSIONAL_CONTACTS: 'Réseau personnel ou professionnel',
  PLACEMENT_AGENCY: 'Intermédiaires du placement',
  SPONTANEOUS_APPLICATION: 'Candidature spontanée',
  '': 'Autres canaux',
}


class ApplicationModeChart extends React.Component {
  static propTypes = {
    applicationModes: React.PropTypes.object,
  }

  getModeTitle(mode) {
    return APPLICATION_TITLES[mode] || APPLICATION_TITLES['']
  }

  renderBar(number, mode, isHighlighted) {
    const style = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      margin: '0 5px',
      textAlign: 'center',
      width: 130,
    }
    const titleStyle = {
      color: isHighlighted ? Colors.SLATE : Colors.COOL_GREY,
      fontSize: 16,
      fontStyle: 'italic',
      lineHeight: 1.19,
      marginBottom: 15,
    }
    const barStyle = {
      backgroundColor: isHighlighted ? Colors.SLATE : Colors.SILVER,
      color: isHighlighted ? '#fff' : Colors.COOL_GREY,
      fontSize: 35 - number * 5,
      fontWeight: 'bold',
      height: 125 - number * 25,
      lineHeight: 1,
      paddingTop: 22.5 - number * 2.5,
    }
    return <div style={style}>
      <div style={titleStyle}>
        {this.getModeTitle(mode)}
      </div>
      <div style={barStyle}>
        {number}
      </div>
    </div>
  }

  render() {
    const {applicationModes} = this.props
    // Select the first FAP available.
    let fapModes = null
    for (const fap in applicationModes) {
      fapModes = applicationModes[fap]
      break
    }
    if (!fapModes) {
      return null
    }

    return <div style={{display: 'flex', justifyContent: 'center'}}>
      {this.renderBar(2, fapModes.second, false)}
      {this.renderBar(1, fapModes.first, true)}
      {this.renderBar(3, fapModes.third, false)}
    </div>
  }
}


class AdvicePage extends React.Component {
  static propTypes = {
    acceptCaption: React.PropTypes.string.isRequired,
    children: React.PropTypes.node.isRequired,
    declineCaption: React.PropTypes.string.isRequired,
    declineReasonOptions: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    declineReasonTitle: React.PropTypes.string.isRequired,
    numRecommendations: React.PropTypes.number.isRequired,
    onAccept: React.PropTypes.func.isRequired,
    onDecline: React.PropTypes.func.isRequired,
    recommendationNumber: React.PropTypes.number.isRequired,
    showAckModalOnAccept: React.PropTypes.bool,
    style: React.PropTypes.object,
    summary: React.PropTypes.node.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  static defaultProps = {
    acceptCaption: "Ça m'intéresse",
    declineCaption: "Ça ne m'intéresse pas",
  }

  state = {
    isAckAcceptModalShown: false,
    isAckDeclineReasonModalShown: false,
    isDeclineModalShown: false,
    reason: '',
  }

  handleAccept = () => {
    const {onAccept, showAckModalOnAccept} = this.props
    if (showAckModalOnAccept) {
      this.setState({isAckAcceptModalShown: true})
    } else {
      onAccept()
    }
  }

  renderTitleBox() {
    const {recommendationNumber, summary, numRecommendations} = this.props
    const {isMobileVersion} = this.context
    const style = isMobileVersion ?  {
      margin: '0 0 20px',
      padding: 20,
    } : {
      margin: '30px 0',
    }
    return <TitleBox
        recommendationNumber={recommendationNumber} numRecommendations={numRecommendations}
        style={style}>
      {summary}
    </TitleBox>
  }

  renderDetailedAnalysis() {
    const {children} = this.props
    const {isMobileVersion} = this.context
    return <div style={{padding: isMobileVersion ? '0 30px' : '0 50px'}}>
      {children}
    </div>
  }

  renderButtons() {
    const {acceptCaption, declineCaption} = this.props
    const {isMobileVersion} = this.context
    const style = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'initial',
      marginBottom: 100,
      padding: '0 50px',
    }
    return <div style={style}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.handleAccept} />
      <RoundButton
          type="validation" style={{flex: 1}}
          onClick={this.handleAccept}>
        {acceptCaption}
      </RoundButton>
      <span style={{height: 20, width: 20}} />
      <RoundButton
          type="validation" style={{flex: 1}}
          onClick={() => this.setState({isDeclineModalShown: true})}>
        {declineCaption}
      </RoundButton>
    </div>
  }

  render() {
    const {declineReasonOptions, declineReasonTitle, onDecline, onAccept, style} = this.props
    const {isDeclineModalShown, isAckAcceptModalShown, isAckDeclineReasonModalShown} = this.state
    return <div style={style}>
      <DeclineModal
          onClose={() => this.setState({isDeclineModalShown: false})}
          isShown={isDeclineModalShown}
          title={declineReasonTitle}
          options={declineReasonOptions}
          onSubmit={reason => this.setState({
            isAckDeclineReasonModalShown: true,
            isDeclineModalShown: false,
            reason,
          })} />
      <AckDeclineReasonModal
          isShown={isAckDeclineReasonModalShown}
          onSubmit={() => onDecline(this.state.reason)} />
      <AckAcceptModal
          isShown={isAckAcceptModalShown}
          onSubmit={onAccept} />
      {this.renderTitleBox()}
      {this.renderDetailedAnalysis()}
      {this.renderButtons()}
    </div>
  }
}


class DeclineModal extends React.Component {
  static propTypes = {
    onClose: React.PropTypes.func.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
    options: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
  }

  state = {
    reasons: [],
  }

  handleSubmit = () => {
    const {onSubmit} = this.props
    let {reasons} = this.state
    if (this.refs.others.value) {
      reasons = reasons.concat([this.refs.others.value])
    }
    onSubmit(reasons.join(', '))
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {onClose, onSubmit, options, ...extraProps} = this.props
    const {reasons} = this.state
    const noticeStyle = {
      color: Colors.SLATE,
      fontSize: 14,
      lineHeight: 1.21,
      margin: '20px auto 35px',
      maxWidth: 360,
      textAlign: 'center',
    }
    const textareaStyle = {
      display: 'block',
      height: 130,
      margin: '10px 0 25px',
      padding: 15,
      width: '100%',
    }
    return <Modal
        {...extraProps} titleStyle={{lineHeight: 1}} onClose={onClose}
        style={{fontSize: 15, maxWidth: 480, padding: '0 60px 35px'}}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.handleSubmit} />
      <div style={noticeStyle}>
        Nous essayons de mieux comprendre vos motivations
        et votre parcours afin de vous aider au mieux.
      </div>

      <CheckboxList
          style={{color: Colors.DARK_TWO, fontSize: 15}}
          onChange={reasons => this.setState({reasons})}
          options={options.map(reason => ({name: reason, value: reason}))}
          values={reasons} />

      <div style={{color: Colors.DARK_TWO}}>
        Autres :
        <textarea
            style={textareaStyle} ref="others"
            placeholder="Dites-nous ce qui ne vous a pas plu." />
      </div>

      <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 25}}>
        <RoundButton onClick={onClose} type="discreet" style={{marginRight: 15}}>
          Annuler
        </RoundButton>
        <RoundButton onClick={this.handleSubmit} type="validation">
          Envoyer
        </RoundButton>
      </div>
    </Modal>
  }
}


// Modal that appears when we validate the choice of the user.
class ValidationModal extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
    submitButtonCaption: React.PropTypes.string.isRequired,
  }

  state = {
    isSubmitted: false,
  }

  render() {
    const {children, onSubmit, submitButtonCaption, ...extraProps} = this.props
    const style = {
      fontSize: 14,
      lineHeight: 1.57,
      maxWidth: 480,
      padding: '0 60px 50px',
      textAlign: 'center',
    }
    const handleSubmit = () => {
      this.setState({isSubmitted: true})
      onSubmit && onSubmit()
    }
    return <Modal {...extraProps} style={style}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={handleSubmit} />
      <img src={require('images/thumb-up.svg')} style={{margin: 40}} />
      <div>
        {children}
      </div>
      <RoundButton
          onClick={handleSubmit} type="validation" style={{marginTop: 40}}
          isProgressShown={this.state.isSubmitted} >
        {submitButtonCaption}
      </RoundButton>
    </Modal>
  }
}


class AckAcceptModal extends React.Component {
  render() {
    return <ValidationModal
        title="Solution ajoutée&nbsp;!"
        submitButtonCaption="Voir les autres solutions" {...this.props}>
      Cette solution a été ajoutée à votre plan d'action. Nous vous aiderons
      par la suite à <strong>évaluer et saisir</strong> cette opportunité.
    </ValidationModal>
  }
}


class AckDeclineReasonModal extends React.Component {
  render() {
    return <ValidationModal
        title="Merci pour votre aide"
        submitButtonCaption="Continuer" {...this.props}>
      Nous avons bien pris en compte votre retour.
      Nos algorithmes adapterons les solutions que
      nous vous proposerons à l'avenir.
    </ValidationModal>
  }
}


export {AdvicePage, ApplicationModeChart, MarketStressChart, Section, TitleBox}
