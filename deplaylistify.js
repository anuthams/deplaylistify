const STATE = {
    ENABLED: true, // extension enabled, so deplaylistifying is enabled
    DISABLED: false
}

let previous_url = null; //used for when the webpage injects url changes instead of reloading, thanks YT
let state = STATE.DISABLED; // default to skipping until we're told otherwise by background

function cleanURL(url = window.location.href) {
    let current_url = url;

    if (state === STATE.DISABLED) {
        previous_url = current_url;
        return;
    }
    //skip check if URL hasn't changed or if we've bypassed the url cleaning
    if (current_url === previous_url) {
        return;
    }

    if (previous_url === null) {
        console.log(`deplaylistify: loading page, URL is ${current_url}`);
    }
    console.log(`deplaylistify: URL changed from ${previous_url} to ${window.location.href}`)
    let index = current_url.indexOf("&list=");

    // &list= will never be at the start of the url, else this is missing
    if (index > 0) {
        str_url = current_url.toString();
        new_url = str_url.substring(0, index);
        console.log(`deplaylistify: found playlist URL, truncating at index: ${index}, new url is ${new_url}`);
        previous_url = new_url; //save the cleaned url now, before loading the page.
        window.location.replace(new_url);
    };
};

async function fetchState() {
    // Request current state from background script
    return browser.runtime.sendMessage({ type: "INIT" }).then((message) => {
        if (message.hasOwnProperty('current_state')) {
            state = message['current_state'];
            console.log(`deplaylistify: state fetched from background: ${state}`);
            cleanURL();
        };
    });
}

function init() {
    console.log("deplaylistify: initialising...")
    // const UrlObserver = new MutationObserver(cleanURL);
    // const config = { subtree: true, childList: true };
    // // start observing changes to document
    // UrlObserver.observe(document, config);

    // Request current state from background script
    fetchState();
};

async function sendState() {
    console.log(`sending ${state}`)
    browser.runtime.sendMessage({ type: "STATE_CHANGE", state: state });
}

function toggleAndSendState(event) {
    if (event.key == "Alt") {
        console.log(`deplaylistify: toggling deplaylistify`)
        state = !state;
        sendState();
    };
};
// Run initialisation
window.addEventListener('load', init);

window.addEventListener('focus', fetchState);

window.addEventListener('keyup', toggleAndSendState)

function incoming_state_message_received(message, sender, sendResponse) {
    state = message['state'];
    console.log("deplaylistify: " + (state === STATE.ENABLED ? "enabled" : "disabled"));
    cleanURL();
}

function incoming_url_message_received(message, sender, sendResponse) {
    url = message['url'];
    console.log(`deplaylistify: url changed to ${url}`)
    cleanURL(url);
}

// Listen for state change updates from background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.hasOwnProperty('type')) {
        console.log("deplaylistify: Unknown message received: " + JSON.stringify(message));
        return
    }
    if (message['type'] === 'STATE_CHANGE') state_change_message_received(message, sender, sendResponse)
    if (message['type'] === 'URL_CHANGE') url_change_message_received(message, sender, sendResponse)
});