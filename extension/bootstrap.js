/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");

function include(path) {
    var uri = Services.io.newURI(path, null, Services.io.newURI(__SCRIPT_URI_SPEC__, null, null));
    Services.scriptloader.loadSubScript(uri.spec, this);
};

include("include/DefaultPrefs.js");
include("include/X11.js");
include("include/GObject.js");
include("include/Gdk.js");
include("include/Gtk.js");

const ELEMENTS = ["main-window"];
const ATTRIBUTE = {name: "darkwdec", value: "true"};

var DarkWDec = {
    PREF_BRANCH: "extensions.darkwdec.",
    gtkVersion: 2,

    prefs: null,

    init: function() {
        this.gtkVersion = this.getGtkVersion();
        if (!this.gtkVersion) {
            this.log("You must have GTK build for usage this extension");
        }

        this._setDefaultPrefs();
        this.prefs = Cc["@mozilla.org/preferences-service;1"]
                       .getService(Ci.nsIPrefService)
                       .getBranch(this.PREF_BRANCH);
        this.prefs.addObserver("", this, false);

        if (this.prefs.getBoolPref("prefer_dark_theme")) {
            this.setGtkTheme("dark");
        }

        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
        wm.addListener(this._windowListener);
        var enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
            if (this.setWMTheme(window, "dark") == 0) {
                this.setAttribute(window, ELEMENTS, ATTRIBUTE);
            }
        }
    },

    uninit: function() {
        if (this.prefs.getBoolPref("prefer_dark_theme")) {
            this.setGtkTheme("default");
        }

        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
        wm.removeListener(this._windowListener);
        var enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
            this.setWMTheme(window, "default");
            this.removeAttribute(window, ELEMENTS, ATTRIBUTE);
        }

        this.prefs.removeObserver("", this);
    },

    /* ::::: ::::: */

    log: function(message) {
        var console = Cc["@mozilla.org/consoleservice;1"]
                        .getService(Ci.nsIConsoleService);
        var console_message = Cc["@mozilla.org/scripterror;1"]
                        .createInstance(Ci.nsIScriptError);

        var sourceName = Services.io.newURI("bootstrap.js", null, Services.io.newURI(__SCRIPT_URI_SPEC__, null, null)).spec;
        console_message.init("DarkWDec: " + message, sourceName, null, null, null, 0, null);
        console.logMessage(console_message);
    },

    /* ::::: Toolkit version ::::: */

    getGtkVersion: function() {
        var xul_runtime = Cc["@mozilla.org/xre/app-info;1"]
                            .getService(Ci.nsIXULRuntime);
        var widget_toolkit = xul_runtime.widgetToolkit;
        switch (widget_toolkit) {
            case "gtk3":
                return 3;
            case "gtk2":
                return 2;
            default:
                return null;
        }
    },

    /* ::::: ::::: */

    setAttribute: function(window, elements, attribute) {
        for (let i = 0; i < elements.length; i++) {
            let element = window.document.getElementById(elements[i]);
            if (element)
                element.setAttribute(attribute.name, attribute.value);
        }
    },

    removeAttribute: function(window, elements, attribute) {
        for (let i = 0; i < elements.length; i++) {
            let element = window.document.getElementById(elements[i]);
            if (element)
                element.removeAttribute(attribute.name);
        }
    },

    setGtkTheme: function(variant="dark") { // default/dark
        if (this.gtkVersion != 3) {
            return;
        }

        try {
            var gobject = new GObject;
            var gtk = new Gtk;
        } catch(e) {
            this.log(e);
            return;
        }

        if (variant == "dark") {
            this.log("Enable dark theme variant");
            /*
            g_object_set (G_OBJECT (gtk_settings),
                          "gtk-application-prefer-dark-theme", TRUE,
                          NULL);
            */
            var settings = gtk.Settings.get_default();
            gobject.set(settings, "gtk-application-prefer-dark-theme", true);
        }
        else {
            this.log("Disable dark theme variant");
            var settings = gtk.Settings.get_default();
            gobject.set(settings, "gtk-application-prefer-dark-theme", false);
        }
    },

    setWMTheme: function(window, theme) { // default/dark
        try {
            var x11 = new X11;
            var gdk = new Gdk(this.gtkVersion, x11);
        } catch(e) {
            this.log(e);
            return 1;
        }

        /* Get native window */
        var base_window = window.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIWebNavigation)
                                .QueryInterface(Ci.nsIDocShellTreeItem)
                                .treeOwner
                                .QueryInterface(Ci.nsIInterfaceRequestor)
                                .nsIBaseWindow;
        var native_handle = base_window.nativeHandle;

        var gdk_window = new gdk.GdkWindow.ptr(ctypes.UInt64(native_handle));
        gdk_window = gdk.Window.get_toplevel(gdk_window);

        var gdk_display = gdk.Display.get_default();
        var x11_display = gdk.X11Display.get_xdisplay(gdk_display);

        if (this.gtkVersion == 3) {
            var x11_window = gdk.X11Window.get_xid(gdk_window);
        }
        else {
            var x11_window = gdk.X11Window.get_xid(ctypes.cast(gdk_window, gdk.GdkDrawable.ptr));
        }

        //xprop -f _GTK_THEME_VARIANT 8u -set _GTK_THEME_VARIANT dark
        let x11_property = gdk.x11_get_xatom_by_name_for_display(gdk_display, "_GTK_THEME_VARIANT");
        if (theme == "dark") {
            let type = x11.XInternAtom(x11_display, "UTF8_STRING", false);

            let data = new ctypes.ArrayType(ctypes.uint32_t)(1);
            data[0] = 1802658148; // 1802658148 == 6b726164 == dark
            let x11_data = ctypes.uint32_t.ptr(data);

            x11.XChangeProperty(x11_display, x11_window, x11_property, type, 8, x11.PropModeReplace, x11_data, 4);
        }
        else {
            x11.XDeleteProperty(x11_display, x11_window, x11_property);
        }

        gdk.close();
        x11.close();

        return 0;
    },

    /* ::::: ::::: */

    _windowListener: {
        onOpenWindow: function(aWindow) {
            var window = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
            window.addEventListener("load", function onLoad() {
                window.removeEventListener("load", onLoad, false);
                if (DarkWDec.setWMTheme(window, "dark") == 0) {
                    DarkWDec.setAttribute(window, ELEMENTS, ATTRIBUTE);
                }
            }, false);
        },
        onCloseWindow: function(aWindow) {},
        onWindowTitleChange: function(aWindow, aTitle) {}
    },

    /* ::::: Preferences ::::: */

    _setDefaultPrefs: function() {
        var branch = Services.prefs.getDefaultBranch(this.PREF_BRANCH);
        for (let [key, val] in Iterator(DefaultPrefs)) {
            switch (typeof val) {
                case "boolean":
                    branch.setBoolPref(key, val);
                    break;
                case "number":
                    branch.setIntPref(key, val);
                    break;
                case "string":
                    branch.setCharPref(key, val);
                    break;
            }
        }
    },

    observe: function(subject, topic, data) {
        if (topic != "nsPref:changed")
            return;

        switch(data) {
            case "prefer_dark_theme":
                let value = this.prefs.getBoolPref("prefer_dark_theme");
                this.log("key \"" + data + "\" has been changed to \"" + value + "\"");
                this.setGtkTheme(value ? "dark" : "default");
                break;
        }
    },
}

function startup(data, reason) {
    DarkWDec.init();
}

function shutdown(data, reason) {
    if (reason == APP_SHUTDOWN)
        return;

    DarkWDec.uninit();
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
