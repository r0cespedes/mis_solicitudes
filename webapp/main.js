sap.ui.define([
    "sap/ui/core/ComponentContainer"
], function (ComponentContainer) {
    "use strict";

    new ComponentContainer({
        name: "com.inetum.missolicitudes",
        settings: {
            id: "com.inetum.missolicitudes"
        },
        async: true
    }).placeAt("content");
});