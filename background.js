const ICON_ON = "icon-on.svg"
const ICON_OFF = "icon-off.svg"
const STATE = {
    ENABLED: true, // extension enabled, so deplaylistifying is enabled
    DISABLED: false
}
let tab_manager;

function consoleError(messageString) {
    console.error(`deplaylistify: ${messageString}`);
}

function consoleLog(messageString) {
    console.log(`deplaylistify: ${messageString}`);
}

class TabStateManager {
    constructor(storage_key = "tabExtensionState") {
        this.storage_key = storage_key;
        this.tab_states = JSON.parse(localStorage.getItem(this.storage_key)) || {};
        this.getTabIDs().then((tab_ids) => {
            this.tab_states = tab_ids.reduce((accumulate, current) => {
                // if the stored_state has an item that is not in current tabs, it's removed. if the current tabs has an item not in stored, it is initialised to isDisabled
                accumulate[current] = this.tab_states.hasOwnProperty(current) ? this.tab_states[current] : STATE.ENABLED;
                this.setTabIcon(current, accumulate[current]);
                return accumulate;
            }, {});
            this.save_state();
        });
    }

    async getTabIDs() {
        return browser.tabs.query({}).then((tabs) => {
            return tabs.map((tab) => tab.id);
        });
    };

    save_state() {
        localStorage.setItem(this.storage_key, JSON.stringify(this.tab_states));
    }

    setTabIcon(tab_id, state) {
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

    get_tab_state(tab_id) {
        let tab_state = this.tab_states[tab_id];
        if (tab_state === undefined) consoleError(`Attempted to fetch tab that doesn't exist: ${tab_id}`);
        return tab_state;
    }

    set_tab_state(tab_id, state) {
        this.tab_states[tab_id] = state;
        this.setTabIcon(tab_id, state);
        this.save_state();
    }

    delete_tab(tab_id) {
        delete this.tab_states[tab_id];
        this.save_state();
    }

    toggle_tab(tab_id) {
        this.set_tab_state(tab_id, !this.get_tab_state(tab_id));
    }
}

async function sendMessage(tab_id, message){
    return browser.tabs.sendMessage(tab_id, message).catch(() => {
        consoleLog(`Tab ${tab_id} not on YT`);
    });
}

function onInstalled() {
    consoleLog("Installed")
    tab_manager = new TabStateManager();
}

function onExtensionButtonClicked(tab) {
    consoleLog("Action button clicked!");
    tab_manager.toggle_tab(tab.id);
    sendMessage(tab.id, { type: "STATE_CHANGE", state: tab_manager.get_tab_state(tab.id) });
}

function onTabCreated(tab) {
    consoleLog(`New tab opened, started tracking: ${tab.id}`);
    tab_manager.set_tab_state(tab.id, STATE.ENABLED);
}

function onTabClosed(tab_id, remove_info) {
    consoleLog(`Tab ${tab_id} closed`);
    tab_manager.delete_tab(tab_id);
}

function onTabChange(tab_id, change_info, tab) {
    consoleLog(`Tab ${tab_id} updated`)
    if (change_info.status === "complete") { // any time a tab finishes loading
        tab_manager.setTabIcon(tab_id, tab_manager.get_tab_state(tab_id)); // Ensure the tab icon is correct
    }
    if (change_info.url) { // URL has changed
        consoleLog(`URL changed in tab ${tab_id}: ${change_info.url}`);
        sendMessage(tab_id, { type: "URL_CHANGE", url: change_info.url }); // update foreground
    }
}

// Messaging from foreground
function receiveMessage(message, sender, sendResponse) {
    if (!message.hasOwnProperty('type')) {
        consoleLog("Unknown message received: " + JSON.stringify(message));
        return
    }
    if (message['type'] === 'INIT') receiveMessageInit(message, sender, sendResponse);
    if (message['type'] === 'STATE_CHANGE') receiveMessageStateChange(message, sender, sendResponse);
}

function receiveMessageInit(message, sender, sendResponse) {
    let tab_id = sender.tab.id;
    console.log(`deplaylistify: Initialising tab ${tab_id}`);
    sendResponse({ type: "STATE_CHANGE", state: tab_manager.get_tab_state(tab_id)});
}

function receiveMessageStateChange(message, sender, sendResponse) {
    let tab_id = sender.tab.id;
    console.log(`deplaylistify: Toggling tab ${tab_id}`);
    setTabState(tab.id, message['state']);
    setTabIcon(tab.id, message['state']);
}

//Run this once per intialisation
browser.runtime.onInstalled.addListener(onInstalled);

// Toggle icon state per tab
browser.action.onClicked.addListener(onExtensionButtonClicked);

// Dynamically add tabs
browser.tabs.onCreated.addListener(onTabCreated);

// Dynamically delete tabs
browser.tabs.onRemoved.addListener(onTabClosed);

// Detect changes to tabs
browser.tabs.onUpdated.addListener(onTabChange);

// Listen for state change updates from background
browser.runtime.onMessage.addListener(receiveMessage);