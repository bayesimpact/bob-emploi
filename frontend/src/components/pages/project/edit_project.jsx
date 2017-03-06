import React from 'react'
import {connect} from 'react-redux'
import _ from 'underscore'

import {CircularProgress} from 'components/progress'
import {fetchPotentialChantiers, setProjectProperty,
        POST_USER_DATA, GET_POTENTIAL_CHANTIERS} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user_reducer'
import {Modal} from 'components/modal'
import {NewProjectCriteriaStep} from 'components/pages/profile/criteria'
import {NewProjectExperienceStep} from 'components/pages/profile/experience'
import {NewProjectJobsearchStep} from 'components/pages/profile/jobsearch'


const STEPS = [
  {component: NewProjectCriteriaStep},
  {component: NewProjectExperienceStep},
  {component: NewProjectJobsearchStep},
]


class EditProjectModalBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isFetchingChantiers: React.PropTypes.bool,
    isSavingChanges: React.PropTypes.bool,
    isShown: React.PropTypes.bool.isRequired,
    onClose: React.PropTypes.func,
    project: React.PropTypes.object.isRequired,
    userProfile: USER_PROFILE_SHAPE,
  };
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  };

  state = {
    currentStep: 1,
    hasProjectChanged: false,
  }

  handleClose = () => {
    const {dispatch, onClose, project} = this.props

    const close = () => {
      this.setState({currentStep: 1, hasProjectChanged: false})
      onClose && onClose()
    }

    if (!this.state.hasProjectChanged) {
      close()
      return
    }
    dispatch(fetchPotentialChantiers(project.projectId)).
      then(close)
  }

  handleSubmit = newProjectUpdates => {
    const {currentStep} = this.state
    const {dispatch, project} = this.props
    const isLastStep = currentStep === STEPS.length

    const nextStep = () => {
      if (isLastStep) {
        this.handleClose()
      } else {
        this.setState({currentStep: currentStep + 1})
      }
    }

    const validUpdates = _.pick(newProjectUpdates, value => !!value)
    const oldValues = _.pick(project, Object.keys(validUpdates))
    if (_.isEqual(oldValues, validUpdates)) {
      nextStep()
      return
    }
    this.setState({hasProjectChanged: true})
    dispatch(setProjectProperty(project.projectId, newProjectUpdates, true)).
      then(nextStep)
  }

  handleBack = () => {
    const {currentStep} = this.state
    if (currentStep > 1) {
      this.setState({currentStep: currentStep - 1})
    }
  }

  render () {
    const {isShown, project, userProfile, isSavingChanges, isFetchingChantiers} = this.props
    const {isMobileVersion} = this.context
    const {currentStep} = this.state
    const spinnerBoxStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      marginBottom: 20,
      marginTop: 50,
    }
    const modalStyle = {
      display: 'flex',
      flexDirection: 'column',
      width: isMobileVersion ? 'inherit' : 480,
    }
    let content
    if (isSavingChanges || isFetchingChantiers) {
      content = <div style={spinnerBoxStyle}>
        <CircularProgress />
        <div style={{marginTop: 20}}>
          {isSavingChanges ?
            'Enregistrement des modifications' : 'Prise en compte des modifications'
          }
        </div>
      </div>
    } else if (!isShown) {
      content = null
    } else {
      const currentStepItem = STEPS[currentStep-1]
      const CurrentStepComponent = currentStepItem && currentStepItem.component
      content = <CurrentStepComponent
          isShownDuringEdit={true}
          onSubmit={this.handleSubmit}
          onPreviousButtonClick={currentStep > 1 ? this.handleBack : null}
          profile={userProfile}
          newProject={project}
          explanation={`Étape ${currentStep}/${STEPS.length}`}
          onClose={this.handleClose}
          title="Modifier votre plan d'action"
          style={{flex: 1, width: 'inherit'}} />
    }
    return <Modal
        isShown={isShown}
        onClose={this.handleClose} style={modalStyle}>
      {content}
    </Modal>
  }
}
const EditProjectModal = connect(({asyncState, user}) => ({
  isFetchingChantiers: asyncState.isFetching[GET_POTENTIAL_CHANTIERS],
  isSavingChanges: asyncState.isFetching[POST_USER_DATA],
  userProfile: user.profile,
}))(EditProjectModalBase)


export {EditProjectModal}
