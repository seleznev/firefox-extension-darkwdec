/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/ctypes.jsm");

function Gtk(version=3) {
    if (version != 3) {
        throw "GTK+ 2 isn't available";
    }

    var library_name = "libgtk-3.so";
    try {
        this.library = ctypes.open(library_name + ".0");
    } catch(e) {
        // *.so.0 isn't available, try *.so instead
        try {
            this.library = ctypes.open(library_name);
        } catch(e) {
            throw library_name + " isn't available";
        }
    }

    /* ::::: Types ::::: */

    this.GtkSettings = ctypes.StructType("GtkSettings");

    /* ::::: Functions ::::: */

    this.Settings = {};

    this.Settings.get_default = this.library.declare("gtk_settings_get_default",
                                                     ctypes.default_abi,
                                                     this.GtkSettings.ptr);

    this.close = function() {
        this.library.close();
    }
}
