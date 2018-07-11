import PropTypes from 'prop-types'
import React from 'react'


class StationDisplay extends React.Component {
  static propTypes = {
    children: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  static defaultProps = {
    height: 40,
  }

  renderChar = (n, index, style) => {
    const {height} = this.props
    return <div key={index} style={{
      backgroundColor: colors.DARK_TWO,
      borderRadius: height / 8,
      color: '#fff',
      fontSize: height / 2,
      fontWeight: 'bold',
      height,
      lineHeight: `${height}px`,
      overflow: 'hidden',
      position: 'relative',
      textAlign: 'center',
      verticalAlign: 'middle',
      width: height * 5 / 8,
      ...style}}>
      {n}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, .11)',
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: '50%',
      }} />
    </div>
  }

  render() {
    const {children, height, style} = this.props
    return <div style={{display: 'flex', ...style}}>
      {children.split('').map((c, index) =>
        this.renderChar(c, index, index ? {marginLeft: height / 5} : {}))}
    </div>
  }
}
export {StationDisplay}
