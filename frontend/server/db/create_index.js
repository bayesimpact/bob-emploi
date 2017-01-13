/* eslint-env mongo */
db.user.createIndex('facebookId')
db.user.createIndex('googleId')
db.user.createIndex('profile.email')
