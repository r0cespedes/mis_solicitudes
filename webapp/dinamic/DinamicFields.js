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
        showDynamicDetailView: async function (sSolicitudId, bEditMode = false) {
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
                var oDetailView = this._createDetailView(oSolicitud, aDynamicFields, bEditMode);

                // Navegar a la vista
                this._navigateToDetailView(oDetailView);



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
        _createDetailView: function (oSolicitud, aDynamicFields, bEditMode = false) {
            var that = this;

            this._updateResourceBundle();

            // Crear formulario simple
            var oForm = this._createSimpleForm(oSolicitud, aDynamicFields, bEditMode);

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
                text: this.oResourceBundle.getText("cancelRequest"),
                type: "Reject",
                visible: oSolicitud.cust_status === "EC",
                press: function () {
                    that._onCancelRequest(oSolicitud, oDetailView);
                }
            });

            // Botones del footer

            var oSaveButton = new Button({
                text: this.oResourceBundle.getText("save"),
                type: "Accept",
                visible: bEditMode,
                press: function () {
                    that._onSaveChanges(oSolicitud, oDetailView);
                }
            });

            var oCloseButton = new Button({
                text: this.oResourceBundle.getText("close"),
                type: "Emphasized",
                press: function () {
                    that._onBackToMain(oDetailView);
                }
            });

            var oFooterToolbar = new Toolbar({
                content: [
                    new ToolbarSpacer(),
                    oCancelRequestButton,
                    oSaveButton,
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

        _onSaveChanges: async function (oSolicitud, oDetailView) {
            try {
                const oModel = this._oController.getOwnerComponent().getModel();
                let oFile = this._oController._archivosParaSubir;

                if (oFile) {
                    const oDatos_Adjunto = {
                        fileName: oFile.nombre,
                        fileContent: oFile.contenido,
                        module: "GENERIC_OBJECT",
                        userId: this._oController.oCurrentUser.name
                    };
                    await Service.createDataERP("/Attachment", oModel, oDatos_Adjunto);
                }

                var sEntityPath = this._oController._buildEntityPath(oSolicitud.externalCode, oSolicitud.effectiveStartDate);
                const iCurrentIndexStep = parseInt(oSolicitud.cust_indexStep, 10) || 0;
                const iNewIndexStep = (iCurrentIndexStep >= 1) ? iCurrentIndexStep + 1 : iCurrentIndexStep;

                const oDatos_DM_0001 = {
                    cust_status: "EC",
                    cust_indexStep: iNewIndexStep,
                    cust_fechaAct: new Date()
                };


                oModel.update(sEntityPath, oDatos_DM_0001, {
                    success: function (oData, oResponse) {
                        console.log("Update DM_0001 OK:", oResponse);
                    },
                    error: function (oError) {
                        console.error("Update DM_0001 Error:", oError);
                    }
                });


                oSolicitud.cust_indexStep = iNewIndexStep;
                this.onSearchSteps(oSolicitud);

                MessageToast.show(this.oResourceBundle.getText("ChangesSavedSuccessfully"));
                this._onBackToMain(oDetailView);

                setTimeout(function () {
                    this._oController.onGetDM001();
                }.bind(this), 1000);

            } catch (error) {
                console.error("Error en _onSaveChanges:", error);
                Util.onShowMessage("ErrorSavingChanges", "error");
            }
        },


        onSearchSteps: function (oSolicitud) {
            const oModel = this._oController.getOwnerComponent().getModel();

            for (let i = 0; i < oSolicitud.cust_steps.results.length; i++) {
                const oStep = oSolicitud.cust_steps.results[i];
                const iStepNumber = parseInt(oStep.cust_seqStep, 10);

                const bNewActiveStatus = iStepNumber !== 1;

                // Solo actualizar si cambió el estado
                if (oStep.cust_activeStep !== bNewActiveStatus) {
                    const sStepPath = this._buildStepEntityPath(
                        oSolicitud.externalCode,
                        oSolicitud.effectiveStartDate,
                        oStep.externalCode
                    );

                    const oDatos_DM_0002 = {
                        cust_activeStep: bNewActiveStatus
                    };

                    oModel.update(sStepPath, oDatos_DM_0002, {
                        success: function (oData, oResponse) {
                            console.log("Step", iStepNumber, "actualizado a:", bNewActiveStatus);
                        },
                        error: function (oError) {
                            console.error("Error step", iStepNumber, oError);
                        }
                    });
                }
            }
        },

        /**
         * Construir path de entidad para DM_0002 (steps)
         */
        _buildStepEntityPath: function (sDM0001ExternalCode, sEffectiveStartDate, sStepExternalCode) {
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            var sEntityPath = `/cust_INETUM_SOL_DM_0002(` +
                `cust_INETUM_SOL_DM_0001_effectiveStartDate=datetime'${sFormattedDate}',` +
                `cust_INETUM_SOL_DM_0001_externalCode='${sDM0001ExternalCode}',` +
                `externalCode='${sStepExternalCode}')`;

            return sEntityPath;
        },

        _cargarOpcionesPicklist: async function (sPicklistId) {
            if (sPicklistId === "Tipus de carnet") {
                sPicklistId = "Tipus_de_carnet";
            }

            try {

                const sLang = this.getOwnerComponent().getModel("user").getProperty("/detail/defaultLocale");
                const oModel = this.getOwnerComponent().getModel();
                const oParametrosPicklist = {
                    bParam: true,
                    oParameter: {
                        "$expand": "picklistOptions,picklistOptions/picklistLabels",
                        "$format": "json"
                    }
                };
                const sRutaEntidad = `/Picklist(picklistId='${sPicklistId}')`;
                const oRespuesta = await Service.readDataERP(sRutaEntidad, oModel, [], oParametrosPicklist);

                const aOpciones = [];
                const mMap = {
                    "es_ES": "es_ES",
                    "en_US": "en_US",
                    "ca_ES": "ca_ES",
                    "en_DEBUG": "en_US"
                };
                const sLocaleBuscado = mMap[sLang];

                if (oRespuesta.data?.picklistOptions?.results) {
                    oRespuesta.data.picklistOptions.results.forEach(oOption => {
                        const oLabelEncontrado = sLocaleBuscado
                            ? oOption.picklistLabels.results.find(label => label.locale === sLocaleBuscado)
                            : undefined;
                        if (oLabelEncontrado) {
                            aOpciones.push({
                                key: oLabelEncontrado.optionId,
                                text: oLabelEncontrado.label
                            });
                        }
                    });
                }
                return aOpciones;

            } catch (oError) {
                const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                console.warn(oResourceBundle.getText("warn.picklistLoadFailed", [sPicklistId]), oError);
                return [];
            }
        },


        _updateResourceBundle: function () {
            try {
                var oI18nModel = this._oController.getOwnerComponent().getModel("i18n");
                if (oI18nModel) {
                    this.oResourceBundle = oI18nModel.getResourceBundle();
                }
            } catch (error) {
                console.error("Error actualizando ResourceBundle:", error);
            }
        },

        /**
         * Crear Panel que contiene el formulario
         */
        _createPanelWithForm: function (oForm) {
            var oPanel = new Panel({
                headerText: this.oResourceBundle.getText("requestDetails"), // this.oResourceBundle.getText("requestDetails")
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
        _createSimpleForm: function (oSolicitud, aDynamicFields, bEditMode = false) {
            var oForm = new SimpleForm({
                editable: bEditMode,
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
            this._addDynamicFields(oForm, aDynamicFields, oSolicitud, bEditMode);

            return oForm;
        },

        /**
         * Agregar campos dinámicos (todos los registros del array)
         */
        _addDynamicFields: async function (oForm, aDynamicFields, oSolicitud, bEditMode = false) {
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
                const sLabel = Lenguaje.obtenerValorLocalizado(oDynamicField, "cust_etiqueta");
                let sValue = oDynamicField.cust_value || "";

                if (oDynamicField.cust_fieldtype === "P" && sValue !== "" && sValue.trim() !== "") {
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

                let bFieldEditable = bEditMode && (oSolicitud.cust_status === "RA");

                this._addField(oForm, sLabel, sValue, oDynamicField.cust_fieldtype, oDynamicField.cust_value, bFieldEditable);
            }

            if (iTotalAttachments === 0) Util.showBI(false);

        },

        /**
         * Agregar un campo simple al formulario
         */
        _addField: function (oForm, sLabel, vValue, sTipyField, sCustValue, bEditable) {
            // Formatear valor si hay formatter
            let sDisplayValue = vValue;
            let oField = null;

            // Si el valor está vacío, mostrar texto por defecto
            if (sDisplayValue === undefined || sDisplayValue === null || sDisplayValue === "") {
                sDisplayValue = "";
            }

            // Crear elementos
            var sFieldId = "field_" + Date.now() + "_" + Math.random();

            var oLabel = new Label({
                text: sLabel,
                labelFor: sFieldId
            });

            switch (String(sTipyField)) {
                case "P":
                    oField = this._createPicklistField(sFieldId, sDisplayValue, bEditable);
                    break;
                case "F":
                    oField = this._createDateField(sFieldId, sDisplayValue, bEditable);
                    break;
                case "I":
                    oField = this._createInputField(sFieldId, sDisplayValue, bEditable);
                    break;
                case "S":
                    oField = this._createTextAreaField(sFieldId, sDisplayValue, bEditable);
                    break;
                case "A":
                    oField = this._createFileUploaderField(sFieldId, sCustValue, bEditable);
                    break;
                case "URL":
                    oField = this._createURLField(sFieldId, sDisplayValue, bEditable);
                    break;

                default:
                    oField = this._createInputField(sFieldId, sDisplayValue, bEditable);
            }

            // Agregar al formulario
            oForm.addContent(oLabel);
            oForm.addContent(oField);

        },

        _createPicklistField: function (sFieldId, sDisplayValue, bEditable) {
            const oInput = new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: bEditable,
                enabled: true
            });

            return oInput;
        },

        _createInputField: function (sFieldId, sDisplayValue, bEditable) {
            return new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: bEditable,
                enabled: true
            });
        },

        _createDateField: function (sFieldId, sDisplayValue, bEditable) {
            return new DatePicker({
                id: sFieldId,
                value: sDisplayValue,
                editable: bEditable,
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd"
            });
        },

        _createTextAreaField: function (sFieldId, sDisplayValue, bEditable) {
            return new TextArea({
                id: sFieldId,
                value: sDisplayValue,
                editable: bEditable,
                rows: 3
            });
        },

        _createFileUploaderField: function (sFieldId, sCustValue, bEditable) {
            let that = this;
            const oUpload = new UploadCollection({
                mode: sap.m.ListMode.SingleSelectMaster,
                id: sFieldId,
                multiple: false,
                uploadEnabled: bEditable,
                terminationEnabled: bEditable,
                instantUpload: bEditable,
                showSeparators: "All",
                fileType: ["pdf"],
                mimeType: ["application/pdf"],
                maximumFileSize: 10, // 10 MB máximo
                change: this._oController.onDetectorAdjunto.bind(this._oController),
                fileDeleted: function (oEvent) {
                    that._onFileDeleted(oEvent, sFieldId, sCustValue);
                },
            });

            const oModel = this._oController.getOwnerComponent().getModel();

            let oAttachmentsModel = this._oController.getView().getModel("attachmentsModel");
            if (!oAttachmentsModel) {
                oAttachmentsModel = new sap.ui.model.json.JSONModel({
                    aAdjuntos: []
                });
                this._oController.getView().setModel(oAttachmentsModel, "attachmentsModel");
            }

            const aFilter = [new Filter("attachmentId", FilterOperator.EQ, sCustValue)];

            Service.readDataERP("/Attachment", oModel, aFilter)
                .then(data => {
                    if (data?.data?.results?.length) {

                        let aAttachments = oAttachmentsModel.getProperty("/aAdjuntos");

                        data.data.results.forEach(oNewAttachment => {
                            const bExists = aAttachments.some(item =>
                                item.attachmentId === oNewAttachment.attachmentId
                            );

                            if (!bExists) {
                                aAttachments.push(oNewAttachment);
                            }
                        });

                        oAttachmentsModel.setProperty("/aAttachments", aAttachments);

                        const oItem = this._viewAttachment(data.data.results[0], bEditable);
                        oUpload.addItem(oItem);

                        Util.showBI(false)

                    }
                })
                .catch(error => {
                    console.error("Error cargando attachment:", error.message);
                    Util.showBI(false);
                });

            return oUpload;

        },

        _createURLField: function (sFieldId, sDisplayValue, bEditable) {

            if (sDisplayValue === "(Vacío)" || !sDisplayValue) {
                return new Input({
                    id: sFieldId,
                    value: sDisplayValue,
                    editable: bEditable,
                    enabled: true,
                    placeholder: "https://ejemplo.com"
                });
            }

            var sLink = new sap.m.Link({
                id: sFieldId,
                text: sDisplayValue,
                href: sDisplayValue,
                target: "_blank",
                emphasized: true,
                wrapping: true
            });

            return sLink;
        },

        _onFileDeleted: function (oEvent, sFieldId, sAttachmentId) {
            const oItem = oEvent.getParameter("item");
            const oUploadCollection = sap.ui.getCore().byId(sFieldId);
            oUploadCollection.removeItem(oItem);
            // Marcar que el archivo fue eliminado (para guardado posterior)
            oUploadCollection.data("fileDeleted", true);
            oUploadCollection.data("deletedAttachmentId", sAttachmentId);

            MessageToast.show(this.oResourceBundle.getText("fileDeletedSuccessfully"));

        },


        _viewAttachment: function (attachment, bEditable) {
            const oItem = new sap.m.UploadCollectionItem({
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                url: this._crearDataURI(attachment.mimeType, attachment.fileContent),
                attributes: [
                    new sap.m.ObjectAttribute({
                        title: this.oResourceBundle.getText("download"),
                        text: attachment.fileName,
                        active: true
                    })
                ],
                enableEdit: bEditable,
                enableDelete: bEditable,
                visibleEdit: false,
                visibleDelete: bEditable
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