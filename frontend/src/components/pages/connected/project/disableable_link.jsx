import {Link} from 'react-router-dom'
import React from 'react'

export const DisableableLink = properties => properties.to ?
  <Link {...properties} /> : <span {...properties} />
