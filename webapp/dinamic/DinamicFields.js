
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
    "../Utils/Lenguaje",
    "sap/ui/model/json/JSONModel",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/MessageBox",
    "sap/ui/core/ValueState",
    "../Utils/DialogManager",
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
    Lenguaje,
    JSONModel,
    Select,
    Item,
    MessageBox,
    ValueState,
    DialogManager
) {
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
                // var aPicklist = this.getDynamicFieldFromC0001(oSolicitud.externalCode, oSolicitud.effectiveStartDate);

                if (aDynamicFields.length === 0) Util.showBI(false);

                if (bEditMode) {
                    this._saveOriginalValues(aDynamicFields);
                }

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

        _saveOriginalValues: function (aDynamicFields) {
            var oOriginalValues = {};

            aDynamicFields.forEach(function (field) {
                oOriginalValues[field.externalCode] = {
                    value: field.cust_value || "",
                    fieldType: field.cust_fieldtype,
                    pickList: field.cust_picklist,
                    fullFieldData: field
                };
            });

            var oOriginalModel = new JSONModel({
                fields: oOriginalValues,
                dynamicFields: aDynamicFields
            });

            this._oMainView.setModel(oOriginalModel, "originalFieldValues");
        },

        _getChangedFields: function () {
            var aChangedFields = [];

            if (!this._dynamicFields || !this._fieldControlsMap) {
                console.error("Faltan datos para detectar cambios (campos o controles).");
                return [];
            }

            // Formateador de fechas para asegurar que la comparación sea de string a string
            var oDateFormatter = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

            this._dynamicFields.forEach(function (field) {
                var oControl = this._fieldControlsMap[field.externalCode];
                if (!oControl) return;

                var vOriginalValue = oControl.data("realValue");
                var vCurrentValue = null;

                // obtener el valor actual
                if (oControl instanceof sap.m.Select) {
                    vCurrentValue = oControl.getSelectedKey();
                } else if (field.cust_fieldtype === 'P') {

                    vCurrentValue = vOriginalValue;
                }

                else if (oControl instanceof sap.m.DatePicker) {
                    // Para DatePicker
                    vCurrentValue = oControl.getDateValue() ? oDateFormatter.format(oControl.getDateValue()) : "";
                } else if (oControl.getValue) { // Para demás campos
                    vCurrentValue = oControl.getValue();
                } else {
                    return;
                }

                if ((vOriginalValue || "") !== (vCurrentValue || "")) {
                    aChangedFields.push({
                        fieldData: field,
                        newValue: vCurrentValue
                    });
                }
            }.bind(this));

            return aChangedFields;
        },

        _getFieldValue: function (oControl, sFieldType) {
            var vValue = null;

            switch (sFieldType) {
                case "F": // DatePicker
                    var oDate = oControl.getDateValue();
                    vValue = oDate ? oDate.toISOString().split('T')[0] : "";
                    break;

                case "P": // Picklist                   
                    var sRealValue = oControl.data("realValue");
                    if (sRealValue) {
                        vValue = sRealValue;
                    } else {
                        vValue = oControl.getValue ? oControl.getValue() : "";
                    }
                    break;

                case "A": // UploadCollection
                    if (oControl.data("fileDeleted")) {
                        // Si se marcó como eliminado, retornar null
                        vValue = null;
                    } else if (this._oController._archivosParaSubir) {
                        // Si hay un archivo nuevo pendiente de subir
                        vValue = "NEW_FILE"; // Marcador especial
                    } else {
                        // Si no hay cambios, mantener el ID original
                        vValue = oControl.data("originalAttachmentId") || "";
                    }
                    break;

                case "S": // TextArea
                case "I": // Input
                case "URL": // URL
                default:
                    vValue = oControl.getValue ? oControl.getValue() : "";
            }

            return vValue;
        },

        _hasValueChanged: function (vOriginal, vCurrent, sFieldType) {
            // Normalizar para evitar falsos positivos
            var sOriginal = String(vOriginal || "").trim();
            var sCurrent = String(vCurrent || "").trim();

            // Caso especial para fechas
            if (sFieldType === "F") {
                var dOriginal = sOriginal ? new Date(sOriginal) : null;
                var dCurrent = sCurrent ? new Date(sCurrent) : null;

                if (!dOriginal && !dCurrent) return false;
                if (!dOriginal || !dCurrent) return true;

                return dOriginal.toISOString().split('T')[0] !== dCurrent.toISOString().split('T')[0];
            }

            // Caso especial para attachments
            if (sFieldType === "A") {
                // Si el valor actual es null, significa que se eliminó
                if (sCurrent === "null" || vCurrent === null) {
                    return true;
                }
                // Si el valor actual es "NEW_FILE", significa que hay un archivo nuevo
                if (sCurrent === "NEW_FILE") {
                    return true;
                }
                // Si los IDs son diferentes
                return sOriginal !== sCurrent;
            }

            // Para el resto de campos, comparación directa
            return sOriginal !== sCurrent;
        },

        _buildFieldEntityPath: function (sDM0001ExternalCode, sEffectiveStartDate, sFieldExternalCode) {
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            var sEntityPath = `/cust_INETUM_SOL_DM_0003(` +
                `cust_INETUM_SOL_DM_0001_effectiveStartDate=datetime'${sFormattedDate}',` +
                `cust_INETUM_SOL_DM_0001_externalCode='${sDM0001ExternalCode}',` +
                `externalCode='${sFieldExternalCode}')`;

            return sEntityPath;
        },


        getDynamicFieldFromC0001: async function (sExternalCode, vEffectiveStartDate) {
            const oModel = this._oController.getOwnerComponent().getModel();

            try {
                const sEntity = this._buildC0001EntityPath(sExternalCode, vEffectiveStartDate);
                const oResponse = await Service.readDataERP(
                    sEntity,
                    oModel,
                    [],
                    { bParam: true, oParameter: { "$format": "json" } }
                );

                return oResponse.data;

            } catch (e) {
                console.error("Error en getDynamicFieldFromC0001:", e);
                throw e;
            }
        },

        _buildC0001EntityPath: function (sExternalCode, vEffectiveStartDate) {
            // Normalizamos la fecha con el formatter
            var sFormattedDate = formatter._formatDateForEntityPath(vEffectiveStartDate);

            // Armamos el path con la fecha + externalCode
            var sEntityPath = `/cust_INETUM_SOL_C_0001(` +
                `effectiveStartDate=datetime'${sFormattedDate}',` +
                `externalCode=${sExternalCode}L)`;

            return sEntityPath;
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

                var aCampos = oSolicitud.cust_solFields.results;
                if (!aCampos) {
                    return [];
                }
                const aCamposActivos = aCampos.filter(oCampo => oCampo.cust_status === 'A');
                return aCamposActivos;

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
            this._dynamicFields = aDynamicFields;
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

            this._oCurrentDetailView = oDetailView;

            return oDetailView;
        },

        _onSaveChanges: function (oSolicitud, oDetailView) {
            var that = this;

            //  validar el formulario
            if (!this.validateForm()) {
                const sErrorMessage = this.oResourceBundle.getText("validation.fillMandatoryFields");
                Util.onShowMessage(sErrorMessage, "error");
                return;
            }

            var aChangedFields = this._getChangedFields();
            var oAttachmentChange = this._getAttachmentChanges();

            if (aChangedFields.length === 0 && !oAttachmentChange) {
                MessageToast.show(this.oResourceBundle.getText("noChangesDetected"));
                return;
            }

            const oDialogModel = new JSONModel({
                icon: "sap-icon://save",
                type: this.oResourceBundle.getText("saveConfirmation"),
                state: "Information",
                message: this.oResourceBundle.getText("saveChangesConfirmation"),
                acceptText: this.oResourceBundle.getText("save"),
                cancelText: this.oResourceBundle.getText("cancel")
            });

            DialogManager.open(this._oMainView, oDialogModel, {
                onAccept: function (sComment) {
                    that._performSave(oSolicitud, oDetailView, aChangedFields, oAttachmentChange);
                },
                onCancel: function () {
                    console.log("Guardado cancelado por el usuario");
                }
            }).catch(function (error) {
                console.log("Guardado cancelado por el usuario");
            });
        },

        _performSave: function (oSolicitud, oDetailView, aChangedFields, aAttachmentChanges) {
            var that = this;
            Util.showBI(true);
            const oModel = this._oController.getOwnerComponent().getModel();

            // Guardar campos normales (no attachments)
            var aNormalChangedFields = aChangedFields.filter(function (change) {
                return change.fieldData.cust_fieldtype !== 'A';
            });

            aNormalChangedFields.forEach(function (change) {
                var sFieldPath = that._buildFieldEntityPath(
                    oSolicitud.externalCode,
                    oSolicitud.effectiveStartDate,
                    change.fieldData.externalCode
                );
                oModel.update(sFieldPath, { cust_value: change.newValue || "" });
            });

            // Procesar attachments si hay cambios
            if (aAttachmentChanges && aAttachmentChanges.length > 0) {

                this._processAttachmentsOneByOne(
                    oSolicitud,
                    aAttachmentChanges,
                    oModel,
                    function () {
                        console.log("Todos los attachments procesados");
                        setTimeout(function () {
                            that._finalizeUpdate(oSolicitud, oDetailView);
                        }, 1000);
                    },
                    function (error) {
                        console.error("Error procesando attachments:", error);
                        MessageToast.show("Error al procesar archivos: " + (error.message || error));
                        Util.showBI(false);
                    }
                );
            } else {
                setTimeout(function () {
                    that._finalizeUpdate(oSolicitud, oDetailView);
                }, 1000);
            }
        },

        _processAttachmentsOneByOne: function (oSolicitud, aAttachmentChanges, oModel, fnSuccess, fnError) {
            const that = this;

            const iTotalOperations = aAttachmentChanges.length;
            let iCompletedOperations = 0;
            let bHasError = false;

            if (iTotalOperations === 0) {
                fnSuccess();
                return;
            }
            // Función para verificar si se completaron todas las operaciones
            const checkComplete = function () {
                iCompletedOperations++;
                console.log(`Progreso: ${iCompletedOperations}/${iTotalOperations}`);

                if (iCompletedOperations === iTotalOperations && !bHasError) {
                    console.log("Todas las operaciones completadas");
                    fnSuccess();
                }
            };


            aAttachmentChanges.forEach(function (oChange, index) {
                if (bHasError) return;

                if (oChange.action === "upload") {
                    // Subir archivo y crear registro DM_0003
                    console.log(`[${index + 1}/${iTotalOperations}] Subiendo:`, oChange.file.nombre);

                    that._uploadAndCreateRecord(
                        oSolicitud,
                        oChange,
                        oModel,
                        function () {
                            console.log(`[${index + 1}/${iTotalOperations}] Completado:`, oChange.file.nombre);
                            checkComplete();
                        },
                        function (error) {
                            if (!bHasError) {
                                bHasError = true;
                                console.error(`[${index + 1}/${iTotalOperations}] Error:`, error);
                                fnError(error);
                            }
                        }
                    );
                } else if (oChange.action === "delete") {
                    // Desactivar registro DM_0003
                    that._deactivateAttachmentRecord(
                        oSolicitud,
                        oChange,
                        oModel,
                        function () {
                            console.log(`[${index + 1}/${iTotalOperations}] Registro desactivado`);
                            checkComplete();
                        },
                        function (error) {
                            if (!bHasError) {
                                bHasError = true;
                                console.error(`[${index + 1}/${iTotalOperations}] Error:`, error);
                                fnError(error);
                            }
                        }
                    );
                }
            });
        },

        _uploadAndCreateRecord: function (oSolicitud, oChange, oModel, fnSuccess, fnError) {
            const that = this;

            // Subir el archivo a /Attachment
            const oDatosAdjunto = {
                fileName: oChange.file.nombre,
                fileContent: oChange.file.contenido,
                module: "GENERIC_OBJECT",
                userId: "SFAPI" // this._oController.oCurrentUser.name
            };

            oModel.create("/Attachment", oDatosAdjunto, {
                success: function (oData) {
                    const sAttachmentId = oData.attachmentId;

                    // Crear registro DM_0003
                    that._createDM0003Record(
                        oSolicitud,
                        oChange.fieldData,
                        sAttachmentId,
                        oModel,
                        fnSuccess,
                        fnError
                    );
                },
                error: function (oError) {
                    console.error("Error subiendo archivo:", oError);
                    fnError(oError);
                }
            });
        },

        _createDM0003Record: function (oSolicitud, oFieldData, sAttachmentId, oModel, fnSuccess, fnError) {
            // Generar externalCode único
            const sNewExternalCode = formatter.generarIdNumericoUnico();

            // Datos del nuevo registro
            const oNewRecord = {
                cust_INETUM_SOL_DM_0001_externalCode: oSolicitud.externalCode,
                cust_INETUM_SOL_DM_0001_effectiveStartDate: formatter._formatEffectiveStartDate(oSolicitud.effectiveStartDate),
                externalCode: sNewExternalCode,
                cust_value: sAttachmentId, // Solo un attachmentId
                cust_etiqueta: oFieldData.cust_etiqueta,
                cust_etiqueta_ca_ES: oFieldData.cust_etiqueta_ca_ES,
                cust_etiqueta_defaultValue: oFieldData.cust_etiqueta_defaultValue,
                cust_etiqueta_en_DEBUG: oFieldData.cust_etiqueta_en_DEBUG,
                cust_etiqueta_en_US: oFieldData.cust_etiqueta_en_US,
                cust_etiqueta_es_ES: oFieldData.cust_etiqueta_es_ES,
                cust_fieldtype: "A",
                cust_fieldLenght: oFieldData.cust_fieldLenght,
                cust_mandatory: oFieldData.cust_mandatory || false,
                cust_modif: oFieldData.cust_modif || false,
                cust_ModificablePEmpleado: oFieldData.cust_ModificablePEmpleado || false,
                cust_object: oFieldData.cust_object,
                cust_tipoObject: oFieldData.cust_tipoObject,
                cust_status: "A" // Activo
            };


            // Crear el registro
            oModel.create("/cust_INETUM_SOL_DM_0003", oNewRecord, {
                success: function (oData) {
                    console.log("Registro DM_0003 creado:", sNewExternalCode);
                    fnSuccess(oData);
                },
                error: function (oError) {
                    console.error("Error creando registro DM_0003:", oError);

                    // Intentar extraer mensaje de error
                    let sErrorMsg = "Error desconocido";
                    if (oError && oError.responseText) {
                        try {
                            const oErrorData = JSON.parse(oError.responseText);
                            sErrorMsg = oErrorData.error?.message?.value || oError.message || sErrorMsg;
                        } catch (e) {
                            sErrorMsg = oError.message || oError.statusText || sErrorMsg;
                        }
                    }

                    fnError(new Error(sErrorMsg));
                }
            });
        },

        _deactivateAttachmentRecord: function (oSolicitud, oChange, oModel, fnSuccess, fnError) {
            const that = this;
            const sAttachmentId = oChange.oldAttachmentId;

            // Buscar el registro DM_0003 que tiene este attachmentId
            const aFilters = [
                new Filter("cust_INETUM_SOL_DM_0001_externalCode", FilterOperator.EQ, oSolicitud.externalCode),
                new Filter("cust_value", FilterOperator.EQ, sAttachmentId),
                new Filter("cust_fieldtype", FilterOperator.EQ, "A"),
                new Filter("cust_status", FilterOperator.EQ, "A") // Solo los activos
            ];

            oModel.read("/cust_INETUM_SOL_DM_0003", {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        const oRecord = oData.results[0];

                        // Construir path del registro
                        const sRecordPath = that._buildFieldEntityPath(
                            oSolicitud.externalCode,
                            oSolicitud.effectiveStartDate,
                            oRecord.externalCode
                        );

                        // Desactivar (cambiar status a 'I')
                        oModel.update(sRecordPath, { cust_status: "I" }, {
                            success: function () {
                                console.log("Registro desactivado:", oRecord.externalCode);
                                fnSuccess();
                            },
                            error: function (oError) {
                                console.error("Error desactivando registro:", oError);
                                fnError(oError);
                            }
                        });
                    } else {
                        console.warn("No se encontró registro DM_0003 para el attachment:", sAttachmentId);
                        fnSuccess(); // Continuar aunque no se encuentre
                    }
                },
                error: function (oError) {
                    console.error(" Error buscando registro DM_0003:", oError);
                    fnError(oError);
                }
            });
        },


        _finalizeUpdate: function (oSolicitud, oDetailView) {
            var that = this;
            const oModel = this._oController.getOwnerComponent().getModel();

            if (this._fieldControlsMap) {
                Object.keys(this._fieldControlsMap).forEach(function (sKey) {
                    const oControl = that._fieldControlsMap[sKey];
                    if (oControl && oControl.data) {
                        oControl.data("pendingFiles", []);
                        oControl.data("deletedAttachments", []);
                    }
                });
            }

            this._oController._archivosParaSubir = null;

            var sEntityPath = this._oController._buildEntityPath(
                oSolicitud.externalCode,
                oSolicitud.effectiveStartDate
            );

            const iCurrentIndexStep = parseInt(oSolicitud.cust_indexStep, 10) || 0;
            const iNewIndexStep = (iCurrentIndexStep >= 1) ? iCurrentIndexStep + 1 : iCurrentIndexStep;

            const oDatos_DM_0001 = {
                cust_status: "EC",
                cust_indexStep: iNewIndexStep,
                cust_fechaAct: new Date()
            };

            oModel.update(sEntityPath, oDatos_DM_0001, {
                success: function () {
                    console.log("DM_0001 Actualizado")
                },
                error: function (oError) {
                    console.log("Error al guardar cambios", "error");
                    Util.showBI(false);
                }
            });

            oSolicitud.cust_indexStep = iNewIndexStep;
            that.onSearchSteps(oSolicitud, iNewIndexStep);
            that._oController._archivosParaSubir = null;

            MessageToast.show(that.oResourceBundle.getText("ChangesSavedSuccessfully"));
            that._onBackToMain(oDetailView);

            setTimeout(function () {
                that._oController.onGetDM001();
            }, 1500);

            Util.showBI(false);
        },

        _getAttachmentChanges: function () {
            const aAllChanges = [];

            if (!this._dynamicFields || !this._fieldControlsMap) {
                return aAllChanges;
            }

            this._dynamicFields.forEach(function (field) {
                if (field.cust_fieldtype === "A") {
                    const oControl = this._fieldControlsMap[field.externalCode];

                    if (!oControl) return;

                    const aPendingFiles = oControl.data("pendingFiles") || [];
                    const aDeletedAttachments = oControl.data("deletedAttachments") || [];

                    // Agregar archivos nuevos
                    aPendingFiles.forEach(function (oFile) {
                        aAllChanges.push({
                            action: "upload",
                            file: oFile,
                            fieldData: field
                        });
                    });

                    // Agregar archivos eliminados
                    aDeletedAttachments.forEach(function (sAttachmentId) {
                        aAllChanges.push({
                            action: "delete",
                            fieldData: field,
                            oldAttachmentId: sAttachmentId
                        });
                    });
                }
            }.bind(this));

            return aAllChanges.length > 0 ? aAllChanges : null;
        },

        onSearchSteps: function (oSolicitud, iNewIndexStep) {
            const oModel = this._oController.getOwnerComponent().getModel();

            for (let i = 0; i < oSolicitud.cust_steps.results.length; i++) {
                const oStep = oSolicitud.cust_steps.results[i];
                const iStepNumber = parseInt(oStep.cust_seqStep, 10);

                const bNewActiveStatus = (iStepNumber === iNewIndexStep);

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
                const oModel = this._oController.getOwnerComponent().getModel();
                const sLang = this._oController.getOwnerComponent().getModel("user").oData.defaultLocale;
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

            this._fieldControlsMap = {};

            // Agregar campos dinámicos directamente
            this._addDynamicFields(oForm, aDynamicFields, oSolicitud, bEditMode);

            return oForm;
        },

        /**
         * Agregar campos dinámicos (todos los registros del array)
         */
        _addDynamicFields: async function (oForm, aDynamicFields, oSolicitud, bEditMode = false) {
            let iTotalAttachments = 0;
            const user = this._oController.oCurrentUser.name; // Usuario actual

            if (!aDynamicFields || aDynamicFields.length === 0) {
                Util.showBI(false);
                return;
            }
            this._oSolicitud = oSolicitud;
            aDynamicFields.forEach(field => {
                if (field.cust_fieldtype === "A") {
                    iTotalAttachments++;
                }
            });

            for (let index = 0; index < aDynamicFields.length; index++) {
                const oDynamicField = aDynamicFields[index];
                const sLabel = Lenguaje.obtenerValorLocalizado(oDynamicField, "cust_etiqueta");
                let sValue = oDynamicField.cust_value || "";
                let sDisplayValue = sValue;
                let aOpcionesPicklist = [];


                // Calculo de los valores base para editable y mandatory
                let bEsEditable = oDynamicField.cust_modif === true && bEditMode && oSolicitud.cust_status === "RA";
                let bEsObligatorio = !!oDynamicField.cust_mandatory;

                const bUsuarioEsCreador = (user === oSolicitud.createdBy);

                // Si el usuario es el creador Y el campo está marcado como NO modificable por el empleado
                if (bUsuarioEsCreador && !oDynamicField.cust_ModificablePEmpleado) {
                    bEsEditable = false;
                    bEsObligatorio = false;
                }

                // Lógica para cargar opciones de Picklist 
                if (oDynamicField.cust_fieldtype === "P") {
                    if (bEsEditable) {
                        try {
                            const sPicklistId = oDynamicField.cust_picklist;
                            if (sPicklistId) {
                                aOpcionesPicklist = await this._cargarOpcionesPicklist(sPicklistId);
                            }
                            sDisplayValue = sValue;
                        } catch (error) {
                            console.error("Error cargando la lista de opciones del picklist:", error);
                            aOpcionesPicklist = [];
                        }
                    } else if (sValue !== "" && sValue.trim() !== "") {
                        try {
                            const oModel = this._oController.getOwnerComponent().getModel();
                            const aFilter = [new Filter("optionId", FilterOperator.EQ, sValue)];
                            const data = await Service.readDataERP("/PicklistLabel", oModel, aFilter);
                            if (data?.data?.results?.length) {
                                sDisplayValue = data.data.results[0].label || sValue;
                            }
                        } catch (error) {
                            console.error("Error cargando picklist label:", error);
                        }
                    }
                }

                if (oDynamicField.cust_fieldtype === "URL") {
                    sValue = oDynamicField.cust_vDefecto;
                    sDisplayValue = oDynamicField.cust_vDefecto;
                }

                let oFieldConfig = {
                    oForm,
                    sLabel,
                    sValue: sDisplayValue,
                    realValue: sValue,
                    fieldType: oDynamicField.cust_fieldtype,
                    fieldValue: oDynamicField.cust_value,
                    editable: bEsEditable,
                    sStatusEditable: oDynamicField.cust_modif,
                    mandatory: bEsObligatorio,
                    externalCode: oDynamicField.externalCode,
                    picklistOptions: aOpcionesPicklist,
                    length: oDynamicField.cust_fieldLenght,
                    sDefaultWidth: `25rem`,
                    sWidthPicklist: `50%`                 

                };

                this._addField(oFieldConfig);
            }

            if (iTotalAttachments === 0) Util.showBI(false);
        },

        /**
         * Agregar un campo simple al formulario
         */
        _addField: function (oFieldConfig) {

            let sDisplayValue = oFieldConfig.sValue;
            let oField = null;
            let textoUrl = "";

            // Si el valor está vacío, mostrar texto por defecto
            if (sDisplayValue === undefined || sDisplayValue === null || sDisplayValue === "") {
                sDisplayValue = "";
            }

            if (oFieldConfig.fieldType == "URL") {
                const oResourceBundle = this._oController.getOwnerComponent().getModel("i18n").getResourceBundle();
                textoUrl = oResourceBundle.getText("downloadDocument");
            }

            // Crear elementos
            var sFieldId = "field_" + oFieldConfig.externalCode;

            var oLabel = new Label({
                text: oFieldConfig.sLabel,
                labelFor: sFieldId,
                required: !!oFieldConfig.mandatory

            });



            switch (String(oFieldConfig.fieldType)) {
                case "P":
                    //oField = this._createPicklistField(sFieldId, sDisplayValue, oFieldConfig.editable);
                    oField = this._createPicklistField(sFieldId, oFieldConfig);
                    break;
                case "F":
                    oField = this._createDateField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "I":
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "S":
                    oField = this._createTextAreaField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "A":
                    oField = this._createFileUploaderField(sFieldId, oFieldConfig.fieldValue, oFieldConfig.editable);
                    break;
                case "URL":
                    oField = this._createURLField(sFieldId, sDisplayValue, oFieldConfig.editable, textoUrl);
                    break;
                default:
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig);
            }

            if (oField && oFieldConfig.realValue !== undefined) {
                oField.data("realValue", oFieldConfig.realValue);
            }

            if (oField && oFieldConfig.externalCode) {
                this._fieldControlsMap[oFieldConfig.externalCode] = oField;
            }
            // Agregar al formulario
            oFieldConfig.oForm.addContent(oLabel);
            oFieldConfig.oForm.addContent(oField);

        },

        _createPicklistField: function (sFieldId, oFieldConfig) {
            /*
            const oInput = new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: bEditable,
                enabled: true
            });

            return oInput;
            */

            if (oFieldConfig.editable && oFieldConfig.picklistOptions && oFieldConfig.picklistOptions.length > 0) {
                const oSelect = new Select({
                    id: sFieldId,
                    // width: oFieldConfig.length ? `${oFieldConfig.length}rem` : undefined,
                    selectedKey: oFieldConfig.realValue,
                    width: oFieldConfig.sDefaultWidth
                });

                const oOptionsModel = new JSONModel(oFieldConfig.picklistOptions);
                oSelect.setModel(oOptionsModel);

                oSelect.bindItems({
                    path: "/",
                    template: new Item({
                        key: "{key}",
                        text: "{text}"
                    })
                });

                return oSelect;

            } else {
                const oInput = new Input({
                    id: sFieldId,
                    value: oFieldConfig.sValue,
                    editable: false,
                    width: oFieldConfig.sDefaultWidth
                });
                return oInput;
            }

        },

        _createInputField: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: oFieldConfig.editable,
                enabled: true,
                maxLength: oFieldConfig.length || 100,
                width: oFieldConfig.length ? `${oFieldConfig.length}rem` : undefined
            });
        },

        _createDateField: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new DatePicker({
                id: sFieldId,
                value: sDisplayValue,
                editable: oFieldConfig.editable,
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd",
                width: oFieldConfig.length ? `${oFieldConfig.length}rem` : `10rem`,

            });
        },

        _createTextAreaField: function (sFieldId, sDisplayValue, oFieldConfig) {
            const iLength = parseInt(oFieldConfig.length, 10) || 0;
            const bEditable = oFieldConfig.editable !== false;
            
            if (iLength > 0 && iLength <= 200) {
                // Input para textos cortos
                return new sap.m.Input({
                    id: sFieldId,
                    maxLength: iLength,
                    type: sap.m.InputType.Text,
                    width: `${Math.min(iLength, 40) * 0.9}rem`,
                    value: sDisplayValue,
                    editable: bEditable
                });
            }
            
            // TextArea para textos largos
            return new sap.m.TextArea({
                id: sFieldId,
                value: sDisplayValue,
                rows: 3,
                maxLength: iLength || 0,
                editable: bEditable,
                width: oFieldConfig.sDefaultWidth
            });
        },

        _createFileUploaderField: function (sFieldId, sCustValue, bEditable) {
            let that = this;
            const oUpload = new UploadCollection({
                mode: sap.m.ListMode.SingleSelectMaster,
                id: sFieldId,
                multiple: true,
                uploadEnabled: bEditable,
                terminationEnabled: bEditable,
                instantUpload: bEditable,
                showSeparators: "All",
                fileType: ["jpeg", "jpg", "png", "pdf"],
                mimeType: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
                maximumFileSize: 10, // 10 MB máximo              
                change: function (oEvent) {
                    that._onFilesChangeForField(oEvent, sFieldId);
                },
                fileDeleted: function (oEvent) {
                    that._onFileDeleted(oEvent, sFieldId, sCustValue);
                },
            });

            oUpload.data("pendingFiles", []);
            oUpload.data("originalAttachmentId", sCustValue || "");
            oUpload.data("deletedAttachments", []);

            this._loadExistingAttachments(oUpload, sCustValue, bEditable);
            
            const oWrapper = new sap.m.HBox({
                width: "70%",
                justifyContent: "Start", 
                items: [oUpload]
            });
            
            return oWrapper;
        },

        _loadExistingAttachments: function (oUploadCollection, sCustValue, bEditable) {
            if (!sCustValue || sCustValue.trim() === "") {
                Util.showBI(false);
                return;
            }

            const oModel = this._oController.getOwnerComponent().getModel();
            const aFilter = [new Filter("attachmentId", FilterOperator.EQ, sCustValue)];

            Service.readDataERP("/Attachment", oModel, aFilter)
                .then(data => {
                    if (data?.data?.results?.length) {
                        data.data.results.forEach(oAttachment => {
                            const oItem = this._viewAttachment(oAttachment, bEditable);
                            // Marcar como archivo existente
                            oItem.data("isNewFile", false);
                            oItem.data("attachmentId", oAttachment.attachmentId);
                            oUploadCollection.addItem(oItem);
                        });
                    }
                    Util.showBI(false);
                })
                .catch(error => {
                    console.error("Error cargando attachments:", error);
                    Util.showBI(false);
                });
        },

        _createURLField: function (sFieldId, sDisplayValue, bEditable, textoUrl) {

            if (bEditable) {
                const sEditableValue = (sDisplayValue && typeof sDisplayValue === 'object') ? sDisplayValue.uri : sDisplayValue;
                return new Input({
                    id: sFieldId,
                    value: sEditableValue || "",
                    type: sap.m.InputType.Url,
                    editable: true
                });
            }

            else {
                const sUrl = (sDisplayValue && typeof sDisplayValue === 'object' && sDisplayValue.uri)
                    ? sDisplayValue.uri
                    : (typeof sDisplayValue === 'string' ? sDisplayValue : "");

                if (sUrl && sUrl !== "(Vacío)") {
                    return new sap.m.Link({
                        id: sFieldId,
                        text: textoUrl,
                        href: sUrl,
                        target: "_blank",
                        wrapping: true
                    });
                }
                else {
                    return new sap.m.Text({
                        id: sFieldId,
                        text: "—"
                    });
                }
            }
        },

        _onFilesChangeForField: function (oEvent, sFieldId) {
            const oResourceBundle = this._oController.getOwnerComponent().getModel("i18n").getResourceBundle();
            const aFiles = Array.from(oEvent.getParameter("files"));
            const oUploadCollection = oEvent.getSource();

            if (!aFiles || aFiles.length === 0) {
                return;
            }

            let aPendingFiles = oUploadCollection.data("pendingFiles") || [];
            let iProcessedFiles = 0;
            const iTotalFiles = aFiles.length;

            // Procesar cada archivo seleccionado
            aFiles.forEach((oFile, index) => {

                const oReader = new FileReader();
                oReader.onload = (e) => {
                    const sBase64Content = e.target.result.split(",")[1];

                    // Agregar al array de archivos pendientes
                    const oNewFile = {
                        nombre: oFile.name,
                        contenido: sBase64Content,
                        mimeType: oFile.type,
                        size: oFile.size,
                        tempId: Date.now() + "_" + index
                    };

                    aPendingFiles.push(oNewFile);
                    oUploadCollection.data("pendingFiles", aPendingFiles);


                    if (!this._oController._archivosParaSubir) {
                        this._oController._archivosParaSubir = [];
                    }
                    this._oController._archivosParaSubir.push(oNewFile);

                    const oItem = new sap.m.UploadCollectionItem({
                        fileName: oNewFile.nombre,
                        mimeType: oNewFile.mimeType,
                        url: "data:" + oNewFile.mimeType + ";base64," + sBase64Content,
                        thumbnailUrl: "sap-icon://pdf-attachment",
                        enableEdit: false,
                        enableDelete: true,
                        visibleEdit: false,
                        visibleDelete: true
                    });

                    // Marcar como archivo nuevo
                    oItem.data("isNewFile", true);
                    oItem.data("tempId", oNewFile.tempId);

                    oUploadCollection.addItem(oItem);

                    iProcessedFiles++;

                    // Mostrar mensaje cuando todos estén procesados
                    if (iProcessedFiles === iTotalFiles) {
                        const sMessage = iTotalFiles === 1
                            ? oResourceBundle.getText("fileReadyToBeSaved")
                            : oResourceBundle.getText("filesReadyToBeSaved", [iTotalFiles]);
                        sap.m.MessageToast.show(sMessage);
                    }
                };

                oReader.readAsDataURL(oFile);
            });
        },

        _onFileDeleted: function (oEvent, sFieldId, sAttachmentId) {
            const that = this;
            const oItem = oEvent.getParameter("item");
            const oUploadCollection = sap.ui.getCore().byId(sFieldId);
            const bIsNewFile = oItem.data("isNewFile");
            const sField = sFieldId.split("_")[1];

            if (bIsNewFile) {
                // Archivo nuevo (no guardado aún) - solo remover de arrays
                const sTempId = oItem.data("tempId");
                let aPendingFiles = oUploadCollection.data("pendingFiles") || [];

                aPendingFiles = aPendingFiles.filter(file => file.tempId !== sTempId);
                oUploadCollection.data("pendingFiles", aPendingFiles);

                if (this._oController._archivosParaSubir) {
                    this._oController._archivosParaSubir =
                        this._oController._archivosParaSubir.filter(file => file.tempId !== sTempId);
                }

                const iFieldIndex = this._dynamicFields.findIndex(f => f.externalCode === sField);
                if (iFieldIndex !== -1 && Array.isArray(this._dynamicFields[iFieldIndex].attachments)) {
                    this._dynamicFields[iFieldIndex].attachments =
                        this._dynamicFields[iFieldIndex].attachments.filter(att => att.tempId !== sTempId);
                }

                // Eliminar visualmente
                oUploadCollection.removeItem(oItem);

                MessageToast.show(this.oResourceBundle.getText("fileDeletedSuccessfully"));

            } else {
                // Archivo existente - ELIMINAR de la entidad /Attachment
                const sExistingAttachmentId = oItem.data("attachmentId");

                if (!sExistingAttachmentId) {
                    console.warn("No se encontró attachmentId para eliminar");
                    oUploadCollection.removeItem(oItem);
                    return;
                }

                console.log("Eliminando attachment de la entidad:", sExistingAttachmentId);

                // Mostrar indicador de carga
                Util.showBI(true);

                const oModel = this._oController.getOwnerComponent().getModel();
                const sAttachmentPath = `/Attachment(attachmentId=${sExistingAttachmentId}L)`;

                //  Primero eliminar el registro DM_0003
                that._eliminarRegistroDM0003(sExistingAttachmentId, function () {

                    //  Ahora eliminar el Attachment usando submitChanges
                    oModel.remove(sAttachmentPath);

                    oModel.submitChanges({
                        success: function (oResponse) {
                            console.log("Attachment eliminado exitosamente:", sExistingAttachmentId);

                            // Actualizar arrays locales
                            let aDeletedAttachments = oUploadCollection.data("deletedAttachments") || [];
                            aDeletedAttachments.push(sExistingAttachmentId);
                            oUploadCollection.data("deletedAttachments", aDeletedAttachments);



                            // Eliminar visualmente
                            oUploadCollection.removeItem(oItem);

                            if (oUploadCollection.getItems().length === 0) {
                                oUploadCollection.data("pendingFiles", []);
                                oUploadCollection.data("deletedAttachments", []);
                                oUploadCollection.data("originalAttachmentId", "");

                                oUploadCollection.setVisible(false);

                                const oParent = oUploadCollection.getParent();
                                if (oParent && oParent.removeContent) {
                                    oParent.removeContent(oUploadCollection);
                                }

                                const iFieldIndex = that._dynamicFields.findIndex(f => f.externalCode === sField);
                                if (iFieldIndex !== -1) {
                                    that._dynamicFields.splice(iFieldIndex, 1);
                                }
                            }

                            Util.showBI(false);
                            MessageToast.show(that.oResourceBundle.getText("fileDeletedSuccessfully"));
                        },
                        error: function (oError) {
                            console.error("Error eliminando attachment:", oError);
                            Util.showBI(false);

                            // Extraer mensaje de error
                            let sErrorMsg = "Error al eliminar el archivo";
                            if (oError && oError.responseText) {
                                try {
                                    const oErrorData = JSON.parse(oError.responseText);
                                    sErrorMsg = oErrorData.error?.message?.value || sErrorMsg;
                                } catch (e) {
                                    sErrorMsg = oError.message || oError.statusText || sErrorMsg;
                                }
                            }

                            MessageBox.error(sErrorMsg);
                        }
                    });

                }, function (error) {
                    console.error("  Error eliminando DM_0003:", error);
                    Util.showBI(false);
                    MessageToast.show("Error al eliminar el registro DM_0003");
                });
            }

        },

        _eliminarRegistroDM0003: function (sAttachmentId, fnSuccess, fnError) {
            const that = this;
            const oModel = this._oController.getOwnerComponent().getModel();
            const oSolicitud = this._oSolicitud;

            if (!oSolicitud) {
                console.error("No hay solicitud cargada");
                if (fnError) fnError(new Error("No hay solicitud cargada"));
                return;
            }

            const aFilters = [
                new Filter("cust_INETUM_SOL_DM_0001_externalCode", FilterOperator.EQ, oSolicitud.externalCode),
                new Filter("cust_value", FilterOperator.EQ, sAttachmentId),
                new Filter("cust_fieldtype", FilterOperator.EQ, "A"),
                new Filter("cust_status", FilterOperator.EQ, "A")
            ];

            oModel.read("/cust_INETUM_SOL_DM_0003", {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        const oRecord = oData.results[0];

                        const sRecordPath = that._buildFieldEntityPath(
                            oSolicitud.externalCode,
                            oSolicitud.effectiveStartDate,
                            oRecord.externalCode
                        );

                        // ELIMINAR el registro usando submitChanges
                        oModel.remove(sRecordPath);

                        oModel.submitChanges({
                            success: function (oResponse) {
                                console.log("Registro DM_0003 eliminado:", oRecord.externalCode);
                                if (fnSuccess) fnSuccess();
                            },
                            error: function (oError) {
                                console.error("Error eliminando DM_0003:", oError);
                                if (fnError) fnError(oError);
                            }
                        });
                    } else {
                        console.warn("No se encontró registro DM_0003");
                        if (fnSuccess) fnSuccess();
                    }
                },
                error: function (oError) {
                    console.error("Error buscando DM_0003:", oError);
                    if (fnError) fnError(oError);
                }
            });
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

        _onCancelRequest: function (oSolicitud, oDetailView) {
            var that = this;

            if (!this._oController || !this._oController.onCancelarSolicitudFromDetail) {
                return;
            }

            const oDialogModel = new JSONModel({
                icon: "sap-icon://message-warning",
                type: this.oResourceBundle.getText("confirmCancel"),
                state: "Warning",
                message: this.oResourceBundle.getText("cancelRequestConfirmation", [oSolicitud.cust_nombreSol]),
                acceptText: this.oResourceBundle.getText("aceptar"),
                cancelText: this.oResourceBundle.getText("cancel")
            });

            DialogManager.open(this._oMainView, oDialogModel, {
                onAccept: function (sComment) {
                    that._oController.onCancelarSolicitudFromDetail(
                        oSolicitud.cust_nombreSol,
                        oSolicitud.externalCode,
                        sComment
                    ).then(function (bWasCancelled) {
                        if (bWasCancelled) {
                            MessageToast.show(that.oResourceBundle.getText("requestCancelled"));
                            setTimeout(function () {
                                that._onBackToMain(oDetailView);
                            }, 500);
                        }
                    }).catch(function (error) {
                        MessageToast.show("Error al procesar la cancelación: " + error);
                        Util.showBI(false);
                    });
                },
                onCancel: function () {
                    console.log("Cancelación de solicitud abortada por el usuario");
                }
            }).catch(function (error) {
                console.log("Cancelación de solicitud abortada por el usuario");
            });
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

            this._fieldControlsMap = null;
            this._oCurrentDetailView = null;

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
        },


        validateForm: function () {
            let bFormularioValido = true;
            const user = this._oController.oCurrentUser.name;
            const bUsuarioEsCreador = (user === this._oSolicitud.createdBy);

            this._dynamicFields.forEach(function (field) {
                const oControl = this._fieldControlsMap[field.externalCode];
                if (oControl) {
                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState(ValueState.None);
                    }
                    if (field.cust_fieldtype === "A" && oControl.hasStyleClass("campoAdjuntoError")) {
                        oControl.removeStyleClass("campoAdjuntoError");
                    }
                }
            }.bind(this));

            for (const field of this._dynamicFields) {

                let bDebeValidarse = !!field.cust_mandatory;

                if (bUsuarioEsCreador && !field.cust_ModificablePEmpleado) {
                    bDebeValidarse = false; // Anulamos la validación
                }

                if (bDebeValidarse) {
                    const oControl = this._fieldControlsMap[field.externalCode];
                    if (!oControl) continue;

                    let bCampoValido = false;

                    switch (field.cust_fieldtype) {
                        case "A":
                            // Validar: debe tener al menos 1 archivo 

                            const aCurrentItems = oControl.getItems ? oControl.getItems() : [];
                            const aPendingFiles = oControl.data("pendingFiles") || [];
                            const aDeletedFiles = oControl.data("deletedAttachments") || [];

                            // Archivos existentes que NO fueron eliminados
                            const iExistingFiles = aCurrentItems.filter(function (item) {
                                return !item.data("isNewFile");
                            }).length;

                            // Archivos nuevos pendientes
                            const iNewFiles = aPendingFiles.length;

                            // Total de archivos que quedarán después de guardar
                            const iTotalFiles = iExistingFiles + iNewFiles;
                            // Es válido si hay al menos 1 archivo
                            bCampoValido = iTotalFiles > 0;
                            break;

                        case "P":
                            if (oControl.getSelectedKey()) bCampoValido = true;
                            break;

                        default:
                            if (oControl.getValue && oControl.getValue().trim() !== "") bCampoValido = true;
                            break;
                    }

                    if (!bCampoValido) {
                        bFormularioValido = false;
                        if (field.cust_fieldtype === "A") {
                            oControl.addStyleClass("campoAdjuntoError");
                        } else if (typeof oControl.setValueState === "function") {
                            // Usamos la variable importada
                            oControl.setValueState(ValueState.Error);
                        }
                    }
                }
            }

            return bFormularioValido;
        },
    });
});