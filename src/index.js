import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import {
  createStore,
  applyMiddleware,
  bindActionCreators,
  combineReducers
} from 'redux'
import {Provider, connect} from 'react-redux'
import createSagaMiddleware, {delay} from 'redux-saga'
import {
  takeEvery,
  call,
  put,
  all,
  fork,
  cancel,
  take
} from 'redux-saga/effects'

//-----------------------------------------------
//          INITIAL STATE OF OUR APP
//    ...this is passed to reducers way below
//-----------------------------------------------

const initialState = {
  pictures: {
    cage: {w: 50, h: 50},
    murray: {w: 50, h: 50},
    question: {w: 50, h: 50}
  },
  rounds: {
    correct: 0,
    played: 0,
    open: true
  },
  timer: {
    status: 'Stopped',
    seconds: 0
  }
}

//----------------------------------------------------
//    REDUX STORE AND MIDDLEWARE (SAGAS) SETUP
//----------------------------------------------------

const sagaMiddleware = createSagaMiddleware()

// creates an object that looks like the initial state above
const reducer = combineReducers({pictures, rounds, timer})

const store = createStore(
  reducer,
  applyMiddleware(sagaMiddleware)
)

sagaMiddleware.run(rootSaga)


//----------------------------------------------------
//                ACTION CREATORS
//----------------------------------------------------

//  what does an action creator always return? must it have a type?
//  could we just do this instead store.dispatch({type: RESET})?
const reset = () => ({type: 'RESET_PLAY'})
const choosePicture = isCorrect => ({type: 'CHOOSE_PICTURE', isCorrect})
const setPixels = pixels => ({type: 'SET_PIXELS', pixels})

// notice that action types are string values; to prevent bugs these are typically turned into constants
// and exported to other files but hey...this is only one file


//----------------------------------------------------
//                    API
// ---------------------------------------------------

const actors = {
  murray: {
    url: (w, h) => `https://www.fillmurray.com/${w}/${h}`,
    name: 'murray'
  },
  cage: {
    url: (w, h) => `http://www.placecage.com/c/${w}/${h}`,
    name: 'cage'
  }
}


//----------------------------------------------------
//                HALF-ASSED HELPERS
//    ..don't bother with these, used in the sagas
// ---------------------------------------------------

//but hey why are they not just inside the sagas?

const getRandomNum = (max, min) =>
  Math.floor(Math.random() * max) + min

const getRandomPixels = () => ({
  w: getRandomNum(800, 25),
  h: getRandomNum(600, 25),
})

const getNewPictures = () => Object.keys(actors).reduce(
  (pictures, actor) => {
    pictures[actor] = getRandomPixels();
    return pictures
  }, {})

const getRandomPicture = pictures =>
  pictures[Object.keys(pictures)[getRandomNum(2, 0)]]


//----------------------------------------------------
//                  REDUX SAGAS
//    ..don't bother with these, used in the sagas
// ---------------------------------------------------

// what does a the yield key word do?
// what seems to be the point of using 'call' and 'put' (not just calling the function directly)?
// what happens if a call errors out?
function* createRound() {
  const pixels = yield call(getNewPictures)
  const question = yield call(getRandomPicture, pixels)
  const pixelsWithAnswer = {...pixels, question}
  yield put(setPixels(pixelsWithAnswer))
  yield put({type: 'OPEN_PLAY'})
  yield put({type: 'START_TIMER'})
}
// this while(true) pattern is equivalent to 'takeEvery' helper seen below
function* tick() {
  while(true) {
    yield call(delay, 1000);
    yield put({type: 'TICK_TIMER'});
  }
}

function* watchTimer() {
  while(true) {
    yield take('START_TIMER')
    // starts the task in the background
    const backgroundTask = yield fork(tick)

    yield take('STOP_TIMER')
    // user clicked stop. cancel the background task
    // this will throw a SagaCancellationException into task (see console)
    yield cancel(backgroundTask)
  }
}

function* handleChoice({isCorrect}) {
  yield put({type: 'STOP_TIMER'})
  const correct = isCorrect ? 1 : 0
  yield put({type: 'RECORD_PLAY', correct})
}

