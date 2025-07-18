sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";
    
    return {
        
        /**
         * Crear datos en SuccessFactors
         * @param {string} sEntity - Nombre de la entidad (ej: "/cust_INETUM_SOL_C_0001")
         * @param {object} oService - Modelo OData del servicio
         * @param {object} oDataToSend - Datos a crear
         * @returns {Promise} Promise con la respuesta
         */
        createDataERP: function (sEntity, oService, oDataToSend) {
            return new Promise((resolve, reject) => {
                console.log("🔄 CREATE - Entidad:", sEntity, "Datos:", oDataToSend);
                
                oService.create(sEntity, oDataToSend, {
                    success: (data, response) => {
                        console.log("✅ CREATE exitoso:", data);
                        resolve({ data, response });
                    },
                    error: (error) => {
                        console.error("❌ CREATE error:", error);
                        reject(error);
                    }
                });
            });
        },

        /**
         * Leer datos de SuccessFactors
         * @param {string} sEntity - Nombre de la entidad
         * @param {object} oService - Modelo OData del servicio
         * @param {array} aFilter - Array de filtros UI5
         * @param {object} oParam - Parámetros adicionales {bParam: boolean, oParameter: object}
         * @returns {Promise} Promise con la respuesta
         */
        readDataERP: function (sEntity, oService, aFilter = [], oParam = { bParam: false, oParameter: undefined }) {
            return new Promise((resolve, reject) => {
                console.log("🔄 READ - Entidad:", sEntity, "Filtros:", aFilter, "Parámetros:", oParam);
                
                oService.read(sEntity, {
                    filters: aFilter,
                    urlParameters: oParam.bParam ? oParam.oParameter : {},
                    success: (data, response) => {
                        console.log("✅ READ exitoso:", data);
                        resolve({ data, response });
                    },
                    error: (error) => {
                        console.error("❌ READ error:", error);
                        reject(error);
                    }
                });
            });
        },

        /**
         * Actualizar datos en SuccessFactors
         * @param {string} sEntity - Ruta completa con claves (ej: "/cust_INETUM_SOL_C_0001(externalCode=123)")
         * @param {object} oService - Modelo OData del servicio
         * @param {object} oDataToUpdate - Datos a actualizar
         * @returns {Promise} Promise con la respuesta
         */
        updateDataERP: function (sEntity, oService, oDataToUpdate) {
            return new Promise((resolve, reject) => {
                console.log("🔄 UPDATE - Entidad:", sEntity, "Datos:", oDataToUpdate);
                
                oService.update(sEntity, oDataToUpdate, {
                    success: (data, response) => {
                        console.log("✅ UPDATE exitoso:", data);
                        resolve({ data, response });
                    },
                    error: (error) => {
                        console.error("❌ UPDATE error:", error);
                        reject(error);
                    }
                });
            });
        },

        /**
         * Eliminar datos de SuccessFactors
         * @param {string} sEntity - Ruta completa con claves
         * @param {object} oService - Modelo OData del servicio
         * @returns {Promise} Promise con la respuesta
         */
        deleteDataERP: function (sEntity, oService) {
            return new Promise((resolve, reject) => {
                console.log("🔄 DELETE - Entidad:", sEntity);
                
                oService.remove(sEntity, {
                    success: (data, response) => {
                        console.log("✅ DELETE exitoso:", data);
                        resolve({ data, response });
                    },
                    error: (error) => {
                        console.error("❌ DELETE error:", error);
                        reject(error);
                    }
                });
            });
        },
       
    };
});