import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import config from 'config'

import {sendProjectFeedback} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {youForUser} from 'store/user'

import starIcon from 'images/star.svg'
import starOutlineIcon from 'images/star-outline.svg'
import {Modal} from 'components/modal'
import {CheckboxList, Colors, Button} from 'components/theme'

const feedbackTitle = {
  '1': 'Mauvais',
  '2': 'Peu intéressants',
  '3': 'Intéressants',
  '4': 'Pertinents',
  '5': 'Très pertinents',
}

class FeedbackBarBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFeminine: PropTypes.bool,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    hoveredStars: 0,
    isModalShown: false,
    score: 0,
    selectedAdvices: [],
    text: '',
  }

  saveFeedback = () => {
    const {dispatch, project} = this.props
    const {score, text, selectedAdvices} = this.state
    const usefulAdviceModules = {};
    (selectedAdvices || []).forEach(adviceId => {
      usefulAdviceModules[adviceId] = true
    })
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}))
  }

  openModal = highlightedStars => {
    this.setState({isModalShown: true, score: highlightedStars})
  }

  renderTitle(numStars) {
    const {userYou} = this.props
    return feedbackTitle[numStars] ||
      `Que pense${userYou('s-tu', 'z-vous')} des conseils de ${config.productName}\u00a0?`
  }

  renderModal() {
    const {isFeminine, project, userYou} = this.props
    const {isMobileVersion} = this.context
    const {isModalShown, score, selectedAdvices, text} = this.state
    const isGoodFeedback = score > 2
    const shownAdvices = project.advices.filter(({score}) => score) || []
    const contentStyle = {
      fontSize: 15,
      padding: '35px 0',
      position: 'relative',
      width: isMobileVersion ? 'initial' : 600,
    }
    const modalStyle = {
      color: Colors.DARK_TWO,
      margin: '0 10px',
      padding: isMobileVersion ? 20 : 50,
    }
    return <Modal
      isShown={isModalShown} style={modalStyle}
      onClose={() => this.setState({isModalShown: false, score: 0})}>
      <div style={{borderBottom: `solid 2px ${Colors.SILVER}`, paddingBottom: 35}}>
        {this.renderStars()}
      </div>
      <div style={contentStyle}>
        <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
          {isGoodFeedback ? <span>
            Qu'est-ce qui {userYou("t'", 'vous ')}a le plus aidé{isFeminine ? 'e' : ''}{' '}
            dans {config.productName}&nbsp;?
          </span> : <span>
            {userYou('Peux-tu', 'Pouvez-vous')} nous dire ce qui n'a pas fonctionné
            pour {userYou('toi', 'vous')}&nbsp;?
          </span>}
        </div>
        <textarea
          style={{height: 180, padding: 10, width: '100%'}}
          placeholder={`${userYou('Écris ton', 'Écrivez votre')} commentaire ici`}
          value={text}
          onChange={event => this.setState({text: event.target.value})} />
        {isGoodFeedback ? <div>
          <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
            Quels conseils {userYou("t'", 'vous ')}ont particulièrement
            intéressé{isFeminine ? 'e' : ''}&nbsp;?
          </div>
          <CheckboxList
            onChange={selectedAdvices => this.setState({selectedAdvices})} values={selectedAdvices}
            options={(shownAdvices).
              filter(a => a.numStars > 1).
              map(advice => ({name: getAdviceTitle(advice, userYou), value: advice.adviceId})).
              filter(({name}) => name)} />
        </div> : null}
      </div>
      <div style={{textAlign: 'center'}}>
        <Button onClick={this.saveFeedback} isRound={true}>Envoyer</Button>
      </div>
    </Modal>
  }

  renderStars() {
    const {isMobileVersion} = this.context
    const {hoveredStars, score} = this.state
    const highlightedStars = hoveredStars || score || 0
    const starStyle = {
      cursor: 'pointer',
      height: 30,
      padding: 5,
    }
    const notOnMobile = callback => isMobileVersion ? null : callback
    return <div style={{textAlign: 'center'}}>
      <div style={{fontSize: 16, fontWeight: 500, marginBottom: 5}}>
        {this.renderTitle(highlightedStars)}
      </div>
      <div>
        {new Array(5).fill(null).map((unused, index) => <img
          onMouseEnter={notOnMobile(() => this.setState({hoveredStars: index + 1}))}
          onMouseLeave={notOnMobile(() => {
            if (hoveredStars === index + 1) {
              this.setState({hoveredStars: 0})
            }
          })}
          style={starStyle} alt={`${index + 1} étoile${index ? 's' : ''}`}
          onClick={() => this.openModal(index + 1)}
          src={(index < highlightedStars) ? starIcon : starOutlineIcon} key={`star-${index}`} />)}
      </div>
    </div>
  }

  render() {
    const {project, style} = this.props
    if (project.feedback && project.feedback.score) {
      return null
    }
    const containerStyle = {
      backgroundColor: Colors.DARK_TWO,
      color: '#fff',
      position: 'relative',
      ...style,
    }
    return <div style={containerStyle}>
      {this.renderModal()}
      {this.renderStars()}
    </div>
  }
}
const FeedbackBar = connect(({user}) => ({
  isFeminine: user.profile.gender === 'FEMININE',
  userYou: youForUser(user),
}))(FeedbackBarBase)


export {FeedbackBar}
