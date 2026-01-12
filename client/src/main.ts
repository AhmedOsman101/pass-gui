import "./assets/main.css";

import Neutralino from "@neutralinojs/lib";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount("#app");

// Initialize Neutralino
Neutralino.init();

// Handle the window close event to kill the process
Neutralino.events.on("windowClose", () => {
  Neutralino.app.exit();
});
