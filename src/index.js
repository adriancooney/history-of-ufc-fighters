import App from "./App.js";

window.addEventListener("DOMContentLoaded", main);

async function main() {
    const container = d3.select(".app");
    const app = new App({ container });
    await app.mount();
    app.render();
}