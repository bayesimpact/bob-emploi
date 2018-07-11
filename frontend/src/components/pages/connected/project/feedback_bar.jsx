import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'

import {sendProjectFeedback} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {youForUser} from 'store/user'

import starIcon from 'images/star.svg'
import whiteStarIcon from 'images/star-white.svg'
import starOutlineIcon from 'images/star-outline.svg'
import {isMobileVersion} from 'components/mobile'
import {Modal} from 'components/modal'
import {Button} from 'components/theme'
import {CheckboxList} from 'components/pages/connected/form_utils'

const feedbackTitle = {
  '1': 'Mauvais',
  '2': 'Peu intéressants',
  '3': 'Intéressants',
  '4': 'Pertinents',
  '5': 'Très pertinents',
}


class FeedbackBarBase extends React.Component {
  static propTypes = {
    evaluationUrl: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isModalShown: false,
    score: 0,
  }

  openModal = score => {
    if (this.form) {
      this.form.setState({score})
    }
    this.setState({isModalShown: true, score})
  }

  renderModal() {
    const {isModalShown, score} = this.state
    const {evaluationUrl} = this.props
    if (isMobileVersion) {
      if (isModalShown) {
        return <Redirect to={`${evaluationUrl}/${score}`} push={true} />
      }
      return null
    }
    return <Modal
      isShown={isModalShown} style={{margin: '0 10px'}}
      onClose={() => this.setState({isModalShown: false, score: 0})}>
      <FeedbackForm
        {...this.props} ref={form => this.form = form} score={score} />
    </Modal>
  }

  render() {
    const {project: {feedback}, style, userYou} = this.props
    const {score} = this.state
    if (feedback && feedback.score) {
      return null
    }
    const containerStyle = {
      backgroundColor: colors.DARK_TWO,
      color: '#fff',
      position: 'relative',
      ...style,
    }
    return <div style={containerStyle}>
      {this.renderModal()}
      <FeedbackStars
        userYou={userYou} score={score} onStarClick={this.openModal}
        isWhite={style.backgroundColor === colors.GREENISH_TEAL} />
    </div>
  }
}
const FeedbackBar = connect(({user}) => ({
  isFeminine: user.profile.gender === 'FEMININE',
  userYou: youForUser(user),
}))(FeedbackBarBase)


class FeedbackPageBase extends React.Component {
  static propTypes = {
    backTo: PropTypes.string.isRequired,
  }

  state = {
    isFeedbackSubmitted: false,
  }

  render() {
    if (this.state.isFeedbackSubmitted) {
      return <Redirect to={this.props.backTo} />
    }
    return <FeedbackForm
      {...this.props} onSubmit={() => this.setState({isFeedbackSubmitted: true})} />
  }
}
const FeedbackPage = connect(({user}) => ({
  isFeminine: user.profile.gender === 'FEMININE',
  userYou: youForUser(user),
}))(FeedbackPageBase)


class FeedbackForm extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFeminine: PropTypes.bool,
    onSubmit: PropTypes.func,
    project: PropTypes.object.isRequired,
    score: PropTypes.number,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    score: this.props.score || 0,
    selectedAdvices: [],
    text: '',
  }

  saveFeedback = () => {
    const {dispatch, onSubmit, project} = this.props
    const {score, text, selectedAdvices} = this.state
    const usefulAdviceModules = {};
    (selectedAdvices || []).forEach(adviceId => {
      usefulAdviceModules[adviceId] = true
    })
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}))
    onSubmit && onSubmit()
  }

  render() {
    const {isFeminine, project: {advices}, userYou} = this.props
    const {score, selectedAdvices, text} = this.state
    const isGoodFeedback = score > 2
    const shownAdvices = advices.filter(({score}) => score) || []
    const containerStyle = {
      backgroundColor: '#fff',
      color: colors.DARK_TWO,
      // TODO(pascal): Propagate font family to children that still needs GTWalsheim.
      fontFamily: 'GTWalsheim',
      padding: isMobileVersion ? 20 : 50,
    }
    const contentStyle = {
      fontSize: 15,
      padding: '35px 0',
      position: 'relative',
      width: isMobileVersion ? 'initial' : 600,
    }
    return <div style={containerStyle}>
      <div style={{borderBottom: `solid 2px ${colors.SILVER}`, paddingBottom: 35}}>
        <FeedbackStars
          userYou={userYou} score={score} onStarClick={score => this.setState({score})} />
      </div>
      <div style={contentStyle}>
        <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
          {isGoodFeedback ? <span>
            Qu'est-ce qui {userYou("t'", 'vous ')}a le plus
            aidé{isFeminine ? 'e' : ''} dans {config.productName}&nbsp;?
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
    </div>
  }
}


class FeedbackStars extends React.Component {
  static propTypes = {
    isWhite: PropTypes.bool,
    onStarClick: PropTypes.func.isRequired,
    score: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    hoveredStars: 0,
  }

  renderTitle(numStars) {
    const {userYou} = this.props
    return feedbackTitle[numStars] ||
      `Que pense${userYou('s-tu', 'z-vous')} des conseils de ${config.productName}\u00A0?`
  }

  render() {
    const {isWhite, score} = this.props
    const {hoveredStars} = this.state
    const highlightedStars = hoveredStars || score || 0
    const starStyle = {
      cursor: 'pointer',
      height: 30,
      padding: 5,
    }
    const notOnMobile = callback => isMobileVersion ? null : callback
    const fullStar = isWhite ? whiteStarIcon : starIcon
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
          onClick={() => this.props.onStarClick(index + 1)}
          src={(index < highlightedStars) ? fullStar : starOutlineIcon} key={`star-${index}`} />)}
      </div>
    </div>
  }
}


export {FeedbackBar, FeedbackPage}
