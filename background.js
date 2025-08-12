const ICON_ON = "icon-on.svg"
const ICON_OFF = "icon-off.svg"
let isDisabled = false
let initArray = []

function getTabs(tabs) {
    for (const tab of tabs) {
        //console.log(`adding IDs to initArray ${tab.id}`)
        initArray.push(tab.id)
    }
}

function onError(error) {
    console.error(`Error: ${error}`);
}


//Run this once per intialisation
browser.runtime.onInstalled.addListener(() => {
    // State object tracking icon status per tab (use let so we can reassign for immutability)
    console.debug("background.js - Running init")
    let tabExtensionState = {};
    browser.tabs.query({}).then(getTabs, onError); //async, the rest of the code executes while we wait on this and we get no tab states...
    stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    console.debug(stored_state)
    if (stored_state !== null) {
        console.debug("20")
        if (initArray.length > 0) {
            console.debug("22")
            for (id of initArray) {
                if (!(id in stored_state)) {
                    stored_state[id] = isDisabled;
                }
            }
        }
        localStorage.setItem("tabExtensionState", JSON.stringify(stored_state));
    } else {
        console.debug(initArray, initArray.length)
        if (initArray.length > 0) {
            console.debug("41")
            for (id of initArray) {
                tabExtensionState[id] = isDisabled;
            };
            console.debug(`tab states: ${tabExtensionState}`)
            localStorage.setItem("tabExtensionState", JSON.stringify(tabExtensionState));
        };
    };
});

// Toggle icon state per tab
browser.action.onClicked.addListener((tab) => {
    console.log("background.js Action button clicked!")
    const tabId = tab.id;

    stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    if (stored_state) {
        previous_state = stored_state[tab.id]
        if (isTabDisabled !== undefined) {
            stored_state[tabId] = !previous_state;
        }
        else { //state is enabled by default - actually it shouldn't be possible to get here at all
            //stored_state[tabId] = !isDisabled;
            console.debug("background.js:21 This should never occur")
        };
        localStorage.setItem("tabExtensionState", JSON.stringify(stored_state))
    }
    else {
        //This should also never happen
        console.debug("background.js:28 tabExtensionState doesn't exist")
    }
    console.debug("Updating icon!")
    browser.action.setIcon({
        path: !previous_state ? "icons/icon-off.svg" : "icons/icon-on.svg",
        tabId: tab.id
    });
    browser.action.setTitle({
        title: !previous_state ? "Click to deplaylistify on this tab" : "Click to stop deplaylistifying this tab",
        tabId: tab.id
    });
})

browser.tabs.onCreated.addListener((tab) => {
    console.debug("New tab opened, adding to state tracking.")
    stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    stored_state[tab.id] = isDisabled;
    localStorage.setItem("tabExtensionState", JSON.stringify(stored_state));
})

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.debug(`Tab ${tabId} removed, removing from state tracking`)
    stored_state = JSON.parse(localStorage.getItem("tabExtensionState"));
    delete stored_state[tabId];
    localStorage.setItem("tabExtensionState", JSON.stringify(stored_state));
})
