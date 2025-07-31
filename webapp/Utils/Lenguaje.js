sap.ui.define([], function () {
    "use strict";
    
    var sLang = sap.ui.getCore().getConfiguration().getLanguage().toLowerCase();
    
    var mMap = {
        "es": "_es_ES",
        "es-es": "_es_ES",
        "ca": "_ca_ES", 
        "ca-es": "_ca_ES",
        "en": "_en_US",
        "en-us": "_en_US"
    };
    
    var sSufijo = mMap[sLang] || "_defaultValue";
    
    return {
        obtenerNombreConcatenado: function (sNombreBase) {
            return sNombreBase + sSufijo;
        },
        
        /**
         * Obtiene el valor localizado con fallback automático
         * @param {object} oData - Objeto con los datos
         * @param {string} sFieldBase - Nombre base del campo
         * @returns {string} Valor localizado o fallback
         */
        obtenerValorLocalizado: function (oData, sFieldBase) {
            var sLocalizedField = this.obtenerNombreConcatenado(sFieldBase);
            return oData[sLocalizedField] || 
                   oData[sFieldBase + "_localized"] || 
                   oData[sFieldBase + "_defaultValue"] || 
                   "";
        }
    };
});