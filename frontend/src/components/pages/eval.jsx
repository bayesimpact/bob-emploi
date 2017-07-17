import PropTypes from 'prop-types'
import React from 'react'
import {createProjectTitleComponents} from 'store/project'
import {computeAdvicesForProject, getEvalUseCasePoolNames, getEvalUseCases} from 'store/actions'

import {UseCase} from 'components/pages/eval/use_case'
import {AdvicesRecap} from 'components/pages/eval/advices_recap'
import {Select} from 'components/theme'

class EvalPage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }

  state = {
    advices: [],
    poolNames: [],
    selectedPoolIndex: 0,
    selectedUsedCaseIndex: 0,
    useCases: [],
  }

  componentWillMount() {
    const {dispatch} = this.props
    dispatch(getEvalUseCasePoolNames()).then(useCasePoolNames => {
      this.setState({poolNames: useCasePoolNames.useCasePoolNames || []}, this.fetchPoolUseCases)
    })
  }

  fetchPoolUseCases() {
    const {dispatch} = this.props
    const {poolNames, selectedPoolIndex} = this.state
    const selectedPoolName = poolNames[selectedPoolIndex]
    if (!selectedPoolName) {
      return
    }
    dispatch(getEvalUseCases(selectedPoolName)).then(({useCases}) => {
      this.setState({
        selectedUsedCaseIndex: 0,
        useCases: useCases || [],
      }, this.advise)
    })
  }

  advise = () => {
    const {dispatch} = this.props
    const {useCases, selectedUsedCaseIndex} = this.state
    const selectedUsedCase = useCases[selectedUsedCaseIndex]
    if (!selectedUsedCase) {
      return
    }
    return dispatch(computeAdvicesForProject(selectedUsedCase)).then(
      ({advices}) => this.setState({advices: advices || []})
    )
  }

  handlePoolChange = index => {
    this.setState({selectedPoolIndex: index}, this.fetchPoolUseCases)
  }

  handleUseCaseChange = index => {
    this.setState({selectedUsedCaseIndex: index}, this.advise)
  }

  render() {
    const {advices, selectedPoolIndex, selectedUsedCaseIndex, useCases, poolNames} = this.state
    const poolOptions = poolNames.map((poolName, index) => {
      return {name: poolName, value: index}
    })
    const useCasesOptions = useCases.map((useCase, index) => {
      const {profile, projects} = useCase
      const project = projects[0]
      const {what, where} = createProjectTitleComponents(project, profile.gender)
      return {name: index.toString() + ' - ' + what + ' ' + where, value: index}
    })
    const selectedUsedCase =
      selectedUsedCaseIndex < useCases.length && useCases[selectedUsedCaseIndex]
    const style = {
      display: 'flex',
      flexDirection: 'row',
    }
    const letfBarStyle = {
      display: 'flex',
      flexDirection: 'column',
      padding: 5,
      width: 400,
    }
    return <div style={style}>
      <div style={letfBarStyle}>
        <Select options={poolOptions} value={selectedPoolIndex}
          onChange={this.handlePoolChange} style={{backgroundColor: '#fff', marginBottom: 5}} />
        <Select options={useCasesOptions} value={selectedUsedCaseIndex}
          onChange={this.handleUseCaseChange} style={{backgroundColor: '#fff'}} />
        {selectedUsedCase &&
      <UseCase useCase={selectedUsedCase} />
        }
      </div>
      <div>
        <AdvicesRecap advices={advices} />
      </div>
    </div>
  }
}

export {EvalPage}
