/* eslint-disable no-undef */
/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file is used to override existing Firefox functions and various variables. */

// Override Forward & Backward button's custamizeble element.
//From "browser.js" line 750
SetClickAndHoldHandlers = function () {
  // Bug 414797: Clone the back/forward buttons' context menu into both buttons.
  let popup = document.getElementById("backForwardMenu").cloneNode(true);
  popup.removeAttribute("id");
  // Prevent the back/forward buttons' context attributes from being inherited.
  popup.setAttribute("context", "");

  let backButton = document.getElementById("back-button");
  if (backButton != null) {
    backButton.setAttribute("type", "menu");
    backButton.prepend(popup);
    gClickAndHoldListenersOnElement.add(backButton);
  }

  let forwardButton = document.getElementById("forward-button");
  if (forwardButton != null) {
    popup = popup.cloneNode(true);
    forwardButton.setAttribute("type", "menu");
    forwardButton.prepend(popup);
    gClickAndHoldListenersOnElement.add(forwardButton);
  }
};

// Override the default newtab url in tabbar. If pref seted.
// Experimental feature. Malware can change this pref to redirect user to malware site.
const newtabOverrideURL = "floorp.newtab.overrides.newtaburl";
if (Services.prefs.getStringPref(newtabOverrideURL, "") != "") {
  ChromeUtils.import("resource:///modules/AboutNewTab.jsm");
  const newTabURL = Services.prefs.getStringPref(newtabOverrideURL);
  AboutNewTab.newTabURL = newTabURL;
}

// Override the create "browser" element function. Use for "Private Container".
// https://searchfox.org/mozilla-central/source/browser/base/content/tabbrowser.js#2052
SessionStore.promiseInitialized.then(() => {
  gBrowser.createBrowser = function ({
    isPreloadBrowser,
    name,
    openWindowInfo,
    remoteType,
    initialBrowsingContextGroupId,
    uriIsAboutBlank,
    userContextId,
    skipLoad,
    initiallyActive,
  } = {}) {
    const { PrivateContainer } = ChromeUtils.importESModule(
      "resource:///modules/PrivateContainer.sys.mjs",
    );

    let b = document.createXULElement("browser");

    if (
      userContextId ===
      PrivateContainer.Functions.getPrivateContainerUserContextId()
    ) {
      b.setAttribute("disablehistory", "true");
      b.setAttribute("disableglobalhistory", "true");
      b.setAttribute("FloorpPrivateContainer", "true");
    }

    // Use the JSM global to create the permanentKey, so that if the
    // permanentKey is held by something after this window closes, it
    // doesn't keep the window alive.
    b.permanentKey = new (Cu.getGlobalForObject(Services).Object)();

    // Ensure that SessionStore has flushed any session history state from the
    // content process before we this browser's remoteness.
    if (!Services.appinfo.sessionHistoryInParent) {
      b.prepareToChangeRemoteness = () =>
        SessionStore.prepareToChangeRemoteness(b);
      b.afterChangeRemoteness = (switchId) => {
        let tab = this.getTabForBrowser(b);
        SessionStore.finishTabRemotenessChange(tab, switchId);
        return true;
      };
    }

    const defaultBrowserAttributes = {
      contextmenu: "contentAreaContextMenu",
      message: "true",
      messagemanagergroup: "browsers",
      tooltip: "aHTMLTooltip",
      type: "content",
    };
    for (let attribute in defaultBrowserAttributes) {
      b.setAttribute(attribute, defaultBrowserAttributes[attribute]);
    }

    if (gMultiProcessBrowser || remoteType) {
      b.setAttribute("maychangeremoteness", "true");
    }

    if (!initiallyActive) {
      b.setAttribute("initiallyactive", "false");
    }

    if (userContextId) {
      b.setAttribute("usercontextid", userContextId);
    }

    if (remoteType) {
      b.setAttribute("remoteType", remoteType);
      b.setAttribute("remote", "true");
    }

    if (!isPreloadBrowser) {
      b.setAttribute("autocompletepopup", "PopupAutoComplete");
    }

    /*
     * This attribute is meant to describe if the browser is the
     * preloaded browser. When the preloaded browser is created, the
     * 'preloadedState' attribute for that browser is set to "preloaded", and
     * when a new tab is opened, and it is time to show that preloaded
     * browser, the 'preloadedState' attribute for that browser is removed.
     *
     * See more details on Bug 1420285.
     */
    if (isPreloadBrowser) {
      b.setAttribute("preloadedState", "preloaded");
    }

    // Ensure that the browser will be created in a specific initial
    // BrowsingContextGroup. This may change the process selection behaviour
    // of the newly created browser, and is often used in combination with
    // "remoteType" to ensure that the initial about:blank load occurs
    // within the same process as another window.
    if (initialBrowsingContextGroupId) {
      b.setAttribute(
        "initialBrowsingContextGroupId",
        initialBrowsingContextGroupId,
      );
    }

    // Propagate information about the opening content window to the browser.
    if (openWindowInfo) {
      b.openWindowInfo = openWindowInfo;
    }

    // This will be used by gecko to control the name of the opened
    // window.
    if (name) {
      // XXX: The `name` property is special in HTML and XUL. Should
      // we use a different attribute name for this?
      b.setAttribute("name", name);
    }

    let notificationbox = document.createXULElement("notificationbox");
    notificationbox.setAttribute("notificationside", "top");

    let stack = document.createXULElement("stack");
    stack.className = "browserStack";
    stack.appendChild(b);

    let browserContainer = document.createXULElement("vbox");
    browserContainer.className = "browserContainer";
    browserContainer.appendChild(notificationbox);
    browserContainer.appendChild(stack);

    let browserSidebarContainer = document.createXULElement("hbox");
    browserSidebarContainer.className = "browserSidebarContainer";
    browserSidebarContainer.appendChild(browserContainer);

    // Prevent the superfluous initial load of a blank document
    // if we're going to load something other than about:blank.
    if (!uriIsAboutBlank || skipLoad) {
      b.setAttribute("nodefaultsrc", "true");
    }

    return b;
  };
});
