import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { appName } from './config'
import './style.css'

document.title = `${appName} — WhatsApp Notification Gateway`
const description = document.querySelector('meta[name="description"]')
if (description) {
  description.content = `${appName} — Modern WhatsApp Notification Gateway. Send messages, manage devices, and track delivery with ease.`
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
