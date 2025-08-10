let previousUrl = null //used for when the webpage injects url changes instead of reloading, thanks YT

//Add a listener for ALT keypress and toggle a bool after 5 seconds.
function keyreleaseHandler(event) {
    if (event.key === "Alt") {
        console.log("deplaylistify: Alt key released!");
        localStorage.setItem("skip_checking", "true")
        setTimeout(() => {
            localStorage.setItem("skip_checking", "false")
        }, 5000);
    };
};

document.addEventListener("keyup", keyreleaseHandler);

function cleanURL() {
    let current_url = window.location.href;

    if (localStorage.getItem("skip_checking") === "true") {
        console.log("deplaylistify bypassed!!")
        // update the current URL otherwise the playlist URL  will get cleaned
        // and reloaded when this is cleared and checkURL reruns on the page
        previousUrl = current_url.toString()
        return
    }
    //skip check if URL hasn't changed or if we've bypassed the url cleaning
    if (window.location.href === previousUrl) return

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
