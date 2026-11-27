import { render } from 'solid-js/web'
import App from './App.jsx'
import './index.css'
import { initLang } from './lib/i18n'
import { applySavedTheme } from './lib/theme'

applySavedTheme()
initLang()

render(() => <App />, document.getElementById('root'))
