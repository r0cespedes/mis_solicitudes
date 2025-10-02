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
    "sap/ui/model/json/JSONModel"
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
    JSONModel) {
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
                       
            aDynamicFields.forEach(function(field) {
                oOriginalValues[field.externalCode] = {
                    value: field.cust_value || "",
                    fieldType: field.cust_fieldtype,                    
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
            var oOriginalModel = this._oMainView.getModel("originalFieldValues");
            
            if (!oOriginalModel) {
                console.error("No se encontró el modelo de valores originales");
                return [];
            }
            
            var oOriginalData = oOriginalModel.getProperty("/fields");
            var aDynamicFields = oOriginalModel.getProperty("/dynamicFields"); 

            if (!this._fieldControlsMap) {
                console.error("No se encontró el mapa de controles");
                return [];
            }
            
            var aChangedFields = [];
            
            aDynamicFields.forEach(function(field) {
                // Obtener control directamente del mapa
                var oControl = this._fieldControlsMap[field.externalCode];
                
                if (!oControl) {
                    console.warn("Control no encontrado en mapa para:", field.externalCode);
                    return;
                }
                                  
                var vCurrentValue = this._getFieldValue(oControl, field.cust_fieldtype);
                var vOriginalValue = oOriginalData[field.externalCode]?.value || ""; 
                
                if (this._hasValueChanged(vOriginalValue, vCurrentValue, field.cust_fieldtype)) {
                    aChangedFields.push({
                        fieldData: field,
                        oldValue: vOriginalValue,
                        newValue: vCurrentValue,
                        changeType: "value_changed"
                    });
                } else {
                    console.log(`Sin cambios`);
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

            this._oCurrentDetailView = oDetailView;

            return oDetailView;
        },

        _onSaveChanges: function (oSolicitud, oDetailView) {
            var that = this;
            Util.showBI(true);
            
            const oModel = this._oController.getOwnerComponent().getModel();
            
            var aChangedFields = this._getChangedFields();
            var oAttachmentChange = this._getAttachmentChanges();
            
            if (aChangedFields.length === 0 && !oAttachmentChange) {
                MessageToast.show(this.oResourceBundle.getText("noChangesDetected") || "No se detectaron cambios");
                Util.showBI(false);
                return;
            }
            
            // Actualizar campos normales primero
            aChangedFields.forEach(function(change) {
                var sFieldPath = that._buildFieldEntityPath(
                    oSolicitud.externalCode,
                    oSolicitud.effectiveStartDate,
                    change.fieldData.externalCode
                );
                
                oModel.update(sFieldPath, { cust_value: change.newValue || "" });
            });
            
            // Si hay attachment, procesarlo por separado
            if (oAttachmentChange && oAttachmentChange.action === "upload") {
                const oDatos_Adjunto = {
                    fileName: oAttachmentChange.file.nombre,
                    fileContent: oAttachmentChange.file.contenido,
                    module: "GENERIC_OBJECT",
                    userId: this._oController.oCurrentUser.name
                };
                
                oModel.create("/Attachment", oDatos_Adjunto, {
                    success: function(oData) {
                        var sNewAttachmentId = oData.attachmentId || "";
                        var sFieldPath = that._buildFieldEntityPath(
                            oSolicitud.externalCode,
                            oSolicitud.effectiveStartDate,
                            oAttachmentChange.fieldData.externalCode
                        );
                        
                        oModel.update(sFieldPath, { cust_value: sNewAttachmentId });
                    }
                });
            }
            
            // Procesar eliminación de attachment
            if (oAttachmentChange && oAttachmentChange.action === "delete") {
                var sFieldPath = that._buildFieldEntityPath(
                    oSolicitud.externalCode,
                    oSolicitud.effectiveStartDate,
                    oAttachmentChange.fieldData.externalCode
                );
                
                oModel.update(sFieldPath, { cust_value: "" });
            }
            
            // Usar timeout para dar tiempo a que los updates terminen
            setTimeout(function() {
                that._finalizeUpdate(oSolicitud, oDetailView);
            }, 2000);
        },
        
        _finalizeUpdate: function(oSolicitud, oDetailView) {
            var that = this;
            const oModel = this._oController.getOwnerComponent().getModel();
            
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
                success: function() {
                    console.log("DM_0001 Actualizado")
                },
                error: function(oError) {
                    Util.onShowMessage("Error al guardar cambios", "error");
                    Util.showBI(false);
                }
            });

            oSolicitud.cust_indexStep = iNewIndexStep;
            that.onSearchSteps(oSolicitud);
            that._oController._archivosParaSubir = null;
            
            MessageToast.show(that.oResourceBundle.getText("ChangesSavedSuccessfully"));
            that._onBackToMain(oDetailView);
            
            setTimeout(function () {
                that._oController.onGetDM001();
            }, 1500);
            
            Util.showBI(false);
        },

        _getAttachmentChanges: function () {
            var oOriginalModel = this._oMainView.getModel("originalFieldValues");
            
            if (!oOriginalModel) {
                return null;
            }
            
            var aDynamicFields = oOriginalModel.getProperty("/dynamicFields");
            
            // Buscar campos de tipo attachment
            for (var i = 0; i < aDynamicFields.length; i++) {
                var field = aDynamicFields[i];
                
                if (field.cust_fieldtype === "A") {
                    var oControl = this._fieldControlsMap[field.externalCode];
                    
                    if (!oControl) continue;
                    
                    // Verificar si se eliminó un archivo
                    if (oControl.data("fileDeleted")) {
                        return {
                            action: "delete",
                            fieldData: field,
                            oldAttachmentId: field.cust_value || ""
                        };
                    }
                    
                    // Verificar si hay un nuevo archivo para subir
                    if (this._oController._archivosParaSubir) {
                        return {
                            action: "upload",
                            file: this._oController._archivosParaSubir,
                            fieldData: field,
                            oldAttachmentId: field.cust_value || ""
                        };
                    }
                }
            }
            
            return null;
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
                let sDisplayValue = sValue; 

                if (oDynamicField.cust_fieldtype === "P" && sValue !== "" && sValue.trim() !== "") {
                    try {
                        const oModel = this._oController.getOwnerComponent().getModel();
                        const aFilter = [new Filter("optionId", FilterOperator.EQ, sValue)];
                        const data = await Service.readDataERP("/PicklistLabel", oModel, aFilter);

                        if (data?.data?.results?.length) {
                            sDisplayValue = data.data.results[0].label || sValue;
                        }
                    } catch (error) {
                        console.error("Error cargando picklist label:", error);
                        Util.showBI(false)
                    }
                }

                let bFieldEditable = oDynamicField.cust_modif === true && bEditMode && oSolicitud.cust_status === "RA";

                let oFieldConfig = {
                    oForm,
                    sLabel,
                    sValue         : sDisplayValue,
                    realValue      : sValue, 
                    fieldType      : oDynamicField.cust_fieldtype,
                    fieldValue     : oDynamicField.cust_value,
                    editable       : bFieldEditable,
                    sStatusEditable: oDynamicField.cust_modif,
                    mandatory      : oDynamicField.cust_mandatory,
                    externalCode   : oDynamicField.externalCode

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

            // Si el valor está vacío, mostrar texto por defecto
            if (sDisplayValue === undefined || sDisplayValue === null || sDisplayValue === "") {
                sDisplayValue = "";
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
                    oField = this._createPicklistField(sFieldId, sDisplayValue, oFieldConfig.editable);
                    if (oField && oFieldConfig.realValue) {
                        oField.data("realValue", oFieldConfig.realValue);
                    }
                    break;
                case "F":
                    oField = this._createDateField(sFieldId, sDisplayValue, oFieldConfig.editable);                  
                    break;
                case "I":
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig.editable);                    
                    break;
                case "S":
                    oField = this._createTextAreaField(sFieldId, sDisplayValue, oFieldConfig.editable);                    
                    break;
                case "A":
                    oField = this._createFileUploaderField(sFieldId, oFieldConfig.fieldValue, oFieldConfig.editable);                    
                    break;
                case "URL":
                    oField = this._createURLField(sFieldId, sDisplayValue, oFieldConfig.editable);                    
                    break;
                default:
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig.editable);
            }

            if (oField && oFieldConfig.externalCode) {
                this._fieldControlsMap[oFieldConfig.externalCode] = oField;
            }
            // Agregar al formulario
            oFieldConfig.oForm.addContent(oLabel);
            oFieldConfig.oForm.addContent(oField);

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

            oUpload.data("originalAttachmentId", sCustValue || "");

            const oModel = this._oController.getOwnerComponent().getModel();

            let oAttachmentsModel = this._oController.getView().getModel("attachmentsModel");
            if (!oAttachmentsModel) {
                oAttachmentsModel = new sap.ui.model.json.JSONModel({
                    aAdjuntos: []
                });
                this._oController.getView().setModel(oAttachmentsModel, "attachmentsModel");
            }

            if (sCustValue && sCustValue.trim() !== "") {
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
        
                            Util.showBI(false);
                        } else {
                            Util.showBI(false);
                        }
                    })
                    .catch(error => {
                        console.error("Error cargando attachment:", error.message);
                        Util.showBI(false);
                    });
            } else {
                Util.showBI(false);
            }
        
            return oUpload;
        },

        _createURLField: function (sFieldId, sDisplayValue, bEditable) {

            if (sDisplayValue === "(Vacío)" || !sDisplayValue) {
                return new Input({
                    id: sFieldId,
                    value: sDisplayValue,
                    editable: false,
                    enabled: true                    
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
        }
    });
});