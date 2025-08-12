sap.ui.define([
    "sap/ui/base/Object",
    "../model/formatter",
    "sap/ui/core/mvc/View",
    "sap/m/Page",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/TextArea",
    "sap/m/UploadCollection",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ScrollContainer",
    "sap/m/Panel",
    "sap/ui/layout/Grid",
    "../service/Service",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../Utils/Util",
    "../Utils/Lenguaje"
], function (BaseObject, 
            formatter, 
            View, 
            Page, 
            Label, 
            Input, 
            DatePicker, 
            TextArea, 
            UploadCollection, 
            SimpleForm, 
            MessageToast, 
            Button, 
            Toolbar, 
            ToolbarSpacer, 
            ScrollContainer, 
            Panel, 
            Grid, 
            Service, 
            Filter, 
            FilterOperator, 
            Util,
            Lenguaje) {
    "use strict";

    return BaseObject.extend("com.inetum.missolicitudes.dinamic.DinamicFields", {
        formatter: formatter,

        constructor: function (oController) {
            BaseObject.prototype.constructor.apply(this, arguments);
            this._oController = oController;
            this._oMainView = oController.getView();
        },

        /**
         * Mostrar vista de detalle dinámica
         */
        showDynamicDetailView: async function (sSolicitudId) {
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

                if (aDynamicFields.length === 0) Util.showBI(false);

                // Crear la vista dinámica
                var oDetailView = this._createDetailView(oSolicitud, aDynamicFields);

                // Navegar a la vista
                this._navigateToDetailView(oDetailView);

                // Util.showBI(false);

            } catch (error) {
                Util.showBI(false);
                MessageToast.show("Error al cargar vista de detalle: " + error.message);
                console.error("Error showDynamicDetailView:", error);
            }
        },

        /**
         * Buscar solicitud por ID
         */
        _findSolicitudById: function (sSolicitudId) {
            var oSolicitudesModel = this._oMainView.getModel("solicitudes");
            var aSolicitudes = oSolicitudesModel.getProperty("/solicitudes/results");

            return aSolicitudes.find(function (item) {
                return item.externalCode === sSolicitudId;
            });
        },

        /**
         * Cargar campos dinámicos desde DM_0003
         */
        _loadDynamicFields: async function (sSolicitudId) {
            try {

                var oSolicitud = this._findSolicitudById(sSolicitudId);
                if (!oSolicitud) {
                    throw new Error("Solicitud no encontrada");
                }

                var aCustFields = oSolicitud.cust_solFields.results;
                return aCustFields || [];

            } catch (error) {
                console.error("Error cargando campos dinámicos:", error);
                return [];
            }
        },

        /**
         * Crear vista de detalle con Panel y márgenes
         */
        _createDetailView: function (oSolicitud, aDynamicFields) {
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
                press: function () {
                    that._onCancelRequest(oSolicitud, oDetailView);
                }
            });

            // Botones del footer
            var oCloseButton = new Button({
                text: "Cerrar",
                type: "Emphasized",
                press: function () {
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
                title: oSolicitud.cust_nombreSol,
                showNavButton: true,
                navButtonPress: function () {
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
        _createPanelWithForm: function (oForm) {
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
        _createLayoutWithMargins: function (oPanel) {
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
        _createSimpleForm: function (oSolicitud, aDynamicFields) {
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

            // Agregar campos dinámicos directamente
            this._addDynamicFields(oForm, aDynamicFields);

            return oForm;
        },

        /**
         * Agregar campos dinámicos (todos los registros del array)
         */
        _addDynamicFields: async function (oForm, aDynamicFields) {
            let iTotalAttachments = 0;

            if (!aDynamicFields || aDynamicFields.length === 0) {
                Util.showBI(false);
                return;
            }

            aDynamicFields.forEach(field => {
                if (field.cust_fieldtype === "A") {
                    iTotalAttachments++;
                }
            });

            
            for (let index = 0; index < aDynamicFields.length; index++) {
                const oDynamicField = aDynamicFields[index];
                // const sLabel = "Campo " + (index + 1);
                const sLabel = Lenguaje.obtenerNombreConcatenado("cust_etiquetaInput");
                let sValue = oDynamicField.cust_value || "(Vacío)";        
              
                if (oDynamicField.cust_fieldtype === "P" && sValue !== "(Vacío)" && sValue.trim() !== "") {
                    try {
                        const oModel = this._oController.getOwnerComponent().getModel();
                        const aFilter = [new Filter("optionId", FilterOperator.EQ, sValue)];
                        const data = await Service.readDataERP("/PicklistLabel", oModel, aFilter);
                        
                        if (data?.data?.results?.length) {
                            sValue = data.data.results[0].label || sValue;
                        }
                    } catch (error) {
                        console.error("Error cargando picklist label:", error);                      
                    }
                }
        
                this._addField(oForm, sLabel, sValue, oDynamicField.cust_fieldtype, oDynamicField.cust_value);
            }

            if (iTotalAttachments === 0) Util.showBI(false);            

        },

        /**
         * Agregar un campo simple al formulario
         */
        _addField: function (oForm, sLabel, vValue, sTipyField, sCustValue) {
            // Formatear valor si hay formatter
            let sDisplayValue = vValue;
            let oField = null;

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

            switch (String(sTipyField)) {
                case "P":
                    oField = this._createPicklistField(sFieldId, sDisplayValue);
                    break;
                case "F":
                    oField = this._createDateField(sFieldId, sDisplayValue);
                    break;
                case "I":
                    oField = this._createInputField(sFieldId, sDisplayValue);
                    break;
                case "S":
                    oField = this._createTextAreaField(sFieldId, sDisplayValue);
                    break;
                case "A":                   
                    oField = this._createFileUploaderField(sFieldId, sCustValue);
                    break;

                default:
                    oField = this._createInputField(sFieldId, sDisplayValue);
            }

            // Agregar al formulario
            oForm.addContent(oLabel);
            oForm.addContent(oField);
            
        },

        _createPicklistField: function (sFieldId, sDisplayValue) {
            const oInput = new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: false,
                enabled: true
            });
            
            return oInput;
        },

        _createInputField: function (sFieldId, sDisplayValue) {
            return new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: false,
                enabled: true
            });
        },

        _createDateField: function (sFieldId, sDisplayValue) {
            return new DatePicker({
                id: sFieldId,
                value: sDisplayValue,
                editable: false,
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd"
            });
        },

        _createTextAreaField: function (sFieldId, sDisplayValue) {
            return new TextArea({
                id: sFieldId,
                value: sDisplayValue,
                editable: false,
                rows: 3
            });
        },

        _createFileUploaderField: function (sFieldId, sCustValue) {
            const oUpload = new UploadCollection({
                mode: sap.m.ListMode.SingleSelectMaster,
                id: sFieldId,
                multiple: false,
                uploadEnabled: false,
                terminationEnabled: false,
                instantUpload: false,
                showSeparators: "All",
                change: this._oController.onDetectorAdjunto.bind(this._oController)
            });

            const oModel = this._oController.getOwnerComponent().getModel();
            const aFilter = [ new Filter("attachmentId", FilterOperator.EQ, sCustValue) ];

            Service.readDataERP("/Attachment", oModel, aFilter)
                .then(data => {
                    if (data?.data?.results?.length) {
                        const oItem = this._viewAttachment(data.data.results[0]);
                        oUpload.addItem(oItem);
                        Util.showBI(false);
                    }
                })
                .catch(error => {
                    console.error("Error cargando attachment:", error.message);
                    Util.showBI(false);
                });

            return oUpload;

        },

        _viewAttachment: function (attachment) {
            const oItem = new sap.m.UploadCollectionItem({
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                url: this._crearDataURI(attachment.mimeType, attachment.fileContent),
                attributes: [
                    new sap.m.ObjectAttribute({
                        title: "Descargar",
                        text: attachment.fileName,
                        active: true
                    })
                ],
                enableEdit: false,
                enableDelete: false,
                visibleEdit: false,
                visibleDelete: false
            });

            oItem.attachPress(function (oEvent) {
                oEvent.preventDefault();
                const sDataURI = this.getUrl();
                const sFileName = this.getFileName();
                const a = document.createElement('a');
                a.href = sDataURI;
                a.download = sFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });

            return oItem;
        },

        _crearDataURI: function (sMimeType, sBase64) {
            return "data:" + sMimeType + ";base64," + sBase64;
        },

        _onCancelRequest: function (oSolicitudData, oDetailView) {
            var that = this;

            if (this._oController && this._oController.onCancelarSolicitudFromDetail) {
                this._oController.onCancelarSolicitudFromDetail(                    
                    oSolicitudData.cust_nombreSol, oSolicitudData.externalCode
                ).then(function (bWasCancelled) {
                    if (bWasCancelled) {
                        setTimeout(function () {
                            that._onBackToMain(oDetailView);
                        }, 500);
                    }
                }).catch(function (error) {
                    MessageToast.show("Error al procesar la cancelación: " + error);
                });
            } else {
                MessageToast.show("Error: No se pudo acceder a la función de cancelación");
            }
        },

        /**
         * Navegar a vista de detalle
         */
        _navigateToDetailView: function (oDetailView) {
            var oApp = this._oMainView.getParent();
            oApp.addPage(oDetailView);
            oApp.to(oDetailView.getId());          
        },

        /**
         * Volver a la vista principal
         */
        _onBackToMain: function (oDetailView) {
            var oApp = this._oMainView.getParent();

            // Volver
            oApp.back();

            // Limpiar memoria
            setTimeout(function () {
                if (oDetailView) {
                    oApp.removePage(oDetailView);
                    oDetailView.destroy();
                }
            }, 500);
        },

        /**
         * Obtener referencia al controlador principal
         */
        getMainController: function () {
            return this._oController;
        }
    });
});