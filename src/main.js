import App from "./App.vue";
import { createApp } from "vue";
import "./style.css";
import { createPinia } from "pinia";
import { router } from "./routes/routes.js";
import { Quasar, Dialog } from "quasar";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/src/css/index.sass";
import axios from "axios";

axios.defaults.baseURL = "https://transporte-el2a.onrender.com/api/";

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(pinia);
app.use(Quasar, {
  plugins: { Dialog },
});

app.mount("#app");
