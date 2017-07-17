import React from 'react'
import PropTypes from 'prop-types'

class UseCase extends React.Component {
  static propTypes = {
    useCase: PropTypes.object.isRequired,
  }

  render() {
    const {useCase} = this.props
    const boxStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      marginTop: 10,
      padding: 10,
    }
    const textareaStyle = {
      border: 'none',
      flex: 1,
      height: 600,
      width: '100%',
    }
    const json = JSON.stringify(useCase, null, 2).replace(/[{}",[\]]/g, '')
    return <div style={boxStyle}>
      <textarea value={json} readOnly={true} style={textareaStyle} />
    </div>
  }
}

export {UseCase}
