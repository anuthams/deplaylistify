const STATE = {
    ENABLED: true, // extension enabled, so deplaylistifying is enabled
    DISABLED: false
}

const YT_SEARCH_ALLOW_LIST = new Set([ // An allowlist of search parameters that won't be removed
    "v",
    "t"
]);

let previous_url = null; //used for when the webpage injects url changes instead of reloading, thanks YT
let state = STATE.DISABLED; // default to skipping until we're told otherwise by background

function consoleError(messageString) {
    console.error(`deplaylistify: ${messageString}`);
}

function consoleLog(messageString) {
    console.log(`deplaylistify: ${messageString}`);
}

function cleanURL(url = window.location.href) {
    let current_url = new URL(url);

    if (state === STATE.DISABLED) {
        previous_url = current_url;
        return;
    }
    //skip check if URL hasn't changed or if we've bypassed the url cleaning
    if (current_url.href === previous_url) {
        return;
    }

    if (previous_url === null) {
        consoleLog(`Loading page, URL is ${current_url.href}`);
    }
    consoleLog(`URL changed from ${previous_url} to ${current_url.href}`);

    if (current_url.searchParams.has("list")) {
        consoleLog("Playlist detected, returning to normal video");
        previous_url = current_url.href;
        let new_params = Array.from(current_url.searchParams).reduce((accumulate, current) => {
            if (YT_SEARCH_ALLOW_LIST.has(current[0])) { // If search key is in allow list then keep it
                accumulate.append(current[0], current[1]);
            }
            return accumulate;
        }, new URLSearchParams);

        current_url.search = new_params.toString();
        consoleLog(`Changing to ${current_url}`);
        window.location.replace(current_url);
    }
};

async function fetchState() {
    // Request current state from background script
    return browser.runtime.sendMessage({ type: "INIT" }).then(receiveMessage);
}

function init() {
    consoleLog("Initialising...")

    // Request current state from background script
    fetchState();
};

async function sendState() {
    consoleLog(`Sending ${state}`)
    browser.runtime.sendMessage({ type: "STATE_CHANGE", state: state });
}

function toggleAndSendState(event) {
    if (event.key == "Alt") {
        consoleLog(`Toggling deplaylistify`)
        state = !state;
        sendState();
    };
};
// Run initialisation
window.addEventListener('load', init);

window.addEventListener('focus', fetchState);

window.addEventListener('keyup', toggleAndSendState)

function receiveMessage(message, sender, sendResponse) {
    if (!message.hasOwnProperty('type')) {
        consoleLog("Unknown message received: " + JSON.stringify(message));
        return
    }
    if (message['type'] === 'STATE_CHANGE') receiveMessageStateChange(message, sender, sendResponse)
    if (message['type'] === 'URL_CHANGE') receiveMessageURLChange(message, sender, sendResponse)
}

function receiveMessageStateChange(message, sender, sendResponse) {
    state = message['state'];
    consoleLog("State changed: " + (state === STATE.ENABLED ? "enabled" : "disabled"));
    cleanURL();
}

function receiveMessageURLChange(message, sender, sendResponse) {
    url = message['url'];
    consoleLog(`URL changed to ${url}`);
    cleanURL(url);
}

// Listen for state change updates from background
browser.runtime.onMessage.addListener(receiveMessage);