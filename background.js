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
    stored_state = getTabStates();
    if (!stored_state) {
        console.debug("background.js:28 tabExtensionState doesn't exist");
        return // exit early, shouldn't happen but guard rails amirite
    }

    // toggle state of current tab
    new_state = !stored_state[tab_id];
    stored_state[tab_id] = new_state;
    setTabStates(stored_state);
    browser.tabs.sendMessage(tab_id, { "new_state": new_state }).catch((error => {
        console.log(`deplaylistify: tab ${tab_id} not on YT`);
    })); // catch error if not on yt
    setTabIcon(tab_id, new_state);
});

browser.tabs.onCreated.addListener((tab) => {
    console.debug("New tab opened, adding to state tracking.");
    stored_state = getTabStates();
    stored_state[tab.id] = STATE.ENABLED;
    setTabIcon(tab.id, STATE.ENABLED);
    setTabStates(stored_state);
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.debug(`Tab ${tabId} removed, updating tab states`);
    stored_state = getTabStates();
    delete stored_state[tabId];
    setTabStates(stored_state);
});


async function updateForeground() {
    //Run this to send updates to the foreground scripts - either on a tab update
}

browser.tabs.onUpdated.addListener((tabID, changeInfo, tab) => {
    console.debug(`background.js - tab ${tabID} updated`);
    stored_state = getTabStates();
    if (!stored_state.hasOwnProperty(tabID)) consoleError(`No state info for tab ${tabID}`);
    if (changeInfo.status === "complete") setTabIcon(tabID, stored_state[tabID])
    if (changeInfo.url) console.debug(`background.js - tab URL changed to ${changeInfo.url}`)
})


browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.hasOwnProperty('init') && message['init']) {
        console.log(`Initialised ${sender.tab.id}`);
        stored_state = getTabStates();
        sendResponse({ current_state: stored_state[sender.tab.id] });
    }

    else if (message.hasOwnProperty('new_state') && message['new_state'] !== undefined) {
        console.log(`Toggling deplaylistify on tab ${sender.tab.id}`);
        new_state = message['new_state'];
        stored_state = getTabStates();
        stored_state[sender.tab.id] = new_state;
        setTabStates(stored_state);
        setTabIcon(sender.tab.id, stored_state[sender.tab.id]);
    }
});