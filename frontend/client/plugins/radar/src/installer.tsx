import React from 'react'

import ExternalLink from 'components/external_link'
import BookmarkletInstallation from 'components/bookmarklet_installation'
import Button from 'components/button'
import icon from 'images/milo-favicon.png'
import guide from 'images/milo_radar_guide.pdf'

const bookmarklet = {
  entry: 'imilo-to-radar',
  functionName: 'imilo2radar',
  icon,
  title: config.radarProductName,
}

const centeredStyle: React.CSSProperties = {
  alignSelf: 'center',
  marginBottom: 20,
}
const RadarInstaller = (): React.ReactElement =>
  // TODO(cyrille): Update the animated gifs for the different demos.
  <BookmarkletInstallation
    goal={`utiliser ${bookmarklet.title}`} page="radar-installer" bookmarklet={bookmarklet}>
    <ExternalLink style={centeredStyle} href={guide}>
      <Button type="navigation">Télécharger le guide</Button>
    </ExternalLink>
  </BookmarkletInstallation>
export default React.memo(RadarInstaller)
