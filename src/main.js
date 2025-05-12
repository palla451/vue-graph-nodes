import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import VNetworkGraph from "v-network-graph"
import 'v-network-graph/lib/style.css'
const app = createApp(App)
app.use(VNetworkGraph);
app.use(createPinia())
app.use(router)

app.mount('#app')
