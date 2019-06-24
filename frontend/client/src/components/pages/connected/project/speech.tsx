import PropTypes from 'prop-types'
import React from 'react'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {ShortKey} from 'components/shortkey'
import {Button, Markdown} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


interface ParagraphProps {
  bobPosition: 'bottom' | 'hidden' | 'top'
  bobSize?: number
  children: React.ReactNode
  index: number
  parentChildCount: number
}


class BobTalkParagraph extends React.PureComponent<ParagraphProps> {
  public static propTypes = {
    bobPosition: PropTypes.oneOf(['bottom', 'hidden', 'top']).isRequired,
    bobSize: PropTypes.number,
    children: PropTypes.node.isRequired,
    index: PropTypes.number.isRequired,
    parentChildCount: PropTypes.number.isRequired,
  }

  public static defaultProps = {
    bobPosition: 'top',
    index: 0,
    parentChildCount: 1,
  }

  // Create a border-radius CSS property with small corners on the sides where another bubble is
  // right next to it, and on the corner where Bob is.
  private computeBorderRadius(index: number, indexMax: number): string {
    const {bobPosition} = this.props
    return [
      index || bobPosition === 'top',
      index,
      index < indexMax,
      index < indexMax || bobPosition === 'bottom',
    ].map((isSmall: boolean): string => isSmall ? '5px' : '15px').join(' ')
  }

  public render(): React.ReactNode {
    const {bobPosition, bobSize, children, index, parentChildCount} = this.props
    const containerStyle: React.CSSProperties = {
      alignItems: 'flex-start',
      display: 'flex',
    }
    const textStyle: React.CSSProperties = {
      backgroundColor: colors.NEW_GREY,
      borderRadius: this.computeBorderRadius(index, parentChildCount - 1),
      flex: 1,
      fontSize: 14,
      lineHeight: 1.43,
      marginLeft: bobPosition === 'hidden' ? 0 : bobSize + 13,
      marginTop: index ? 5 : 0,
      padding: '10px 15px',
    }
    const bobStyle: React.CSSProperties = {
      marginRight: -bobSize,
      width: bobSize,
    }
    if (bobPosition === 'bottom') {
      bobStyle.alignSelf = 'flex-end'
    }
    const isBobShown = (bobPosition === 'top' && !index) ||
      (bobPosition === 'bottom' && index === parentChildCount - 1)
    return <div style={containerStyle}>
      {isBobShown ? <img src={bobHeadImage} alt="" style={bobStyle} /> : null}
      <div style={textStyle}>{children}</div>
    </div>
  }
}


function isString(a: React.ReactNode): a is string {
  return !!a && !!(a as string).split
}


interface BobTalkProps {
  bobSize?: number
  style?: React.CSSProperties
}


class BobTalk extends React.PureComponent<BobTalkProps> {
  public static propTypes = {
    // If children is a string, it is split into paragraphs.
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]).isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    bobPosition: 'top',
  }

  public render(): React.ReactNode {
    const {children, style, ...otherProps} = this.props
    return <div style={style}>
      {isString(children) ? <Markdown
        content={children} includeNodeIndex={true}
        renderers={{
          paragraph: (props): React.ReactElement => <BobTalkParagraph {...otherProps} {...props} />,
        }} /> :
        <BobTalkParagraph {...otherProps}>{children}</BobTalkParagraph>}
    </div>
  }
}


interface ModalProps extends ModalConfig {
  buttonText?: string
  isShown?: boolean
  onClose?: () => void
  onConfirm?: () => void
}


class BobModal extends React.PureComponent<ModalProps> {
  public static propTypes = {
    buttonText: PropTypes.string,
    children: PropTypes.node,
    isShown: PropTypes.bool,
    onClose: PropTypes.func,
    onConfirm: PropTypes.func,
  }

  public render(): React.ReactNode {
    const {buttonText, children, onClose, onConfirm, isShown} = this.props
    const modalStyle = {
      fontSize: 13,
      lineHeight: 1.5,
      margin: 20,
      maxWidth: 480,
    }
    // TODO(cyrille): Add boxShadow when content is scrolled down.
    const headerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'bold',
      padding: '35px 15px 10px',
    }
    const bodyStyle: React.CSSProperties = {
      padding: '15px 65px 35px',
    }
    const buttonsStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'center',
      margin: '35px auto 0',
    }
    // TODO(cyrille): Consider making a new button type of this.
    return <Modal isShown={isShown} style={modalStyle}>
      <ShortKey keyCode="Escape" onKeyDown={onClose} />
      <FastForward onForward={onConfirm} />
      <div style={headerStyle}>
        <img src={bobHeadImage} alt={config.productName} style={{display: 'block', width: 56}} />
        {config.productName}
      </div>
      <div style={bodyStyle}>
        <BobTalk bobPosition="hidden">{children}</BobTalk>
        <div style={buttonsStyle}>
          <Button type="validation" onClick={onConfirm}>
            {buttonText}
          </Button>
          {onClose ? <React.Fragment>
            <div style={{height: 10, width: 25}} />
            <Button type="discreet" onClick={onClose}>Plus tard</Button>
          </React.Fragment> : null}
        </div>
      </div>
    </Modal>
  }
}


export {BobModal, BobTalk}
