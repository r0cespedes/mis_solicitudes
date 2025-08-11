sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/inetum/missolicitudes/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("com.inetum.missolicitudes.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
            ,config: {
                fullWidth: true
            },
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});