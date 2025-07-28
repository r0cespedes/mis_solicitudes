sap.ui.define([
    "sap/ui/base/Object",
    "../model/formatter",
    "sap/ui/core/mvc/View",
    "sap/m/Page",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/m/ComboBox",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ScrollContainer",
    "sap/ui/core/Item"
], function (BaseObject, formatter, View, Page, Label, Input, DatePicker, TextArea, CheckBox, ComboBox, SimpleForm, MessageToast, Button, Toolbar, ToolbarSpacer, ScrollContainer, Item) {
    "use strict";

    return BaseObject.extend("com.inetum.missolicitudes.dinamic.DinamicFields", {
        formatter: formatter,
        
        constructor: function(oController) {
            BaseObject.prototype.constructor.apply(this, arguments);
            this._oController = oController;
            this._oMainView = oController.getView();
        },

        /**
         * Mostrar vista de detalle dinámica
         */
        showDynamicDetailView: function(sSolicitudId) {
            // Buscar la solicitud en los datos ya cargados
            var oSolicitudesModel = this._oMainView.getModel("solicitudes");
            var aSolicitudes = oSolicitudesModel.getProperty("/solicitudes/results");
            
            var oSolicitud = aSolicitudes.find(function(item) {
                return item.externalCode === sSolicitudId;
            });

            if (!oSolicitud) {
                MessageToast.show("Solicitud no encontrada: " + sSolicitudId);
                return;
            }

            // Crear la vista dinámica
            var oDetailView = this._createDetailView(oSolicitud);
            
            // Obtener el contenedor principal de la app
            var oApp = this._oMainView.getParent();
            
            // Agregar la nueva vista
            oApp.addPage(oDetailView);
            
            // Navegar a la nueva vista
            oApp.to(oDetailView.getId());
        },

        /**
         * Crear vista de detalle programáticamente
         */
        _createDetailView: function(oSolicitudData) {
            var that = this;
            
            // Crear formulario dinámico de solo lectura
            var oForm = this._createReadOnlyForm(oSolicitudData);
            
            // Crear ScrollContainer
            var oScrollContainer = new ScrollContainer({
                height: "100%",
                horizontal: false,
                content: [oForm]
            });

            // Botones del footer
            var oCancelRequestButton = new Button({
                text: "Cancelar Solicitud",
                type: "Reject",
                visible: oSolicitudData.cust_status === "EN_CURSO",
                press: function() {
                    that._onCancelRequest(oSolicitudData, oDetailView);
                }
            });

            var oCloseButton = new Button({
                text: "Cerrar",
                type: "Emphasized",
                press: function() {
                    that._onBackToMain(oDetailView);
                }
            });

            // Footer
            var oFooterToolbar = new Toolbar({
                content: [
                    new ToolbarSpacer(),
                    oCancelRequestButton,
                    oCloseButton
                ]
            });

            // Página principal
            var oPage = new Page({
                title: "Solicitud: " + (oSolicitudData.cust_nombreSol || oSolicitudData.externalCode),
                showNavButton: true,
                navButtonPress: function() {
                    that._onBackToMain(oDetailView);
                },
                content: [oScrollContainer],
                footer: oFooterToolbar
            });

            // Crear la vista
            var oDetailView = new View({
                id: "dynamicDetailView_" + Date.now(),
                content: [oPage]
            });

            // Modelo para la vista
            var oDetailModel = new sap.ui.model.json.JSONModel(oSolicitudData);
            oDetailView.setModel(oDetailModel, "solicitudDetail");

            // Copiar otros modelos necesarios
            oDetailView.setModel(this._oMainView.getModel("config"), "config");
            oDetailView.setModel(this._oMainView.getModel("solicitudes"), "solicitudes");
            
            // Copiar el modelo de tipos de campo si existe
            if (this._oMainView.getModel("typeNav")) {
                oDetailView.setModel(this._oMainView.getModel("typeNav"), "typeNav");
            }

            return oDetailView;
        },

        /**
         * Crear formulario de solo lectura
         */
        _createReadOnlyForm: function(oSolicitudData) {
            var oForm = new SimpleForm({
                editable: true, // Cambiar a true para mejor alineación
                layout: "ResponsiveGridLayout",
                labelSpanXL: 3,
                labelSpanL: 3,
                labelSpanM: 4,
                labelSpanS: 12,
                adjustLabelSpan: false,
                emptySpanXL: 4,
                emptySpanL: 4,
                emptySpanM: 0,
                emptySpanS: 0,
                columnsXL: 1,
                columnsL: 1,
                columnsM: 1,
                singleContainerFullSize: false,
                content: []
            });
            
            this._createDisplayFields(oForm, oSolicitudData);
            return oForm;
        },
        
        /**
         * Crear campos de visualización basados en los datos recibidos
         */
        _createDisplayFields: function(oForm, oSolicitudData) {
            // Configuración básica de campos que siempre se muestran
            var aBaseFields = this._getBaseFieldsConfiguration();

            // Agregar campos base
            aBaseFields.forEach(function(oFieldConfig) {
                this._addDisplayField(oForm, oFieldConfig, oSolicitudData);
            }.bind(this));

            // Agregar campos dinámicos adicionales si existen
            this._addDynamicFields(oForm, oSolicitudData);
        },

        /**
         * Obtener configuración base de campos (centralizada)
         */
        _getBaseFieldsConfiguration: function() {
            return [
                {
                    property: "externalCode",
                    label: "ID Solicitud",
                    type: "text"
                },
                {
                    property: "cust_nombreSol",
                    label: "Nombre de Solicitud",
                    type: "text"
                },
                {
                    property: "cust_nombreTSol",
                    label: "Tipo de Solicitud", 
                    type: "text"
                },
                {
                    property: "cust_status",
                    label: "Estado",
                    type: "text",
                    formatter: this._formatStatus
                },
                {
                    property: "cust_fechaSol",
                    label: "Fecha Solicitud",
                    type: "date",
                    formatter: this.formatter.formatDateToYYYYMMDD
                },
                {
                    property: "effectiveStartDate",
                    label: "Fecha Inicio Efectiva",
                    type: "date",
                    formatter: this.formatter.formatDateToYYYYMMDD
                },
                {
                    property: "lastModifiedDateTime",
                    label: "Última Modificación",
                    type: "datetime"
                }
            ];
        },

        /**
         * Agregar un campo de visualización al formulario
         */
        _addDisplayField: function(oForm, oFieldConfig, oSolicitudData) {
            var vValue = oSolicitudData[oFieldConfig.property];
            
            // Solo agregar si el campo existe en los datos
            if (vValue !== undefined && vValue !== null) {
                // Crear label con labelFor para mejor alineación
                var sFieldId = "field_" + oFieldConfig.property + "_" + Date.now();
                var oLabel = new Label({
                    text: oFieldConfig.label,
                    labelFor: sFieldId
                });

                // Formatear el valor según el tipo
                var sDisplayValue = this._formatValue(vValue, oFieldConfig.type, oFieldConfig.formatter);

                // Crear campo de solo lectura
                var oDisplayField = new Input({
                    id: sFieldId,
                    value: sDisplayValue,
                    editable: false,
                    enabled: true
                });

                // Agregar al formulario
                oForm.addContent(oLabel);
                oForm.addContent(oDisplayField);
            }
        },

        /**
         * Agregar campos dinámicos adicionales basados en configuración
         */
        _addDynamicFields: function(oForm, oSolicitudData) {
            // Si hay modelo de configuración de tipos de campo, usarlo
            var oTypeNavModel = this._oMainView.getModel("typeNav");
            
            if (oTypeNavModel) {
                var aTypeConfig = oTypeNavModel.getProperty("/results") || [];
                
                // Filtrar configuraciones que apliquen a esta solicitud
                var aApplicableFields = aTypeConfig.filter(function(oConfig) {
                    // Aquí puedes agregar lógica para determinar qué campos mostrar
                    // basado en el tipo de solicitud o cualquier otro criterio
                    return oConfig.cust_status === "EN_CURSO"; // Solo en curso
                });

                // Crear campos basados en configuración
                aApplicableFields.forEach(function(oFieldConfig) {
                    this._createConfiguredField(oForm, oFieldConfig, oSolicitudData);
                }.bind(this));
            }

            // Agregar cualquier campo personalizado que exista en los datos
            this._addCustomFields(oForm, oSolicitudData);
        },

        /**
         * Crear campo basado en configuración de tipo
         */
        _createConfiguredField: function(oForm, oFieldConfig, oSolicitudData) {
            var sFieldProperty = oFieldConfig.cust_field || oFieldConfig.externalName;
            var vValue = oSolicitudData[sFieldProperty];

            if (vValue !== undefined && vValue !== null) {
                var sFieldId = "field_" + sFieldProperty + "_" + Date.now();
                var oLabel = new Label({
                    text: oFieldConfig.cust_etiquetaOutput_defaultValue || oFieldConfig.cust_etiquetaInput_defaultValue || sFieldProperty,
                    labelFor: sFieldId
                });

                var sDisplayValue = this._formatValueByType(vValue, oFieldConfig.cust_fieldType);

                var oDisplayField = new Input({
                    id: sFieldId,
                    value: sDisplayValue,
                    editable: false,
                    enabled: true
                });

                oForm.addContent(oLabel);
                oForm.addContent(oDisplayField);
            }
        },

        /**
         * Agregar campos personalizados que no estén en la configuración base
         */
        _addCustomFields: function(oForm, oSolicitudData) {
            // Generar campos procesados dinámicamente basado en la configuración base
            var aProcessedFields = this._getProcessedFieldsFromBaseConfig();
            
            // También agregar campos que ya fueron procesados por configuración externa
            var aConfiguredFields = this._getConfiguredFields();
            aProcessedFields = aProcessedFields.concat(aConfiguredFields);

            Object.keys(oSolicitudData).forEach(function(sProperty) {
                if (sProperty.startsWith("cust_") && 
                    aProcessedFields.indexOf(sProperty) === -1 &&
                    !sProperty.includes("_defaultValue") && 
                    !sProperty.includes("Nav") &&
                    !sProperty.includes("_localized") &&
                    !sProperty.includes("TranslationText")) {
                    
                    var vValue = oSolicitudData[sProperty];
                    if (vValue !== undefined && vValue !== null && vValue !== "") {
                        var sLabel = this._generateLabelFromProperty(sProperty);
                        var sFieldId = "field_" + sProperty + "_" + Date.now();
                        var oLabel = new Label({
                            text: sLabel,
                            labelFor: sFieldId
                        });

                        var oDisplayField = new Input({
                            id: sFieldId,
                            value: String(vValue),
                            editable: false,
                            enabled: true
                        });

                        oForm.addContent(oLabel);
                        oForm.addContent(oDisplayField);
                    }
                }
            }.bind(this));
        },

        /**
         * Obtener campos procesados desde la configuración base dinámicamente
         */
        _getProcessedFieldsFromBaseConfig: function() {
            var aBaseFields = this._getBaseFieldsConfiguration();

            // Extraer solo las propiedades
            return aBaseFields.map(function(oField) {
                return oField.property;
            });
        },

        /**
         * Obtener campos que ya fueron procesados por configuración externa (typeNav)
         */
        _getConfiguredFields: function() {
            var aConfiguredFields = [];
            var oTypeNavModel = this._oMainView.getModel("typeNav");
            
            if (oTypeNavModel) {
                var aTypeConfig = oTypeNavModel.getProperty("/results") || [];
                
                aTypeConfig.forEach(function(oConfig) {
                    if (oConfig.cust_status === "EN_CURSO") { // Solo en curso
                        var sFieldProperty = oConfig.cust_field || oConfig.externalName;
                        if (sFieldProperty && aConfiguredFields.indexOf(sFieldProperty) === -1) {
                            aConfiguredFields.push(sFieldProperty);
                        }
                    }
                });
            }
            
            return aConfiguredFields;
        },

        /**
         * Formatear valor según tipo
         */
        _formatValue: function(vValue, sType, fnFormatter) {
            if (fnFormatter) {
                return fnFormatter(vValue);
            }

            switch (sType) {
                case "date":
                    return this._formatDate(vValue);
                case "datetime":
                    return this._formatDateTime(vValue);
                case "text":
                default:
                    return String(vValue || "");
            }
        },

        /**
         * Formatear valor por tipo de campo de configuración
         */
        _formatValueByType: function(vValue, sFieldType) {
            if (!sFieldType) return String(vValue || "");

            switch (sFieldType.toUpperCase()) {
                case "DATE":
                case "DATEPICKER":
                    return this._formatDate(vValue);
                case "BOOLEAN":
                case "CHECKBOX":
                    return vValue ? "Sí" : "No";
                case "NUMBER":
                case "INTEGER":
                    return Number(vValue).toLocaleString();
                default:
                    return String(vValue || "");
            }
        },

        /**
         * Formatear fecha
         */
        _formatDate: function(vDate) {
            if (!vDate) return "";
            
            var dDate;
            if (vDate instanceof Date) {
                dDate = vDate;
            } else if (typeof vDate === "string") {
                // Manejar formato SAP /Date(timestamp)/
                if (vDate.includes("/Date(")) {
                    var timestamp = vDate.match(/\d+/)[0];
                    dDate = new Date(parseInt(timestamp));
                } else {
                    dDate = new Date(vDate);
                }
            } else {
                return String(vDate);
            }

            return dDate.toLocaleDateString('es-ES');
        },

        /**
         * Formatear fecha y hora
         */
        _formatDateTime: function(vDateTime) {
            if (!vDateTime) return "";
            
            var dDate;
            if (vDateTime instanceof Date) {
                dDate = vDateTime;
            } else if (typeof vDateTime === "string") {
                if (vDateTime.includes("/Date(")) {
                    var timestamp = vDateTime.match(/\d+/)[0];
                    dDate = new Date(parseInt(timestamp));
                } else {
                    dDate = new Date(vDateTime);
                }
            } else {
                return String(vDateTime);
            }

            return dDate.toLocaleString('es-ES');
        },

        /**
         * Formatear estado
         */
        _formatStatus: function(sStatus) {
            var oStatusMap = {
                "EN_CURSO": "En Curso",
                "COMPLETADO": "Completado", 
                "CANCELADO": "Cancelado",
                "RECHAZADO": "Rechazado"
            };

            return oStatusMap[sStatus] || sStatus;
        },

        /**
         * Generar etiqueta legible desde nombre de propiedad
         */
        _generateLabelFromProperty: function(sProperty) {
            // Remover prefijo cust_ y convertir camelCase a palabras
            var sClean = sProperty.replace(/^cust_/, "");
            return sClean.replace(/([A-Z])/g, " $1")
                         .replace(/^./, function(str) { return str.toUpperCase(); })
                         .trim();
        },

        /**
         * Manejar cancelación de solicitud desde vista de detalle
         */
        _onCancelRequest: function(oSolicitudData, oDetailView) {
            var that = this;
            
            if (this._oController && this._oController.onCancelarSolicitudFromDetail) {
                this._oController.onCancelarSolicitudFromDetail(
                    oSolicitudData.idSolicitud || oSolicitudData.externalCode, 
                    oSolicitudData.cust_nombreSol || oSolicitudData.externalCode
                ).then(function(bWasCancelled) {
                    if (bWasCancelled) {                        
                        setTimeout(function() {
                            that._onBackToMain(oDetailView);
                        }, 500);
                    } else {
                        MessageToast.show("Operación cancelada.");
                    }
                }).catch(function(error) {
                    MessageToast.show("Error al procesar la cancelación: " + error);
                });
            } else {
                MessageToast.show("Error: No se pudo acceder a la función de cancelación");
            }
        },

        /**
         * Volver a la vista principal
         */
        _onBackToMain: function(oDetailView) {
            var oApp = this._oMainView.getParent();            
            
            // Volver a la vista principal
            oApp.back();
            
            // Remover la vista dinámica para limpiar memoria
            setTimeout(function() {
                if (oDetailView) {
                    oApp.removePage(oDetailView);
                    oDetailView.destroy();
                }
            }, 500);
        },

        /**
         * Obtener referencia al controlador principal
         */
        getMainController: function() {
            return this._oController;
        }
    });
});