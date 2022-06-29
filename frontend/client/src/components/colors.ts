import type {ConfigColor} from 'config'

// Extract color components.
const colorToComponents = (color: ConfigColor|'#fff'|'#000'): [number, number, number] => {
  if (color.length === 7) {
    return [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ]
  }
  return [
    Number.parseInt(color.slice(1, 2), 16) * 0x11,
    Number.parseInt(color.slice(2, 3), 16) * 0x11,
    Number.parseInt(color.slice(3, 4), 16) * 0x11,
  ]
}

interface ColorHSL {
  hue: number
  lightness: number
  saturation: number
}

const colorToHSL = (color: ConfigColor): ColorHSL => {
  const [red, green, blue] = colorToComponents(color)
  const value = Math.max(red, green, blue) / 255
  const delta = value - Math.min(red, green, blue) / 255
  const lightness = (value + value - delta) / 2
  const saturation = value ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  let hue: number
  if (!delta) {
    hue = 0
  } else if (red >= green && red >= blue) {
    hue = 60 * (green - blue) / delta / 255
    if (hue < 0) {
      hue += 360
    }
  } else if (green >= red && green >= blue) {
    hue = 60 * ((blue - red) / delta / 255 + 2)
  } else {
    hue = 60 * ((red - green) / delta / 255 + 4)
  }
  return {hue, lightness, saturation}
}

// Inverse of colorToComponents.
const componentsToColor = (components: [number, number, number]): string =>
  '#' + components.map((n: number): string => n.toString(16)).join('')

// Change #rrggbb color to rgba(r, g, b, alpha)
const colorToAlpha = (color: ConfigColor|'#000'|'#fff'|undefined, alpha: number): string => {
  if (!color) {
    return ''
  }
  const [red, green, blue] = colorToComponents(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha === 0 ? 0 : alpha || 1})`
}

const changeColorLightness = (color: ConfigColor, lightnessDelta: number): string => {
  const {hue, saturation, lightness} = colorToHSL(color)
  const finalLightness = Math.round(Math.max(0, Math.min(100, lightness * 100 + lightnessDelta)))
  return `hsl(${Math.round(hue)}deg ${Math.round(saturation * 100)}% ${finalLightness}%)`
}

// Give a color between the two base colors, with linear interpolation.
const colorGradient = (
  color0: ConfigColor|'#fff', color1: ConfigColor|'#fff', rate: number): string => {
  const [components0, components1] = [color0, color1].map(colorToComponents)
  const [red, green, blue] = components0.map((component0, index): number =>
    Math.round(component0 * (1 - rate) + components1[index] * rate))
  return componentsToColor([red, green, blue])
}

export {
  changeColorLightness,
  colorGradient,
  colorToAlpha,
  colorToComponents,
  colorToHSL,
}
