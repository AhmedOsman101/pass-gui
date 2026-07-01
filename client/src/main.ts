import "./assets/main.css";
import Neutralino from "@neutralinojs/lib";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { neuInitialized } from "@/services/neutralino";
import { passInitialized } from "@/services/pass";
import App from "./App.vue";
import router from "./router";
import { gpgInitialized } from "./services/gpg";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");

// Initialize Neutralino and app services
Neutralino.init();
await neuInitialized;
await gpgInitialized;
await passInitialized;
