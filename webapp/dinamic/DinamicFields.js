sap.ui.define([
    "sap/ui/base/Object",
    "../model/formatter",
    "sap/ui/core/mvc/View",
    "sap/m/Page",
    "sap/m/Label",
    "sap/m/Input",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ScrollContainer",
    "sap/m/Panel", 
    "sap/ui/layout/VerticalLayout",  
    "sap/ui/layout/Grid",
    "../service/Service",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../Utils/Util"
], function (BaseObject, formatter, View, Page, Label, Input, SimpleForm, MessageToast, Button, Toolbar, ToolbarSpacer, ScrollContainer, Panel, VerticalLayout, Grid, Service, Filter, FilterOperator, Util) {
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
        showDynamicDetailView: async function(sSolicitudId) {
            try {
                Util.showBI(true);
                
                // Buscar la solicitud en los datos ya cargados
                var oSolicitud = this._findSolicitudById(sSolicitudId);
                if (!oSolicitud) {
                    MessageToast.show("Solicitud no encontrada: " + sSolicitudId);
                    Util.showBI(false);
                    return;
                }

                // Cargar campos dinámicos DM_0003
                var aDynamicFields = await this._loadDynamicFields(sSolicitudId);
                
                // Crear la vista dinámica
                var oDetailView = this._createDetailView(oSolicitud, aDynamicFields);
                
                // Navegar a la vista
                this._navigateToDetailView(oDetailView);
                
                Util.showBI(false);
                
            } catch (error) {
                Util.showBI(false);
                MessageToast.show("Error al cargar vista de detalle: " + error.message);
                console.error("Error showDynamicDetailView:", error);
            }
        },

        /**
         * Buscar solicitud por ID
         */
        _findSolicitudById: function(sSolicitudId) {
            var oSolicitudesModel = this._oMainView.getModel("solicitudes");
            var aSolicitudes = oSolicitudesModel.getProperty("/solicitudes/results");
            
            return aSolicitudes.find(function(item) {
                return item.externalCode === sSolicitudId;
            });
        },

        /**
         * Cargar campos dinámicos desde DM_0003
         */
        _loadDynamicFields: async function(sSolicitudId) {
            try {
                var oSolicitud = this._findSolicitudById(sSolicitudId);
                if (!oSolicitud) {
                    throw new Error("Solicitud no encontrada");
                }

                var oModel = this._oController.getOwnerComponent().getModel();
                
                // Filtro por external code
                var aFilters = [
                    new Filter("cust_INETUM_SOL_DM_0001_externalCode", 
                              FilterOperator.EQ, 
                              oSolicitud.externalCode)
                ];

                // Parámetros básicos
                var oParam = {
                    bParam: true,
                    oParameter: {
                        "$format": "json",
                        "$orderby": "externalCode asc"
                    }
                };

                // Llamar al servicio
                var { data } = await Service.readDataERP("/cust_INETUM_SOL_DM_0003", oModel, aFilters, oParam);                
          
                return data.results || [];
                
            } catch (error) {
                console.error("Error cargando campos dinámicos:", error);
                return [];
            }
        },

        /**
         * Crear vista de detalle con Panel y márgenes
         */
        _createDetailView: function(oSolicitud, aDynamicFields) {
            var that = this;
            
            // Crear formulario simple
            var oForm = this._createSimpleForm(oSolicitud, aDynamicFields);
            
            // Crear Panel que contenga el formulario
            var oPanel = this._createPanelWithForm(oForm, oSolicitud);
            
            // VerticalLayout con márgenes para contener el panel
            var oLayoutWithMargins = this._createLayoutWithMargins(oPanel);
            
            // ScrollContainer
            var oScrollContainer = new ScrollContainer({
                height: "100%",
                horizontal: false,
                vertical: true,
                content: [oLayoutWithMargins]
            });

            var oCancelRequestButton = new Button({
                text: "Cancelar Solicitud",
                type: "Reject",
                visible: oSolicitud.cust_status === "EN_CURSO",
                press: function() {
                    that._onCancelRequest(oSolicitud, oDetailView);
                }
            });

            // Botones del footer
            var oCloseButton = new Button({
                text: "Cerrar",
                type: "Emphasized",
                press: function() {
                    that._onBackToMain(oDetailView);
                }
            });

            var oFooterToolbar = new Toolbar({
                content: [
                    new ToolbarSpacer(),
                    oCancelRequestButton,
                    oCloseButton
                ]
            });

            // Página
            var oPage = new Page({
                title: "Solicitud: " + oSolicitud.externalCode,
                showNavButton: true,
                navButtonPress: function() {
                    that._onBackToMain(oDetailView);
                },
                content: [oScrollContainer],
                footer: oFooterToolbar
            });

            // Vista
            var oDetailView = new View({
                id: "dynamicDetailView_" + Date.now(),
                content: [oPage]
            });

            return oDetailView;
        },

        /**
         * Crear Panel que contiene el formulario
         */
        _createPanelWithForm: function(oForm, oSolicitud) {
            var oPanel = new Panel({
                headerText: "Detalles de la Solicitud",
                expandable: false,
                expanded: false,
                backgroundDesign: "Translucent",
                content: [oForm],
                width: "100%"
            });

            return oPanel;
        },

        /**
         * Crear layout con márgenes alrededor del panel usando Grid
         */
        _createLayoutWithMargins: function(oPanel) {
            // Usar Grid para centrar el panel de forma nativa
            var oGrid = new Grid({
                defaultSpan: "XL12 L12 M12 S12",
                hSpacing: 1,
                vSpacing: 1,
                content: [oPanel]
            });

            oGrid.addStyleClass("sapUiMediumMarginTop");

            return oGrid;
        },

        /**
         * Crear formulario simple con campos básicos + dinámicos
         */
        _createSimpleForm: function(oSolicitud, aDynamicFields) {
            var oForm = new SimpleForm({
                editable: true,
                layout: "ResponsiveGridLayout",
                // Configuración para dos columnas con espaciado reducido
                labelSpanXL: 4,
                labelSpanL: 4,
                labelSpanM: 4,
                labelSpanS: 12,
                adjustLabelSpan: false,
                emptySpanXL: 0,
                emptySpanL: 0,
                emptySpanM: 0,
                emptySpanS: 0,
                // Configurar para 2 columnas en pantallas grandes
                columnsXL: 2,
                columnsL: 2,
                columnsM: 1,
                content: []
            });
            
            //  Agregar campos básicos
            this._addBasicFields(oForm, oSolicitud);
            
            // Agregar campos dinámicos directamente
            this._addDynamicFields(oForm, aDynamicFields);
            
            return oForm;
        },

        /**
         * Agregar campos básicos de la solicitud
         */
        _addBasicFields: function(oForm, oSolicitud) {
            var aBasicFields = [
                {
                    property: "externalCode",
                    label: "Solicitud"
                },
                {
                    property: "cust_status", 
                    label: "Estado",
                    formatter: this._formatStatus
                },
                {
                    property: "effectiveStartDate",
                    label: "Fecha Inicio Efectiva",
                    formatter: this._formatDate
                },
                {
                    property: "lastModifiedDateTime",
                    label: "Última Modificación",
                    formatter: this._formatDateTime
                }
            ];

            aBasicFields.forEach(function(oFieldConfig) {
                this._addField(oForm, oFieldConfig.label, oSolicitud[oFieldConfig.property], oFieldConfig.formatter);
            }.bind(this));
        },

        /**
         * Agregar campos dinámicos (todos los registros del array)
         */
        _addDynamicFields: function(oForm, aDynamicFields) {
            if (!aDynamicFields || aDynamicFields.length === 0) {              
                return;
            }       

            // Mostrar TODOS los registros del array, sin filtrar
            aDynamicFields.forEach(function(oDynamicField, index) {
                var sLabel = "Campo " + (index + 1);
                var sValue = oDynamicField.cust_value || "(Vacío)";
                
                this._addField(oForm, sLabel, sValue);
     
            }.bind(this));
           
        },

        /**
         * Agregar un campo simple al formulario
         */
        _addField: function(oForm, sLabel, vValue, fnFormatter) {
            // Formatear valor si hay formatter
            var sDisplayValue = vValue;
            if (fnFormatter && vValue !== undefined && vValue !== null) {
                sDisplayValue = fnFormatter(vValue);
            }
            
            // Si el valor está vacío, mostrar texto por defecto
            if (sDisplayValue === undefined || sDisplayValue === null || sDisplayValue === "") {
                sDisplayValue = "(Vacío)";
            }
            
            // Crear elementos
            var sFieldId = "field_" + Date.now() + "_" + Math.random();
            
            var oLabel = new Label({
                text: sLabel,
                labelFor: sFieldId
            });

            var oInput = new Input({
                id: sFieldId,
                value: String(sDisplayValue),
                editable: false,
                enabled: true
            });

            // Agregar al formulario
            oForm.addContent(oLabel);
            oForm.addContent(oInput);
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
         * Formatear fecha
         */
        _formatDate: function(vDate) {
            if (!vDate) return "";
            
            try {
                var dDate;
                if (vDate instanceof Date) {
                    dDate = vDate;
                } else if (typeof vDate === "string") {
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
            } catch (error) {
                return String(vDate);
            }
        },

        /**
         * Formatear fecha y hora
         */
        _formatDateTime: function(vDateTime) {
            if (!vDateTime) return "";
            
            try {
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
            } catch (error) {
                return String(vDateTime);
            }
        },

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
         * Navegar a vista de detalle
         */
        _navigateToDetailView: function(oDetailView) {
            var oApp = this._oMainView.getParent();
            oApp.addPage(oDetailView);
            oApp.to(oDetailView.getId());
        },

        /**
         * Volver a la vista principal
         */
        _onBackToMain: function(oDetailView) {
            var oApp = this._oMainView.getParent();
            
            // Volver
            oApp.back();
            
            // Limpiar memoria
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