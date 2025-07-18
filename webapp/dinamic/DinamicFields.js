sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/core/mvc/View",
    "sap/m/Page",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ScrollContainer"
], function (BaseObject, View, Page, Label, Input, DatePicker, TextArea, CheckBox, SimpleForm, MessageToast, Button, Toolbar, ToolbarSpacer, ScrollContainer) {
    "use strict";

    return BaseObject.extend("com.inetum.missolicitudes.dinamic.DinamicFields", {
        
        constructor: function(oController) {
            BaseObject.prototype.constructor.apply(this, arguments);
            this._oController = oController; // Referencia al controlador principal
            this._oMainView = oController.getView();
        },

        /**
         * Mostrar vista de detalle dinámica
         */
        showDynamicDetailView: function(sSolicitudId) {
            // Buscar la solicitud
            var oSolicitudesModel = this._oMainView.getModel("solicitudes");
            var aSolicitudes = oSolicitudesModel.getProperty("/solicitudes/results");
            
            var oSolicitud = aSolicitudes.find(function(item) {
                return item.idSolicitud === sSolicitudId;
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
            
            // Crear formulario dinámico
            var oForm = this._createDynamicForm(oSolicitudData);
            
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
                visible: oSolicitudData.cust_status === "EN_CURSO", // Solo visible si está en curso
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
                title: "Detalle: " + oSolicitudData.cust_nombreSol,
                showNavButton: true,
                navButtonPress: function() {
                    that._onBackToMain(oDetailView);
                },
                content: [oScrollContainer],
                footer: oFooterToolbar
            });

            // Crear la vista
            var oDetailView = new View({
                id: "dynamicDetailView_" + Date.now(), // ID único
                content: [oPage]
            });

            // Modelo para la vista
            var oDetailModel = new sap.ui.model.json.JSONModel(oSolicitudData);
            oDetailView.setModel(oDetailModel, "solicitudDetail");

            // Copiar otros modelos
            oDetailView.setModel(this._oMainView.getModel("config"), "config");
            oDetailView.setModel(this._oMainView.getModel("solicitudes"), "solicitudes");

            return oDetailView;
        },

        /**
         * Crear formulario dinámico
         */
        _createDynamicForm: function(oSolicitudData) {
            var oForm = new SimpleForm({
                editable: true,
                layout: "ResponsiveGridLayout",
                labelSpanXL: 3,
                labelSpanL: 3,
                labelSpanM: 12,
                labelSpanS: 12,
                adjustLabelSpan: false,
                emptySpanXL: 4,
                emptySpanL: 4,
                emptySpanM: 0,
                emptySpanS: 0,
                columnsXL: 1,
                columnsL: 1,
                columnsM: 1,
                content: []
            });
            
            this._createFieldsFromData(oForm, oSolicitudData);
            return oForm;
        },
        
        /**
         * Crear campos
         */
        _createFieldsFromData: function(oForm, oSolicitudData) {
            var aFieldConfig = [
                {
                    property: "idSolicitud",
                    label: "ID Solicitud",
                    type: "Input",
                    editable: false
                },
                {
                    property: "cust_nombreSol",
                    label: "Nombre de Solicitud",
                    type: "Input",
                    editable: false
                },
                {
                    property: "cust_nombreTSol",
                    label: "Tipo de Solicitud",
                    type: "Input",
                    editable: false
                },
                {
                    property: "cust_status",
                    label: "Estado",
                    type: "Input",
                    editable: false
                },
                {
                    property: "cust_fechaSol",
                    label: "Fecha Solicitud",
                    type: "Input",
                    editable: false,
                    formatter: function(dDate) {
                        if (dDate && dDate instanceof Date) {
                            return dDate.toLocaleDateString('es-ES');
                        }
                        return dDate;
                    }
                }
            ];
            
            aFieldConfig.forEach(function(oFieldConfig) {
                if (oSolicitudData.hasOwnProperty(oFieldConfig.property)) {
                    var oLabel = new Label({
                        text: oFieldConfig.label
                    });
                    
                    var vValue = oSolicitudData[oFieldConfig.property];
                    
                    // Aplicar formatter si existe
                    if (oFieldConfig.formatter) {
                        vValue = oFieldConfig.formatter(vValue);
                    }
                    
                    var oControl = new Input({
                        value: vValue,
                        editable: oFieldConfig.editable !== false
                    });
                    
                    oForm.addContent(oLabel);
                    oForm.addContent(oControl);
                }
            });
        },

        /**
         * CORREGIDO: Manejar cancelación de solicitud desde vista de detalle
         * Ahora espera la respuesta del usuario antes de navegar
         */
        _onCancelRequest: function(oSolicitudData, oDetailView) {
            var that = this;
            
            // Llamar a la función del controlador principal y esperar respuesta
            if (this._oController && this._oController.onCancelarSolicitudFromDetail) {
                this._oController.onCancelarSolicitudFromDetail(
                    oSolicitudData.idSolicitud, 
                    oSolicitudData.cust_nombreSol
                ).then(function(bWasCancelled) {
                    // Solo navegar de vuelta si el usuario confirmó la cancelación
                    if (bWasCancelled) {                        
                        setTimeout(function() {
                            that._onBackToMain(oDetailView);
                        }, 500);
                    } else {
                        // El usuario canceló la acción, permanecer en la vista de detalle
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
         * MÉTODO PÚBLICO: Obtener referencia al controlador principal
         * Útil para acceder a otras funciones del controlador desde fuera
         */
        getMainController: function() {
            return this._oController;
        }
    });
});