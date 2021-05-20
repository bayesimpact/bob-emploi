import React, {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react'

import {useAsynceffect} from 'store/promise'


const nameStyle: React.CSSProperties = {
  fontWeight: 'bold',
  pointerEvents: 'none',
}

const Path: React.FC<React.SVGProps<SVGPathElement>> = (props: React.SVGProps<SVGPathElement>) => {
  const {d, name} = props
  const [isHovered, setIsHovered] = useState(false)
  const [center, setCenter] = useState<{x?: number; y?: number}>({})
  const pathEl = useRef<SVGPathElement>(null)
  const hover = useCallback(() => setIsHovered(true), [])
  const unhover = useCallback(() => setIsHovered(false), [])
  useLayoutEffect(() => {
    if (!pathEl.current && d) {
      // Take the initial point from path.
      const [x, y] = d.split(' ')[1].split(',').map(Number.parseFloat)
      setCenter({x, y})
      return
    }
    if (!pathEl.current) {
      return
    }
    // Take the middle of the bounding box.
    const {height, width, x, y} = pathEl.current.getBBox() || {}
    setCenter({
      x: x + width / 2,
      y: y + height / 2,
    })
  }, [d])

  return <React.Fragment>
    <path
      stroke="#000" fill="#fff"
      onMouseOver={hover} onMouseOut={unhover}
      ref={pathEl} {...props} />
    {isHovered ?
      <text
        id="caption" alignmentBaseline="central" textAnchor="middle"
        style={nameStyle} z={1} x={center.x} y={center.y} >
        {name}
      </text> : null}
  </React.Fragment>
}


interface AreaProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  areaProps: {[departementId: string]: Omit<React.SVGProps<SVGPathElement>, 'ref'>}
  mapName: string
  pathProps?: Omit<React.SVGProps<SVGPathElement>, 'ref'>
  sortFunc?: (departementIdA: string, departementIdB: string) => number
}

interface MapData {
  readonly areas: readonly {
    readonly id: string
    readonly name: string
    readonly d: string
  }[]
  readonly height: number
  // Name of the SVG file in images/maps.
  readonly mapName: string
  readonly title: string
  readonly width: number
}

const Map: React.FC<AreaProps> = (props: AreaProps): React.ReactElement|null => {
  const {areaProps, mapName, pathProps, sortFunc, ...svgProps} = props
  const [map, setMap] = useState<MapData|null>(null)
  useAsynceffect(async (checkIfCanceled) => {
    const {default: districtsImageUrl} =
      await import(/* webpackChunkName: 'map-' */`images/maps/${mapName}.svg?original`)
    const districtsImageResponse = await fetch(districtsImageUrl)
    const svgAsText = await districtsImageResponse.text()
    if (checkIfCanceled()) {
      return
    }
    const svgAsDom = new DOMParser().parseFromString(svgAsText, 'text/xml')
    const svg = svgAsDom.documentElement
    const titleElement = [...svg.children].
      find(({tagName}) => tagName.toLowerCase() === 'title')
    setMap({
      areas: [...svgAsDom.getElementsByTagName('path')].
        filter(({id}) => !!id).
        map((path) => ({
          d: path.getAttribute('d') || '',
          id: path.id,
          name: path.getElementsByTagName('title')[0]?.innerHTML || '',
        })),
      height: Number.parseInt(svg.getAttribute('height') || '600', 10),
      mapName,
      title: titleElement?.innerHTML || '',
      width: Number.parseInt(svg.getAttribute('width') || '600', 10),
    })
  }, [mapName])
  const paths = useMemo(() => {
    if (!map) {
      return []
    }
    const rawAreas = map.areas.map(({d, id, name}): React.ReactElement =>
      <Path d={d} name={name} id={id} key={id} {...pathProps} {...areaProps[id]} />)
    if (sortFunc) {
      rawAreas.sort(({key: keyA}, {key: keyB}): number =>
        sortFunc(keyA as string, keyB as string))
    }
    return rawAreas
  }, [pathProps, areaProps, map, sortFunc])
  if (!map || map.mapName !== mapName) {
    return null
  }
  return <svg
    xmlns="http://www.w3.org/2000/svg"
    aria-label={map.title}
    viewBox={`0 0 ${map.width} ${map.height}`}
    width={map.width}
    height={map.height} {...svgProps}>
    {paths}
    <use xlinkHref="#caption" />
  </svg>
}

export default React.memo(Map)
