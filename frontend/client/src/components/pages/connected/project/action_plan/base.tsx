import _memoize from 'lodash/memoize'
import React, {useMemo} from 'react'

import isMobileVersion from 'store/mobile'

import {PageWithNavigationBar} from 'components/navigation'
import {SmoothTransitions} from 'components/theme'

export const contentWidth = isMobileVersion ? undefined : 440

const initialPageStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  backgroundColor: '#fff',
  display: 'flex',
  justifyContent: 'center',
  padding: '20px 20px 0',
}
const pageContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: contentWidth,
  width: '100%',
}
export const discussionStyle = {
  flexGrow: 1,
  flexShrink: 0,
  padding: '0 0 10px',
}
export const navButtonStyle = _memoize((isVisible = true): React.CSSProperties => ({
  ...!isVisible && {transform: 'translateY(100%)'},
  ...SmoothTransitions,
  alignSelf: 'flex-start',
}))


interface Props extends
  Omit<React.ComponentProps<typeof PageWithNavigationBar>, 'navBarContent' | 'page' | 'style'> {
  children: React.ReactNode
  page: string
  pageStyle?: React.CSSProperties
  style?: React.CSSProperties
  title?: string
}
const BasePage = ({children, page, pageStyle, style, title, ...otherProps}: Props) => {
  const contentStyle = useMemo(() => ({
    ...pageContainerStyle,
    ...style,
  }), [style])
  const finalPageStyle = useMemo(() => ({
    ...initialPageStyle,
    ...pageStyle,
  }), [pageStyle])
  return <PageWithNavigationBar
    {...otherProps} navBarContent={title} page={`action-plan-${page}`}
    style={finalPageStyle}>
    <div style={contentStyle}>
      {children}
    </div>
  </PageWithNavigationBar>
}

export default React.memo(BasePage)
