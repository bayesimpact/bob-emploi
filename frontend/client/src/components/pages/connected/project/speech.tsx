import React, {useMemo} from 'react'
import type {ReactMarkdownProps} from 'react-markdown/lib/complex-types'

import useFastForward from 'hooks/fast_forward'
import useKeyListener from 'hooks/key_listener'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import Markdown from 'components/markdown'
import type {ModalConfig} from 'components/modal'
import {Modal} from 'components/modal'
import bobHeadImage from 'images/bob-head.svg'


type BobPositionProps = {
  bobPosition?: 'bottom' | 'top'
  bobSize: number
} | {
  bobPosition: 'hidden'
  bobSize?: never
}


type ParagraphProps = {
  bobPosition?: 'bottom' | 'hidden' | 'top'
  bobSize?: number
  children: React.ReactNode
  index?: number
  siblingCount?: number
}


const paragraphContainerStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  display: 'flex',
}


const BobTalkParagraphBase = (props: ParagraphProps): React.ReactElement => {
  const {bobPosition = 'top', bobSize = 0, children, index = 0, siblingCount = 1} = props

  // Create a border-radius CSS property with small corners on the sides where another bubble is
  // right next to it, and on the corner where Bob is.
  const borderRadius = useMemo(
    (): string => [
      !!index || bobPosition === 'top',
      !!index,
      index < siblingCount - 1,
      index < (siblingCount - 1) || bobPosition === 'bottom',
    ].map((isSmall: boolean): string => isSmall ? '5px' : '15px').join(' '),
    [bobPosition, index, siblingCount],
  )

  const textStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.NEW_GREY,
    borderRadius,
    flex: 1,
    fontSize: 14,
    lineHeight: 1.43,
    marginLeft: bobPosition === 'hidden' ? 0 : bobSize + 13,
    marginTop: index ? 5 : 0,
    padding: '10px 15px',
  }), [bobPosition, bobSize, borderRadius, index])
  const bobStyle = useMemo((): React.CSSProperties => ({
    marginRight: -bobSize,
    width: bobSize,
    ...((bobPosition === 'bottom') ? {alignSelf: 'flex-end'} : undefined),
  }), [bobPosition, bobSize])
  const isBobShown = (bobPosition === 'top' && !index) ||
    (bobPosition === 'bottom' && index === siblingCount - 1)
  return <div style={paragraphContainerStyle}>
    {isBobShown ? <img src={bobHeadImage} alt="" style={bobStyle} /> : null}
    <div style={textStyle}>{children}</div>
  </div>
}
const BobTalkParagraph = React.memo(BobTalkParagraphBase)


function isString(a: React.ReactNode): a is string {
  return !!a && !!(a as string).split
}


type BobTalkProps = BobPositionProps & {
  // If children is a string, it is split into paragraphs.
  children: React.ReactNode
  style?: React.CSSProperties
}


const BobTalkBase = (props: BobTalkProps): React.ReactElement => {
  const {children, style, bobPosition, bobSize} = props
  const components = useMemo(() => {
    // False positive: we are memoizing the component already.
    // eslint-disable-next-line react/no-unstable-nested-components
    const Paragraph = (paragraphProps: ParagraphProps & ReactMarkdownProps):
    React.ReactElement => {
      const {node: omittedNode, ...props} = paragraphProps
      return <BobTalkParagraph {...{bobPosition, bobSize}} {...props} />
    }
    return {p: Paragraph}
  }, [bobPosition, bobSize])
  return <div style={style}>
    {isString(children) ? <Markdown
      content={children} includeElementIndex={true}
      components={components} /> :
      <BobTalkParagraph {...{bobPosition, bobSize}}>{children}</BobTalkParagraph>}
  </div>
}
const BobTalk = React.memo(BobTalkBase)


interface ModalProps extends ModalConfig {
  buttonText?: string
  isShown?: boolean
  onClose?: () => void
  onConfirm?: () => void
}


const modalStyle: React.CSSProperties = {
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
const imageStyle: React.CSSProperties = {
  display: 'block',
  width: 56,
}


const BobModal = (props: ModalProps): React.ReactElement => {
  const {buttonText, children, onClose, onConfirm, isShown} = props
  useKeyListener('Escape', onClose, undefined, 'keydown')
  useFastForward(onConfirm)
  // TODO(cyrille): Consider making a new button type of this.
  return <Modal isShown={isShown} style={modalStyle}>
    <div style={headerStyle}>
      <img src={bobHeadImage} alt={config.productName} style={imageStyle} />
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


export default React.memo(BobModal)
