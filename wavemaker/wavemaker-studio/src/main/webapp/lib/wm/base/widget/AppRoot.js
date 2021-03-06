/*
 *  Copyright (C) 2012-2013 CloudJee, Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

dojo.provide("wm.base.widget.AppRoot");
dojo.declare("wm.AppRoot", wm.Container, {
    // useful properties
    classNames: 'wmapproot',
    width: "",
    height: "",
        deviceSize: "",
    create: function() {
        this.inherited(arguments);
        this.deviceSize = wm.deviceSize || this.calcDeviceSize(window.innerWidth || document.documentElement.clientWidth);
        app.valueChanged("deviceSize",this.deviceSize); // bindable event
    },
    build: function() {
        this.domNode = this.owner.domNode = dojo.byId(this.owner.domNode) || document.body;
        this.domNode.style.cssText += this.style + "overflow: hidden; position: relative;";
        dojo.attr(this.domNode, "role", "application");
    },
    init: function() {
        var domId = this.domNode.id;
        this.inherited(arguments);
        this.domNode.id = domId; /* using onorientationchange is unreliable for android browser; may need to re-review this */
        /* The Android browser shipped by google with 2.x devices can not find the width and height of the screen when the onorientationchange event fires, and
         * the result is a big gap in the margin of the page.  While a delay could be used, on a test device the delay was significant and unpredictable.
         *
         * WARNING: onresize may not be provided to android devices within phonegap applications.
         */
        this._isOldAndroidBrowser = (navigator.vendor || "").match(/Google/i) && navigator.userAgent.match(/android/i);
        if (!this._isOldAndroidBrowser && "onorientationchange" in window) {
            window.addEventListener("orientationchange", dojo.hitch(this, "resize"));
        } else {
            this.subscribe("window-resize", this, "resize");
        }

    },

    getRuntimeId: function() {return "approot";},

    /* Assumes that wavemaker app is the only thing on the page; some of these calculations fail if there is other html outside of the wavemakerNode */
    _onOrientationChange: function() {

        this._inResize = true;

        /* for iphone, screen.height is height including area taken by location bar; and innerHeight is area between location bar and bottom bar;
         */

        var width = Math.min(screen.width, window.innerWidth);
        var height = Math.min(screen.height, window.innerHeight);

        var max = Math.max(width, height);
        var min = Math.min(width, height);
        switch (window.orientation) {
        case 90:
        case -90:
        case 270:
            this.setBounds(null, null, max, min);
            if (app.appTitleBar) app.appTitleBar.hide();
            break;
        default:
            this.setBounds(null, null, min, max);
            if (app.appTitleBar) app.appTitleBar.show();
        }
        app.valueChanged("deviceSize", this.deviceSize); // bindable event
        dojo.publish("deviceSizeRecalc");
        this.reflow();
        this._inResize = false;
    },
    resize: function() {
        this._inResize = true;
        if (!wm.deviceSize) {// set from URL
        var deviceSize = this.deviceSize;
        this.updateBounds();
        this.deviceSize = this.calcDeviceSize(this.bounds.w);
        if (deviceSize != this.deviceSize) {
            app.valueChanged("deviceSize",this.deviceSize); // bindable event
            dojo.publish("deviceSizeRecalc");
        }
        }

        this.reflow();


        if (this._isOldAndroidBrowser && app.wmMinifiedDialogPanel) {
        app.wmMinifiedDialogPanel.hide();
        wm.onidle(app.wmMinifiedDialogPanel, "show");
        }
        this._inResize = false;
    },
    updateBounds: function() {
        this._percEx = {w:100, h: 100};
        var pn = this.domNode.parentNode;
        var width,height;

        if (window["PhoneGap"]) {
        height = Math.min(screen.height, window.innerHeight);
        pn.style.height = height + "px";
        width = Math.min(screen.width, window.innerWidth || 20000); // this is correct for Android 2.x devices, untested for other platforms
        } else if (wm.isIOS) {

        if (window.orientation == 90 || window.orientation == -90) {
            var min = Math.min(window.innerWidth, window.innerHeight);
            var max = Math.max(window.innerWidth, window.innerHeight);
            width = max;
            height = min;
        } else {
            height = Math.max(window.innerHeight, window.innerWidth); // don't assume width and height have updated since the last orientation change, just figure out width and height based on window.orientation = 0
            width = Math.min(window.innerHeight, window.innerWidth);
        }
        //pn.style.height = (height + 100) + "px"; // without that extra height, setting scrollTop will fail
        this.domNode.style.position = "relative";
        } else if (wm.device == "phone") {

        } else if (wm.isMobile) {
        pn.style.height = "100%";
        }

        if (wm.isMobile) {
        if (!width)
            width = Math.min(screen.width, window.innerWidth || 20000, pn.offsetWidth);
        if (!height)
            height = Math.min(screen.height, window.innerHeight || 20000, pn.offsetHeight || 1000);
        } else {
        width = pn.offsetWidth;
        height = pn.offsetHeight;
        }
        this.setBounds(0, 0, width, height);
    },
    forceRerenderComponents: function(wIn) {
    wm.forEachWidget(wIn, function(w) {
        w.invalidCss = true;
        w.renderCss();
    });
    },
    reflow: function() {
        if (this._cupdating)
        return;
        if (!this._inResize) {
        this.updateBounds();
        }
        this.renderBounds();

        // find out what the zoom level is
        if (window["getComputedStyle"]) {
        try {
            this.domNode.style.borderRight = "solid 1px transparent";
            var actualBorder = Number(window.getComputedStyle(this.domNode).getPropertyValue("border-right-width").replace(/px/,""));
            var oldZoomLevel = app._currentZoomLevel;
            app._currentZoomLevel = 1/actualBorder;
            if (app._currentZoomLevel == 1) app._currentZoomLevel = 0; // causes zoom level to be ignored if we have 1-1 relationship between real px and requested px
            if (oldZoomLevel && oldZoomLevel != app._currentZoomLevel) {
            this.forceRerenderComponents(this);
            var self = this;
            wm.forEachProperty(app.$, function(c) {
                if (c instanceof wm.Dialog) {
                self.forceRerenderComponents(c);
                }
            });
            wm.forEachProperty(wm.Page.byName, function(pageList) {
                dojo.forEach(pageList, function(page) {
                wm.forEachProperty(page.$, function(c) {
                    if (c instanceof wm.Dialog) {
                    self.forceRerenderComponents(c);
                    }
                });
                });
            });
            }

            this.domNode.style.borderRight = "solid 0px transparent";
            dojo.publish("BrowserZoomed");
        } catch(e) {}
        }
        this.inherited(arguments);
/*
        if (wm.isMobile) {
        // get rid of the location bar on any mobile browser that is in landscape mode
        // in an attempt to get a usable amount of height
        //document.body.scrollTop = (this.bounds.w > this.bounds.h) ? 1 : 0;
        }
        */
    },
    calcDeviceSize: function(width) {
    if (width >= 1800) {
        return "1800";
    } else if (width >= 1400) {
        return "1400";
    } else if (width >= 1150) {
        return "1150";
    } else if (width >= 900) {
        return "900";
    } else if (width >= 650) {
        return "650";
    } else if (width >= 450) {
        return "450";
    } else if (width >= 300) {
        return "300";
    } else {
        return "200";
    }
    }
});
