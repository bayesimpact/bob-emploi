import {existsSync, promises as fs} from 'fs'
import globSync from 'glob'
import path from 'path'
import {fileURLToPath} from 'url'
import {promisify} from 'util'

import JSON5 from 'json5'

import type {Plugin} from './cfg/plugins'
import {actOnPlugins} from './cfg/plugins'

/* eslint-disable no-console */
const ALLOWED_UNTHEMED_COLORS = new Set(['#fff', '#000'])
const ALLOWED_THEMED_NOT_COLORS = new Set(['transparent'])
const COLOR_REGEX = /#(?:[\da-f]{3}){1,2}(?:\b|$)/
const THEME_COLOR_REGEX = /colors[.-](\w+)/g
const FILE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'css']
const glob = promisify(globSync)

const readJSON5Colors = async (fileName: string): Promise<Record<string, string>> => {
  try {
    const content = await fs.readFile(fileName, {encoding: 'utf8'})
    return JSON5.parse(content)
  } catch {
    throw new Error(`Unable to parse color file "${fileName}"`)
  }
}

interface LineInfo {
  colno: number
  line: string
  lineno: number
}

const getLineInfo = (charIndex: number, fileContent: string): LineInfo => {
  const lines = fileContent.slice(0, charIndex).split('\n')
  const lineno = lines.length - 1
  return {
    colno: lines.slice(-1)[0].length,
    line: fileContent.split('\n', lineno + 1)[lineno],
    lineno,
  }
}

interface ColorMatch extends LineInfo {
  file: string
  name: string
}
const grepColorsInFiles = async (srcPath: string, pattern: RegExp):
Promise<readonly ColorMatch[]> => {
  const globalPattern = pattern.global ? pattern : new RegExp(pattern, 'g')
  const files = await glob(`${srcPath}/**/*.{${FILE_EXTENSIONS.join(',')}}`)
  const allMatch = await Promise.all(files.map(async (fileName) => {
    const content = await fs.readFile(fileName, {encoding: 'utf8'})
    return [...content.matchAll(globalPattern) as Iterable<RegExpExecArray>].
      map(({0: wholeMatch, 1: match = wholeMatch, index}) => ({
        ...getLineInfo(index, content),
        file: fileName,
        name: match,
      }))
  }))
  return allMatch.flat(1)
}

const checkPlugin = async ({name: pluginName, isCore, pluginPath, srcPath}: Plugin) => {
  console.log('Checking colors in plugin', pluginName, '…')
  const colorFile = path.join(pluginPath, 'cfg/colors.json5')
  if (!existsSync(colorFile)) {
    console.log('No color file in plugin', pluginName)
    if (isCore) {
      throw new Error('Core plugin should have a color file.')
    }
    return false
  }
  const colors = await readJSON5Colors(colorFile)
  const notAColor = Object.entries(colors).
    filter(([, value]) => !ALLOWED_THEMED_NOT_COLORS.has(value) && !COLOR_REGEX.test(value)).
    map((key) => key[1])
  if (notAColor.length) {
    throw new Error(
      `There are values in the colors config file that are not valid colors:
      "${notAColor.join('", "')}"`,
    )
  }
  const unthemedColors = await grepColorsInFiles(srcPath, COLOR_REGEX)
  const forbiddenUnthemedColors = unthemedColors.
    // Drop colors we actually allow.
    filter(({name}) => !ALLOWED_UNTHEMED_COLORS.has(name)).
    // Drop colors in import statements.
    filter(({line}) => !line.startsWith('import '))

  if (forbiddenUnthemedColors.length) {
    for (const {colno, file, lineno, name} of forbiddenUnthemedColors) {
      console.log(`${file}:${lineno}:${colno}`, name)
    }
    throw new Error('Some colors used in the plugin are not in the theme.')
  }
  const themeColors = await grepColorsInFiles(srcPath, THEME_COLOR_REGEX)
  const themeColorNames = new Set(themeColors.map(({name}) => name))
  const uselessColors = Object.keys(colors).filter(c => !themeColorNames.has(c))
  if (uselessColors.length) {
    throw new Error(`Some colors in the config are unused: ${uselessColors.join(', ')}`)
  }
  console.log('No color errors found in plugin', pluginName)
  return true
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  actOnPlugins(checkPlugin, 'check theme colors')(...process.argv.slice(2))
}
