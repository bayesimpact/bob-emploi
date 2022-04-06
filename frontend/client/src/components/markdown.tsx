import React, {useMemo} from 'react'
import type {ReactMarkdownProps} from 'react-markdown/lib/complex-types'
import type {Options as ReactMarkdownOptions} from 'react-markdown'
import ReactMarkdown from 'react-markdown'

import ExternalLink from 'components/external_link'


type PropsHelper<Element extends React.ElementType> =
  React.ComponentPropsWithoutRef<Element> & ReactMarkdownProps

export type MarkdownParagraphRendererProps = PropsHelper<'p'>

const oneLineParagraphStyle: React.CSSProperties = {
  display: 'block',
}

const SingleLineParagraphBase: React.FC<MarkdownParagraphRendererProps> =
({
  node: unusedNode,
  ...otherProps
}: MarkdownParagraphRendererProps):
React.ReactElement => <span style={oneLineParagraphStyle} {...otherProps} />
const SingleLineParagraph = React.memo(SingleLineParagraphBase)


export type MarkdownLinkProps = PropsHelper<'a'>


const MarkdownLinkBase = ({node: unusedNode, ...linkProps}: MarkdownLinkProps):
// eslint-disable-next-line jsx-a11y/anchor-has-content
React.ReactElement|null => <ExternalLink {...linkProps} />
const MarkdownLink = React.memo(MarkdownLinkBase)


interface Props extends Omit<ReactMarkdownOptions, 'children'> {
  content?: string
  isSingleLine?: boolean
}


const Markdown: React.FC<Props> = (props: Props): React.ReactElement|null => {
  const {components, content, isSingleLine, ...extraProps} = props
  const allComponents = useMemo(() => ({
    a: MarkdownLink,
    ...isSingleLine ? {p: SingleLineParagraph} : {},
    ...components,
  }), [components, isSingleLine])
  if (!content) {
    return null
  }
  return <ReactMarkdown components={allComponents} {...extraProps}>
    {content}
  </ReactMarkdown>
}


export default React.memo(Markdown)
