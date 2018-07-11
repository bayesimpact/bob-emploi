import _omit from 'lodash/omit'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'


function postOpen(url, target) {
  var form = document.createElement('form')
  form.setAttribute('method', 'post')
  form.setAttribute('action', url)
  form.setAttribute('target', target)
  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}


class DashboardExportCreatorBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    userId: PropTypes.string.isRequired,
  }

  handleClick = event => {
    event.stopPropagation()
    postOpen('/api/dashboard-export/open/' + this.props.userId)
  }

  render() {
    const {children, ...otherProps} = this.props
    return <div {..._omit(otherProps, ['disatch', 'userId'])} onClick={this.handleClick}>
      {children}
    </div>
  }

}
const DashboardExportCreator = connect(({user}) => ({userId: user.userId}))(
  DashboardExportCreatorBase)


export {DashboardExportCreator}
