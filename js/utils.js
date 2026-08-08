export function getEnvironment() {
    const ua = navigator.userAgent;

    // Détection Puppeteer / Playwright
    if (ua.includes("HeadlessChrome") || ua.includes("Headless") || window.__IS_PUPPETEER__) {
        return "puppeteer";
    }

    const origin = window.location.origin;

    // Détection local
    if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.startsWith("file://")
    ) {
        return "local";
    }

    // Sinon, c'est la prod
    return "prod";
}