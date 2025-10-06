sap.ui.define([
    "sap/ui/core/ComponentContainer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/odata/v2/ODataModel"
], function (ComponentContainer, Filter, FilterOperator, ODataModel) {
    "use strict";

    /**
     * Función principal asíncrona que se ejecuta al iniciar la app.
     * Se obtiene el usuario en línea enseguida se obtiene el lenguaje
     * del usuario en SFSF 
     */
    async function main() {
        let sLang;
        const maxRetries = 5;
        const retryDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {

            try {
                const oResponse = await fetch(`${sap.ui.require.toUrl("com/inetum/missolicitudes")}/user-api/currentUser`);
                if (!oResponse.ok) {
                    throw new Error(`Error del servidor: ${oResponse.status} ${oResponse.statusText}`);
                }
                const oUserData = await oResponse.json();
                const oDataModel = new ODataModel({
                    serviceUrl: sap.ui.require.toUrl("com/inetum/missolicitudes") + "/odata/v2"
                });
                const aFilters = [new Filter("userId", FilterOperator.EQ, oUserData.name)];
                const oResult = await new Promise((resolve, reject) => {
                    oDataModel.read("/User", {
                        filters: aFilters,
                        urlParameters: {
                            "$select": "defaultLocale"
                        },
                        success: (oData) => {
                            if (oData.results && oData.results.length > 0) {
                                resolve(oData.results[0]);
                            } else {
                                reject(new Error("Usuario no encontrado en SFSF."));
                            }
                        },
                        error: (oError) => reject(oError)
                    });
                });
                const sLang = oResult.defaultLocale;
                sap.ui.getCore().getConfiguration().setLanguage(sLang);
                break;
            } catch (oError) {
                if (attempt === maxRetries) {
                    console.error("Todos los intentos para cargar los datos del usuario fallaron.", oError);
                    console.warn("Usando idioma del navegador como fallback.");
                    sLang = navigator.language;
                    sap.ui.getCore().getConfiguration().setLanguage(sLang);
                } else {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }           
        }

        new ComponentContainer({
            name: "com.inetum.missolicitudes",
            settings: {
                id: "com.inetum.missolicitudes"
            },
            async: true
        }).placeAt("content");
    }

    main();
});