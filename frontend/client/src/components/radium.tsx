// Module mimicking the simplest options of Radium.
// https://github.com/FormidableLabs/radium
// but without the extra complexity which makes it hard to use with HOC.
//
// Features:
//  - follow state of child (focused, hovered) and apply meta styles ':focus', ':hover'.
import React from 'react'
import {Link} from 'react-router-dom'


interface RadiumState {
  isHovered?: boolean
  isFocused?: boolean
}


// TODO(pascal): Templatize this and get rid of radium.
class RadiumLink extends React.PureComponent<Link['props'], RadiumState> {
  public state: RadiumState = {}

  private wrapOnCallback = (callbackName, state, newValue): ((e) => void) => (event): void => {
    this.setState({[state]: newValue})
    this.props[callbackName] && this.props[callbackName](event)
  }

  private handleMouseEnter = this.wrapOnCallback('onMouseEnter', 'isHovered', true)

  private handleMouseLeave = this.wrapOnCallback('onMouseLeave', 'isHovered', false)

  private handleFocus = this.wrapOnCallback('onFocus', 'isFocused', true)

  private handleBlur = this.wrapOnCallback('onBlur', 'isFocused', false)

  private getStyle(style): React.CSSProperties {
    const {isFocused, isHovered} = this.state
    if (!isFocused && !isHovered) {
      return style
    }
    return {
      ...style,
      ...isFocused ? style[':focus'] : {},
      ...isHovered ? style[':hover'] : {},
    }
  }

  public render(): React.ReactNode {
    const {style, ...extraProps} = this.props
    return <Link
      {...extraProps} style={this.getStyle(style)}
      onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}
      onFocus={this.handleFocus} onBlur={this.handleBlur}
    />
  }
}


// TODO(cyrille): Use this wherever applicable.
class RadiumExternalLink extends
  React.PureComponent<React.HTMLProps<HTMLAnchorElement>, RadiumState> {
  public state: RadiumState = {}

  private wrapOnCallback = (callbackName, state, newValue): ((e) => void) => (event): void => {
    this.setState({[state]: newValue})
    this.props[callbackName] && this.props[callbackName](event)
  }

  private handleMouseEnter = this.wrapOnCallback('onMouseEnter', 'isHovered', true)

  private handleMouseLeave = this.wrapOnCallback('onMouseLeave', 'isHovered', false)

  private handleFocus = this.wrapOnCallback('onFocus', 'isFocused', true)

  private handleBlur = this.wrapOnCallback('onBlur', 'isFocused', false)

  private getStyle(style): React.CSSProperties {
    const {isFocused, isHovered} = this.state
    if (!isFocused && !isHovered) {
      return style
    }
    return {
      ...style,
      ...isFocused ? style[':focus'] : {},
      ...isHovered ? style[':hover'] : {},
    }
  }

  public render(): React.ReactNode {
    const {style, ...extraProps} = this.props
    return <a
      {...extraProps} style={this.getStyle(style)} rel="noopener noreferrer" target="_blank"
      onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}
      onFocus={this.handleFocus} onBlur={this.handleBlur}
    />
  }
}


export {RadiumExternalLink, RadiumLink}
