const fs = require('fs')
const glob = require('glob')
const path = require('path')

// Keep it very temporary if possible.
const knownUnusedImages = [
].sort()


function listAllImages(callback) {
  fs.readdir(path.join(__dirname, '../src/images'), (err, files) => {
    if (err) {
      throw err
    }
    callback(files)
  })
}


function listUsedImages(callback) {
  glob(path.join(__dirname, '../src/components/**/*.js*'), (err, files) => {
    if (err) {
      throw err
    }
    const usedImages = {}
    let filesDone = 0
    files.forEach(file => fs.readFile(file, 'utf-8', (err, data) => {
      if (err) {
        throw err
      }
      const imageRegex = /require\('images\/([^']*)'/g
      let match
      do {
        match = imageRegex.exec(data)
        if (match) {
          usedImages[match[1]] = true
        }
      } while (match)
      if (++filesDone === files.length) {
        callback(usedImages)
      }
    }))
  })
}


listAllImages(allImages => {
  listUsedImages(usedImages => {
    const unusedImages = allImages.filter(i => !usedImages[i]).sort()
    const unusedImagesList = `'${unusedImages.join("',\n'")}',`
    unusedImages.forEach((image, index) => {
      if (index >= knownUnusedImages.length || image < knownUnusedImages[index]) {
        throw `Unused image: "${image}"\n${unusedImagesList}`
      }
      const knownImage = knownUnusedImages[index]
      if (image > knownImage) {
        throw `Remove "${knownImage}" from the knownUnusedImages list.\n${unusedImagesList}`
      }
    })
    if (knownUnusedImages.length > unusedImages.length) {
      throw `Remove "${knownUnusedImages[unusedImages.length]}" from the knownUnusedImages list.`
    }
  })
})
