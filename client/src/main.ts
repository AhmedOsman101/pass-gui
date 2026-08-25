import "./assets/main.css";
import Neutralino from "@neutralinojs/lib";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { Neu } from "@/services/neutralino";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
app.use(router);

// Neutralino runtime is sync; Neu (HOME_DIR) is the core API that must
// always load — gate is non-functional without it. Eager but caught so a
// hard HOME_DIR failure still renders a distinct critical screen instead
// of a blank shell. Gpg/Pass remain lazy via the gate.
Neutralino.init();
await Neu.ensureInitialized().catch(() => {
  // initError is stored on Neu; gate will render the critical screen.
});

app.mount("#app");
