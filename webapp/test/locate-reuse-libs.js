/*
 * Use this script to locate the reuse libraries for your application.
 * This script is only needed for testing in the sandbox environment.
 */
(function () {
    "use strict";
    
    // Get the manifest URI from the script tag
    var oScript = document.getElementById("locate-reuse-libs");
    var sManifestUri = oScript ? oScript.getAttribute("data-sap-ui-manifest-uri") : null;
    
    if (!sManifestUri) {
        console.warn("No manifest URI found for reuse libraries");
        return;
    }
    
    console.log("Loading manifest from:", sManifestUri);
    
    // Load manifest to get reuse library information
    jQuery.ajax({
        url: sManifestUri,
        dataType: "json",
        success: function(oManifest) {
            console.log("Manifest loaded successfully:", oManifest);
            
            // Check if there are reuse libraries defined
            if (oManifest && 
                oManifest["sap.ui5"] && 
                oManifest["sap.ui5"].dependencies && 
                oManifest["sap.ui5"].dependencies.libs) {
                
                var oLibs = oManifest["sap.ui5"].dependencies.libs;
                console.log("Reuse libraries found in manifest:", Object.keys(oLibs));
                
                // You can add specific logic here if you have reuse libraries
                // For now, just log the information
            } else {
                console.log("No reuse libraries found in manifest");
            }
            
            // Log component information
            if (oManifest["sap.app"]) {
                console.log("App ID:", oManifest["sap.app"].id);
                console.log("App Type:", oManifest["sap.app"].type);
            }
        },
        error: function(xhr, status, error) {
            console.error("Could not load manifest:", {
                status: status,
                error: error,
                responseText: xhr.responseText
            });
        }
    });
})();