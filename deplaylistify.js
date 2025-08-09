let previousUrl = null //used for when the webpage injects url changes instead of reloading, thanks YT

//Add a listener for ALT keypress and toggle a bool.
function keyreleaseHandler(event) {
    if (event.altKey == true) {
        console.log("deplaylistify: Alt key released!");
        browser.storage.local.set({ bypass_clean: "true" });
    };
};

//function keypressHandler(event) {
//    if (event.altKey == true) {
//        console.log("deplaylistify: Alt key pressed!");
//        browser.storage.local.set({ bypass_clean: "true" });
//    };
//};


//document.addEventListener("keydown", keypressHandler);

document.addEventListener("keyup", keyreleaseHandler);

function cleanURL() {
    let current_url = window.location.href;
    if (window.location.href == previousUrl) return //skip check if URL hasn't changed

    if (previousUrl == null) {
        console.log(`deplaylistify: loading page, URL is ${current_url}`);
    }
    console.log(`deplaylistify: URL changed from ${previousUrl} to ${window.location.href}`)
    let index = current_url.indexOf("&list=");

    // &list= will never be at the start of the url, else this is missing
    if (index > 0) {
        str_url = current_url.toString()
        new_url = str_url.substring(0, index);
        console.log(`deplaylistify: found playlist URL, truncating at index: ${index}, new url is ${new_url}`);
        previousUrl = new_url //save the cleaned url now, before loading the page.
        window.location.replace(new_url)
    };
};

cleanURL();

const UrlObserver = new MutationObserver(cleanURL);
const config = { subtree: true, childList: true };

// start observing change
UrlObserver.observe(document, config);

//TODO: add a listener for keypress and save to local storage as a bool.
// so we can avoid cleaning when needed.