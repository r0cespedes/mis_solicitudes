sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/BusyIndicator",
	
], function (MessageBox, MessageToast, BusyIndicator) {
	"use srtict";

	return {
		console: console,
		styleClass: "sapUiSizeCompact",		
		
		onShowMessage: function (_message, _type, _fnCallback,_oProperties) {
			let oProperties = {
				styleClass: this.styleClass
			};
			if(_oProperties!==undefined && _oProperties!==null){
				oProperties=_oProperties;
			}
			if(_fnCallback!==undefined && _fnCallback!==null){
				oProperties.onClose=_fnCallback;
			}
			try {
				if (_message !== undefined && _type !== undefined) {
					switch (_type) {
					case "info":
						MessageBox.information(_message, oProperties);
						break;
					case "error":
						MessageBox.error(_message, oProperties);
						break;
					case "warn":
						MessageBox.warning(_message, oProperties);
						break;
					case "toast":
						MessageToast.show(_message);
						break;
					case "done":
						MessageBox.success(_message, oProperties);
						break;
					}
				} else {
					this.console.warn("_message or _type are undefined");
				}
			} catch (err) {
				this.console.warn(err.stack);
			}
		},
		
		showBI: function (value) {
			if (value) {
				BusyIndicator.show(0);
			} else {
				BusyIndicator.hide();
			}
		}

	};
});