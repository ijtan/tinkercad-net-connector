var monitoringTabs = []; 
var theDiv = null;
var lastText = "";

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

async function getTabId() {
  let tabid = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ msg: "get-tabid" }, (response) => {
      resolve(response);
    })
  );
  return tabid;
}

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

var documentObserver = new MutationObserver(async function (
  mutations,
  observer
) {
  let tabid = await getTabId();

  //check if an event handler has already been set up for the particular tab
  if (monitoringTabs[tabid] == true) {
    return;
  }

    monitoringTabs[tabid] = true;

  elements = document.querySelectorAll(
    "#main > div > div > div.editor.js-root_container > div.editor__content.js-editor__content > div.js-tpl-target__code_panel > div > div.code_panel__serial.js-code_panel__serial > div.code_panel__serial__content.js-code_panel__serial__content > div.code_panel__serial__top > div.code_panel__serial__content__text.js-code_panel__serial__text.js-code_editor__serial-monitor__content"
  );

  // if no elements, we need to wait for the page to load more
  if (elements == null || elements.length == 0) {
    console.warn("Tinkercad page not loaded yet");
    // remove the tab from the monitoring list
    delete monitoringTabs[tabid];
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return;
  }

  if (elements != null && elements.length > 0) {
    theDiv = elements[0];
    theDiv.addEventListener(
      "DOMSubtreeModified",
      debounce(function (ev) {

        var urlbase = "";
        chrome.storage.local.get(["urlbase"], function (result) {
          urlbase = result.urlbase;

          if (urlbase == null || urlbase.length == 0) {
            console.error("urlbase is null or empty");
            return;
          }

          const text = theDiv.innerText;

          // does last line end with a newline? if not, it's not a complete line
          const lines = text.trim().split("\n").filter((line) => line.length > 0);

          clearButton = document.querySelector(
            "[class*=js-code_panel__serial__clear]"
          );

          if (clearButton != null) {
            clearButton.click();
          }

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.length > 0) {
              chrome.runtime.sendMessage(
                { msg: "send-output", output: line },
                (response) => {
                  if (response != null && response.length > 0) {
                    sendInputToDevice(response);
                  }
                }
              );
            }
          }
        });
      }, 100),
      false
    );
  }
});

async function sendInputToDevice(input) {
  elements = document.querySelectorAll("[class*=code_panel__serial__input]");
  if (elements != null && elements.length > 0) {
    theInputField = elements[0];
    theInputField.value = input;
    elements = document.querySelectorAll(
      "[class*=js-code_panel__serial__send]"
    );

    if (elements != null && elements.length > 0) {
      theSendButton = elements[0];
      theSendButton.click();
    }
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.msg == "process-input") {
    sendInputToDevice(request.input);
  }
});

documentObserver.observe(document, {
  subtree: true,
  attributes: true,
});