function* watchRounds() {
  yield takeEvery('RESET_PLAY', createRound)
}

function* watchChoices() {
  yield takeEvery('CHOOSE_PICTURE', handleChoice)
}

// this is composes all our sagas to be passed to redux to use as middleware
function* rootSaga() {
  yield all([
    watchRounds(),
    watchChoices(),
    watchTimer()
  ])
}


//----------------------------------------------------
//                  REDUCERS
// ---------------------------------------------------

// do you understand the use of spread operators {...rounds, stuff} below? why not rounds.correct = true?
function rounds(rounds = initialState.rounds, action = {}) {
  switch (action.type) {
    case 'RECORD_PLAY':
      return {
      ...rounds,
      correct: rounds.correct + action.correct,
      played: rounds.played + 1,
      open: false
    }
    case 'OPEN_PLAY':
      return {
      ...rounds,
      open: true
    }
    default:
      return rounds
  }
}

// do we really need a switch statement in case such as this with one action type?
function pictures(pictures = initialState.pictures, action = {}) {
  switch (action.type) {
    case 'SET_PIXELS':
      return {
        ...pictures,
        ...action.pixels
      }
    default:
      return pictures
  }
}

function timer(time = initialState.timer, action) {
  switch (action.type) {
    case 'START_TIMER':
      return {seconds: 0, status: 'Running'}
    case 'STOP_TIMER':
      return {...time, status: 'Stopped'}
    case 'TICK_TIMER':
      return {...time, seconds: time.seconds + 1}
    default:
      return time
  }
}


//----------------------------------------------------
//              REACT COMPONENT WITH CONNECT
// ---------------------------------------------------

//why do we need a class here and not just a function? Could we change it to use a plain function?
class App extends Component {

  //this is the life cycle hook we use for initialization and data fetching
  //what other hooks do you notice are used a lot in react code?
  componentDidMount() {
    //how did this reset action creator get to be a prop?
    this.props.reset()
  }
  //notice this is different type of function (assigned to a property) than the class method above
  //this style ensures us that the this key word is bound
  handleSelection = (choice, actor) => () => {
    const answer = Object.keys(actors).filter(act => this.props.pics[act] === choice)
    const correct = answer[0] === actor
    this.props.choosePicture(correct)
  }

  render() {
    //what will happen below if question is undefined?
    const {pics, seconds, rounds} = this.props
    const {question} = pics
    //any reason we might not want to initialize this object in the render method?
    const btnStyle = rounds.open ? {} : {background: 'grey'}

    return (
      <div className="main">
        <p>
          <strong>Instructions: </strong>
          does Murray or Cage represent the width and height in the button
        </p>
        <h2>Played: {rounds.played}</h2>
        <h2>Correct: {rounds.correct}</h2>
        <h2>Time: {seconds} sec.</h2>
        <button onClick={this.props.reset}>Next</button>
        <div className="actors-container">
          {Object.keys(actors).map((key, i) => {
            const actor = actors[key];
            const pixels = pics[key];
            return (
              <div className="actor" key={i}>
                <img
                  src={actor.url(pixels.w, pixels.h)}
                  alt={actor.name}
                />
                <button
                  onClick={this.handleSelection(question, actor.name)}
                  disabled={!rounds.open}
                  style={btnStyle}
                >
                  {question.w} x {question.h}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
// is this different from const mapStateToProps = state => { return {pics: state,pics, seconds: state.seconds, rounds: state.rounds}}?
const mapStateToProps = state => ({
  pics: state.pictures,
  seconds: state.timer.seconds,
  rounds: state.rounds
})

//what is this bindActionCreators helper doing for us (see this.props.reset question above)?
const mapDispatchToProps = dispatch =>
  bindActionCreators({reset, choosePicture}, dispatch);

//what does connect do for us? Does it need to always take two functions?
const ConnectedApp = connect(mapStateToProps, mapDispatchToProps)(App)

//what is the Provider helper do for us (alternative is store.subscribe(renderer)?
ReactDOM.render(
  <Provider store={store}>
    <ConnectedApp />
  </Provider>, document.getElementById('root')
)

