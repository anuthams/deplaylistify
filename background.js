const ICON_ON = "icon-on.svg"
const ICON_OFF = "icon-off.svg"
const STATE = {
    ENABLED: true, // extension enabled, so deplaylistifying is enabled
    DISABLED: false
}

function consoleError(messageString) {
    console.error(messageString);
    return
}

function getTabStates() {
    return JSON.parse(localStorage.getItem("tabExtensionState"));
};

function setTabStates(new_states) {
    localStorage.setItem("tabExtensionState", JSON.stringify(new_states));
};

function getTabState(tab_id) {
    let stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    return stored_state[tab_id];
}

function setTabState(tab_id, new_state) {
    let stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    stored_state[tab_id] = new_state;
    localStorage.setItem("tabExtensionState", JSON.stringify(stored_state));
}

function deleteTabState(tab_id) {
    let stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    delete stored_state[tab_id];
    localStorage.setItem("tabExtensionState", JSON.stringify(stored_state));
}

async function getTabIDs() {
    return browser.tabs.query({}).then((tabs) => {
        return tabs.map((tab) => tab.id);
    });
};

function setTabIcon(tab_id, state) {
    console.debug(`Updating icon for ${tab_id}`);
    browser.action.setIcon({
        path: state === STATE.DISABLED ? "icons/icon-off.svg" : "icons/icon-on.svg",
        tabId: tab_id
    });
    browser.action.setTitle({
        title: state === STATE.DISABLED ? "Click to deplaylistify on this tab" : "Click to stop deplaylistifying this tab",
        tabId: tab_id
    });
}

async function sendMessage(tab_id, message){
    return browser.tabs.sendMessage(tab_id, message).catch(() => {
        console.log(`deplaylistify: tab ${tab_id} not on YT`);
    });
}

//Run this once per intialisation
browser.runtime.onInstalled.addListener(() => {
    console.debug("background.js - Running init")
    getTabIDs().then((tabIDs) => {
        let stored_state = getTabStates();
        if (stored_state === null) stored_state = {};
        new_state = tabIDs.reduce((accumulate, current) => {
            // if the stored_state has an item that is not in current tabs, it's removed. if the current tabs has an item not in stored, it is initialised to isDisabled
            accumulate[current] = stored_state.hasOwnProperty(current) ? stored_state[current] : STATE.ENABLED;
            setTabIcon(current, accumulate[current]);
            return accumulate;
        }, {})
        setTabStates(new_state);
    });
});


// Toggle icon state per tab
browser.action.onClicked.addListener((tab) => {
    console.log("background.js Action button clicked!")

    const tab_id = tab.id;

    // toggle state of current tab
    new_state = !getTabState(tab_id);
    setTabState(tab_id, new_state);

    browser.tabs.sendMessage(tab_id, { type: "STATE_CHANGE", state: new_state }).catch(() => {
        console.log(`deplaylistify: tab ${tab_id} not on YT`);;
    }); // catch error if not on yt
    setTabIcon(tab_id, new_state);
});

browser.tabs.onCreated.addListener((tab) => {
    console.debug("New tab opened, adding to state tracking.");
    setTabState(tab.id, STATE.ENABLED);
    setTabIcon(tab.id, STATE.ENABLED);
});

browser.tabs.onRemoved.addListener((tab_id, removeInfo) => {
    console.debug(`Tab ${tab_id} removed, updating tab states`);
    deleteTabState(tab_id);
});

async function updateForeground() {
    //Run this to send updates to the foreground scripts - either on a tab update
}

browser.tabs.onUpdated.addListener((tab_id, changeInfo, tab) => {
    console.debug(`background.js - tab ${tab_id} updated`);
    tab_state = getTabState(tab_id);
    if (tab_state === undefined) consoleError(`No state info for tab ${tab_id}`);
    
    if (changeInfo.status === "complete") setTabIcon(tab_id, tab_state);
    if (change_info.url) {
        console.log(`deplaylistify: URL changed in tab ${tab_id}: ${change_info.url}`);
        sendMessage(tab_id, { type: "URL_CHANGE", url: change_info.url });
    }
});


function init_message_received(message, sender, sendResponse) {
    let tab_id = sender.tab.id;
    console.log(`deplaylistify: Initialising tab ${tab_id}`);
    sendResponse({ type: "STATE_CHANGE", state: getTabState(tab_id)});
}

function state_change_message_received(message, sender, sendResponse) {
    let tab_id = sender.tab.id;
    console.log(`deplaylistify: Toggling tab ${tab_id}`);
    setTabState(tab.id, message['state']);
    setTabIcon(tab.id, message['state']);
}

// Listen for state change updates from background
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.hasOwnProperty('type')) {
        console.log("deplaylistify: Unknown message received: " + JSON.stringify(message));
        return
    }
    if (message['type'] === 'INIT') init_message_received(message, sender, sendResponse);
    if (message['type'] === 'STATE_CHANGE') state_change_message_received(message, sender, sendResponse);
});