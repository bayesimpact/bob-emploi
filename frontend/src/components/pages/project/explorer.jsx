import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {explorerIsShown, markNotificationAsSeen, scoreAdvice} from 'store/actions'

import {FastForward} from 'components/fast_forward'
import {InfoCollNotificationBox} from 'components/info_coll'
import {Modal} from 'components/modal'
import {Colors, Button, Styles} from 'components/theme'

import {AllAdviceSections} from './advice'


class SelectYourAdvicesModal extends React.Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {onClose, userYou, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const modalStyle = {
      borderRadius: 10,
      boxShadow: '0 10px 15px 0 rgba(0, 0, 0, 0.25)',
      color: Colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      margin: isMobileVersion ? '0 20px' : 'initial',
      maxWidth: 500,
      padding: isMobileVersion ? '30px 35px' : '43px 60px 50px',
    }
    const titleStyle = {
      fontSize: 25,
      fontWeight: 'bold',
      lineHeight: 1.12,
      marginBottom: isMobileVersion ? 30 : 50,
      textAlign: 'center',
    }
    return <Modal style={modalStyle} {...extraProps}>
      <FastForward onForward={onClose} />
      <div style={titleStyle}>{userYou('Choisis', 'Choisissez')} des conseils
      pour {userYou('ton', 'votre')} projet</div>
      <div style={{fontSize: 15, lineHeight: 1.47, marginBottom: isMobileVersion ? 30 : 50}}>
        <p>
          Nous avons sélectionné les conseils que nous pensons avoir <strong>le plus d'impact
          sur {userYou(' tes', ' vos')} chances de réussite</strong>.
        </p>
        <p>
          {userYou('Tu peux', 'Vous pouvez')} explorer ces différentes pistes
          et <strong>sélectionner</strong> celles sur lesquelles
          {userYou(' tu aimerais', ' vous aimeriez')} avancer et recevoir de l'aide
          concrète.
        </p>
      </div>
      <div style={{textAlign: 'center'}}>
        <Button onClick={onClose} isRound={true}>
          Je commence ma sélection
        </Button>
      </div>
    </Modal>
  }
}

class ExplorerBase extends React.Component {
  static propTypes = {
    adviceShownOnMount: PropTypes.string,
    dispatch: PropTypes.func,
    isInfoCollKitNotificationShown: PropTypes.bool,
    onSuggestClick: PropTypes.func.isRequired,
    onValidateSelection: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    scrollTo: PropTypes.func,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isSelectYourAdvicesModalShown: false,
  }

  componentWillMount() {
    const {dispatch, project} = this.props
    if (!project.advices.some(({score}) => score)) {
      // Do not set the state right away so that one can see the modal appearing.
      this.timeout = setTimeout(() => this.setState({isSelectYourAdvicesModalShown: true}), 100)
    }
    dispatch(explorerIsShown(project))
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  getClosestAdviceId(adviceId) {
    const {advices} = this.props.project
    if (!advices || !adviceId) {
      return null
    }
    // Exact match.
    if (advices.find(a => a.adviceId === adviceId)) {
      return adviceId
    }
    // Starts with.
    return advices.map(({adviceId}) => adviceId).find(a => a.startsWith(adviceId))
  }

  fastForward = () => {
    const {dispatch, onValidateSelection, project} = this.props
    const {advices} = project
    if (advices.some(({score}) => score)) {
      onValidateSelection()
      return
    }
    advices.forEach(advice =>
      Math.random() > .5 ? dispatch(scoreAdvice(project, advice, 10)) : null
    )
  }

  renderBottomAdviceSuggest() {
    const {onSuggestClick} = this.props
    const style = {
      backgroundColor: Colors.BOB_BLUE,
      boxShadow: '0 1px 7px 0 rgba(0, 0, 0, 0.1)',
      color: '#fff',
      fontSize: 16,
      overflow: 'hidden',
      padding: 10,
    }
    return <div style={style}>
      <div style={{alignItems: 'center', display: 'flex', margin: 'auto', maxWidth: 960}}>
        <span style={{flex: 1, ...Styles.CENTER_FONT_VERTICALLY}}>
          Participez à l'amélioration de Bob en partageant des idées de conseil !
        </span>
        <Button
          type="navigationOnImage"
          onClick={onSuggestClick}>
          Proposer un conseil
        </Button>
      </div>
    </div>
  }

  renderSelectBar(adviceSelection) {
    const {onValidateSelection} = this.props
    const numAdviceSelected = adviceSelection.size
    const maybeS = numAdviceSelected > 1 ? 's' : ''
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      color: Colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      height: 274,
      justifyContent: 'center',
      overflow: 'hidden',
      padding: '0 20px',
      textAlign: 'center',
    }
    const bigNumberStyle = {
      color: Colors.GREENISH_TEAL,
    }
    const buttonStyle = {
      fontSize: 15,
      height: 40,
      marginTop: 35,
    }
    const titleStyle = {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
    }
    if (!numAdviceSelected) {
      return <div style={containerStyle}>
        <div style={titleStyle}>Vous n'avez pas encore sélectionné de conseil</div>
        <div>Choisissez-en ci-dessus avant de pouvoir les approfondir</div>
      </div>
    }

    return <div style={containerStyle}>
      <div style={titleStyle}>
        Vous avez sélectionné
        <span style={bigNumberStyle}> {numAdviceSelected}&nbsp;conseil{maybeS}</span>
      </div>
      <div>
        C'est le moment d'avancer sur
        {numAdviceSelected === 1 ? ' cette piste' : ' ces pistes'}
      </div>
      <Button style={buttonStyle} onClick={onValidateSelection}>
        Avancer sur mes conseils maintenant
      </Button>
    </div>
  }

  render() {
    const {adviceShownOnMount, dispatch, isInfoCollKitNotificationShown, profile,
      project, scrollTo, userYou} = this.props
    const {isSelectYourAdvicesModalShown} = this.state
    const {advices} = project

    // TODO(cyrille): Clean this, it's broken, and we don't need it anymore.
    const existingAdviceShownOnMount = this.getClosestAdviceId(adviceShownOnMount)
    const adviceSelection = new Set();
    (advices || []).filter(advice => advice.score).
      forEach(({adviceId}) => adviceSelection.add(adviceId))
    return <div>
      <FastForward onForward={this.fastForward} />
      <SelectYourAdvicesModal
        isShown={isSelectYourAdvicesModalShown}
        onClose={() => this.setState({isSelectYourAdvicesModalShown: false})}
        userYou={userYou} />
      <AllAdviceSections
        advices={advices} adviceShownOnMount={existingAdviceShownOnMount}
        adviceSelection={adviceSelection} areSeparatorsShown={true} areCategoryTitlesShown={true}
        onSelectAdvice={advice => dispatch(scoreAdvice(project, advice, 10))}
        onUnselectAdvice={advice => dispatch(scoreAdvice(project, advice, 0))}
        style={{color: Colors.DARK_TWO}} {...{profile, project, scrollTo, userYou}} />
      {this.renderSelectBar(adviceSelection)}
      <InfoCollNotificationBox
        style={{zIndex: 3}} isShown={isInfoCollKitNotificationShown}
        onClose={() => dispatch(markNotificationAsSeen('infoCollKit'))} />
      {this.renderBottomAdviceSuggest()}
    </div>
  }
}
const Explorer = connect(({user}) => ({profile: user.profile}))(ExplorerBase)


export {Explorer}
