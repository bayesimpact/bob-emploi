import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import ReactMarkdown, {ReactMarkdownOptions} from 'react-markdown'

import ExternalLink from 'components/external_link'


export interface MarkdownRendererProps {
  node?: unknown
  nodeKey?: string
}

// TODO(cyrille): Find a cleaner way to define this.
type MarkdownParagraphRendererProps = React.HTMLProps<HTMLDivElement> & MarkdownRendererProps

const SingleLineParagraphBase: React.FC<MarkdownParagraphRendererProps> =
({
  node: unusedNode,
  nodeKey: unusedNodeKey,
  value: unusedValue,
  ...otherProps
}: MarkdownParagraphRendererProps):
React.ReactElement => <div {...otherProps} />
const SingleLineParagraph = React.memo(SingleLineParagraphBase)


interface MarkdownLinkProps extends
  React.ComponentProps<typeof ExternalLink>, MarkdownRendererProps {
  value?: unknown
}


const MarkdownLinkBase =
({node: unusedNode, nodeKey: unusedNodeKey, value: unusedValue, ...linkProps}: MarkdownLinkProps):
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
Markdown.propTypes = {
  components: PropTypes.object,
  content: PropTypes.string,
  isSingleLine: PropTypes.bool,
}


export default React.memo(Markdown)
