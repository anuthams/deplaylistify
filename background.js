const ICON = {
    ON: {
        "48": "icons/icon-on.svg",
        "96": "icons/icon-on.svg"
    },
    OFF: {
        "48": "icons/icon-off.svg",
        "96": "icons/icon-off.svg"
    }
}
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
        this.tab_states = {};
    }

    async init(){
        return browser.storage.local.get(this.storage_key).then((result) => {
            this.tab_states = result[this.storage_key] || {};
        }).then(this.getTabIDs).then((tab_ids) => {
            this.tab_states = tab_ids.reduce((accumulate, current) => {
                // if the stored_state has an item that is not in current tabs, it's removed. if the current tabs has an item not in stored, it is initialised to isDisabled
                accumulate[current] = this.tab_states.hasOwnProperty(current) ? this.tab_states[current] : STATE.ENABLED;
                this.setTabIcon(current, accumulate[current]);
                return accumulate;
            }, {});
            this.saveState();
        });
    }

    async getTabIDs() {
        return browser.tabs.query({}).then((tabs) => {
            return tabs.map((tab) => tab.id);
        });
    }

    saveState() {
        browser.storage.local.set({[this.storage_key]: this.tab_states});
    }

    setTabIcon(tab_id, state) {
        consoleLog(`Updating icon for ${tab_id}`);
        browser.action.setIcon({
            path: state === STATE.DISABLED ? ICON.OFF : ICON.ON,
            tabId: tab_id
        });
        browser.action.setTitle({
            title: state === STATE.DISABLED ? "Click to deplaylistify on this tab" : "Click to stop deplaylistifying this tab",
            tabId: tab_id
        });
    }

    getTabState(tab_id) {
        let tab_state = this.tab_states[tab_id];
        if (tab_state === undefined) consoleError(`Attempted to fetch tab that doesn't exist: ${tab_id}`);
        return tab_state;
    }

    setTabState(tab_id, state) {
        this.tab_states[tab_id] = state;
        this.saveState();
        this.setTabIcon(tab_id, state);
    }

    deleteTab(tab_id) {
        delete this.tab_states[tab_id];
        this.saveState();
    }

    toggleTabState(tab_id) {
        this.setTabState(tab_id, !this.getTabState(tab_id));
    }
}

async function sendMessage(tab_id, message){
    return browser.tabs.sendMessage(tab_id, message).catch(() => {
        consoleLog(`Tab ${tab_id} not on YT`);
    });
}

async function onInstalled() {
    consoleLog("Installed")
    tab_manager = new TabStateManager();
    await tab_manager.init();
}

function onExtensionButtonClicked(tab) {
    consoleLog("Action button clicked!");
    tab_manager.toggleTabState(tab.id);
    sendMessage(tab.id, { type: "STATE_CHANGE", state: tab_manager.getTabState(tab.id) });
}

function onTabCreated(tab) {
    consoleLog(`New tab opened, started tracking: ${tab.id}`);
    tab_manager.setTabState(tab.id, STATE.ENABLED);
}

function onTabClosed(tab_id, remove_info) {
    consoleLog(`Tab ${tab_id} closed`);
    tab_manager.deleteTab(tab_id);
}

function onTabChange(tab_id, change_info, tab) {
    consoleLog(`Tab ${tab_id} updated`);
    if (change_info.status === "complete") { // any time a tab finishes loading
        tab_manager.setTabIcon(tab_id, tab_manager.getTabState(tab_id)); // Ensure the tab icon is correct
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
    consoleLog(`Initialising tab ${tab_id}`);
    sendResponse({ type: "STATE_CHANGE", state: tab_manager.getTabState(tab_id)});
}

function receiveMessageStateChange(message, sender, sendResponse) {
    let tab_id = sender.tab.id;
    consoleLog(`Toggling tab ${tab_id}`);
    tab_manager.setTabState(tab_id, message['state']);
    tab_manager.setTabIcon(tab_id, message['state']);
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