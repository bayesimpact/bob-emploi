# Bob Emploi Web Application

Bob Emploi is a React Single Page Application with a RESTful JSON API written in Python. The application is backed by a MongoDB which serves data that we pre-computed using the Python data science stack. This README provides detailed instructions of how to build and run the application locally and furthermore explains the design of the application. If you experience any problems, please use our [mailing list](https://groups.google.com/forum/#!forum/bob-emploi) to get help.

## Application Design

The frontend is implemented as a [React](https://facebook.github.io/react/) single page application. It uses [Webpack](https://webpack.github.io/) as a build system and [Redux](http://redux.js.org/) to handle application state. Styling of HTML elements is done via inline styling directly in the React components. Some CSS can also be found in the file `App.css`.

The server part of the application is written in Python and implements a RESTful API using the [Flask Microframework](http://flask.pocoo.org/). 

The Google [Protobuffer language](https://developers.google.com/protocol-buffers/) is used to define language-neutral data structures that can easily be exchanged between the client, the server and the database.

The application data is stored in a [MongoDB](https://www.mongodb.com/) which is partly populated by data pre-computed from our datasets. These data-analysis and processing scripts will be open sourced in a next step. We have however provided fixtures for all collections so that the application is usable out of the box without the need to locally run any importers. 

## Local Development

After installing Docker as described in the main README of this repository, `docker-compose` can be used to build an run the application for local development. Note that the first execution downloads images and builds the containers, which might take some time.

* `docker-compose up -d frontend-dev`: run the web application in development mode (instant reloading when files change on disk). The application will be available on http://localhost:3000.
* `docker-compose run --no-deps frontend-dev-webpack npm test`: run the javascript frontend tests.
* `docker-compose run --no-deps frontend-dev-webpack npm run lint`: run the javascript linter.
* `docker-compose run --no-deps frontend-flask-test ./lint_and_test.sh`: run the server tests in combination with the Python linter.

## Code Layout

We will in the future add a more detailed explanation of the layout of the code, in order to make it easy to navigate. For now we simply point to the right entry points from which it should be possible to find your way into the modules of interest.

* `frontend/src/components/pages/main.jsx`: javascript client code.
* `frontend/src/store`: Redux store and client side data models.
* `frontend/server/server.py`: Python server code.
* `frontend/cfg`: client side build system.
* `frontend/server.js` development server.
* `server/api` business logic data structures.

## Tips & Tricks

* To inspect the current state of the Redux store, press `ctrl-g` anywhere in the application.
* As the above mentioned fixtures don't cover data for most of the jobs we recommend to create a user that searches a job as a _Data Scientist_ in _Lyon_. All functionality should be available for such a user and professional project.