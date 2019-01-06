import emojiRegex from 'emoji-regex'

// Clear markup so that we can use the text in PDF or other raw environments.
const clearMarkup = text => text.replace(/\*\*/g, '').
  replace(/\[([^\]]+)\](\([^)]*\))?/g, '$1')


const matchAllEmoji = emojiRegex()


// Clear Emoji characters.
const clearEmoji = text => text.replace(matchAllEmoji, '')


export {clearMarkup, clearEmoji}
