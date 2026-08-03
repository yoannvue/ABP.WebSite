/*
------------------------------------------------------
 Analytics.js
------------------------------------------------------

Configuration :

1) Remplace les deux URL GoatCounter ci-dessous.

2) Dans chaque page HTML ajoute simplement :

<script src="js/analytics.js"></script>

Les pages seront automatiquement comptabilisées.

------------------------------------------------------
*/

const Analytics = (() => {

    //--------------------------------------------------
    // CONFIGURATION
    //--------------------------------------------------

    const CONFIG = {

        enabled: true,

        production: {
            goatCounterUrl: "https://abp.goatcounter.com/count"
        },

        development: {
            goatCounterUrl: ""
        }

    };

    //--------------------------------------------------
    // Détection environnement
    //--------------------------------------------------

    const hostname = window.location.hostname;

    const isDevelopment =

        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.endsWith(".local");

    const goatUrl = isDevelopment
        ? CONFIG.development.goatCounterUrl
        : CONFIG.production.goatCounterUrl;

    //--------------------------------------------------
    // Chargement du script GoatCounter
    //--------------------------------------------------

    function loadGoatCounter() {

        if (!CONFIG.enabled)
            return;

        if (goatUrl === "") return;

        const script = document.createElement("script");

        script.async = true;

        script.dataset.goatcounter = goatUrl;

        script.src = "https://gc.zgo.at/count.js";

        document.head.appendChild(script);

    }

    //--------------------------------------------------
    // Attendre que GoatCounter soit prêt
    //--------------------------------------------------

    function waitReady(callback) {

        const timer = setInterval(() => {

            if (window.goatcounter) {

                clearInterval(timer);

                callback();

            }

        },100);

    }

    //--------------------------------------------------
    // Suivi d'une page
    //--------------------------------------------------

    function trackPage(path = null,title = document.title) {

        waitReady(() => {

            window.goatcounter.count({

                path: path ?? location.pathname,

                title: title

            });

        });

    }

    //--------------------------------------------------
    // Suivi d'un évènement
    //--------------------------------------------------

    function trackEvent(name) {

        waitReady(() => {

            window.goatcounter.count({

                path: "/event/" + name,

                title: name

            });

        });

    }

    //--------------------------------------------------
    // Information console
    //--------------------------------------------------

    function logEnvironment() {

        console.info(

            "%cAnalytics",

            "color:#F28C1E;font-weight:bold",

            isDevelopment
                ? "Mode DEVELOPPEMENT"
                : "Mode PRODUCTION"

        );

    }

    //--------------------------------------------------
    // Initialisation
    //--------------------------------------------------

    function init() {

        if(!CONFIG.enabled)
            return;

        loadGoatCounter();

        logEnvironment();

    }

    return {

        init,

        trackPage,

        trackEvent,

        isDevelopment

    };

})();

Analytics.init();