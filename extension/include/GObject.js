/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/ctypes.jsm");

function GObject() {
    var library_name = "libgobject-2.0.so";
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

    this.gchar = ctypes.char;
    this.gboolean = ctypes.int;
    this.gpointer = ctypes.voidptr_t;

    /* ::::: Functions ::::: */

    /*
    void
    g_object_set (gpointer object,
                  const gchar *first_property_name,
                  ...);
    */

    this.set = this.library.declare("g_object_set",
                                    ctypes.default_abi,
                                    ctypes.void_t,
                                    this.gpointer,
                                    this.gchar.ptr,
                                    this.gboolean);

    /*
    void
    g_object_notify (GObject *object,
                     const gchar *property_name);
    */

    this.notify = this.library.declare("g_object_notify",
                                       ctypes.default_abi,
                                       ctypes.void_t,
                                       this.gpointer,
                                       this.gchar.ptr);

    this.close = function() {
        this.library.close();
    }
}
