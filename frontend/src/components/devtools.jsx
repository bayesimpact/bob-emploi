import React from 'react'
// Redux DevTools store enhancers and React components for Redux DevTools.
import {createDevTools} from 'redux-devtools'
import LogMonitor from 'redux-devtools-log-monitor'
import DockMonitor from 'redux-devtools-dock-monitor'

// createDevTools takes a monitor and produces a DevTools component.
const DevTools = createDevTools(
  // Monitors are individually adjustable with props.
  // Consult their repositories to learn about those props.
  // Here, we put LogMonitor inside a DockMonitor.
  <DockMonitor toggleVisibilityKey="ctrl-g"
               changePositionKey="ctrl-q"
               defaultIsVisible={false}>
    <LogMonitor theme="tomorrow" />
  </DockMonitor>
)

export default DevTools
