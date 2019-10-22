// Module mimicking the simplest options of Radium.
// https://github.com/FormidableLabs/radium
// but without the extra complexity which makes it hard to use with HOC.
//
// Features:
//  - follow state of child (focused, hovered) and apply meta styles ':focus', ':hover'.
import PropTypes from 'prop-types'
import Radium from 'radium'
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
      ...isFocused && style ? style[':focus'] : {},
      ...isHovered && style ? style[':hover'] : {},
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


interface RadiumProps<HTMLElement> extends Omit<React.HTMLProps<HTMLElement>, 'ref'> {
  style?: RadiumCSSProperties
}

// TODO(cyrille): Use this wherever applicable.
class RadiumExternalLink extends
  React.PureComponent<RadiumProps<HTMLAnchorElement>, RadiumState> {
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
      ...isFocused && style ? style[':focus'] : {},
      ...isHovered && style ? style[':hover'] : {},
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


const RadiumDiv = React.memo(Radium((props: React.HTMLProps<HTMLDivElement>) => <div {...props} />))


const RadiumSpan =
  React.memo(Radium((props: React.HTMLProps<HTMLSpanElement>) => <span {...props} />))


export type SmartLinkProps =
  | RadiumProps<HTMLSpanElement>
  | RadiumProps<HTMLAnchorElement>
  | Link['props']

// TODO(cyrille): Use wherever applicable.
const SmartLinkBase: React.FC<SmartLinkProps> =
({style, ...props}): React.ReactElement => {
  const linkStyle: RadiumCSSProperties = {
    color: 'inherit',
    cursor: 'pointer',
    textDecoration: 'none',
    ...style,
  }
  return (props as Link['prop']).to ? <RadiumLink {...props} style={linkStyle} /> :
    (props as RadiumProps<HTMLAnchorElement>).href ?
      <RadiumExternalLink {...props} style={linkStyle} /> :
      <RadiumSpan {...props} style={linkStyle} />
}
SmartLinkBase.propTypes = {
  href: PropTypes.string,
  style: PropTypes.object,
  to: PropTypes.string,
}
const SmartLink = React.memo(SmartLinkBase)

export {SmartLink, RadiumDiv, RadiumExternalLink, RadiumLink, RadiumSpan}
