sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../dinamic/DinamicFields",
    "../service/Service",
    "../model/formatter",
    "../Utils/Util",

], function (Controller, JSONModel, MessageBox, Fragment, Filter, FilterOperator, DinamicFields, Service, formatter, Util) {
    "use strict";

    return Controller.extend("com.inetum.missolicitudes.controller.Main", {
        formatter: formatter,

        onInit: function () {

            this.loadCurrentUser();
            this.oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            //Pasar la referencia del controlador
            this._oDinamicFields = new DinamicFields(this);
        },


        loadCurrentUser: function () {
            var that = this;

            $.ajax({
                url: sap.ui.require.toUrl("com/inetum/missolicitudes") + "/user-api/currentUser",
                method: "GET",
                async: true,
                success: function (data) {
                    that._setUserModel(data);
                },
                error: function (oError) {
                    console.error("Error obteniendo usuario:", oError.status, oError.responseText);
                    that._setUserModel({
                        displayName: '',
                        email: '',
                        firstname: '',
                        lastname: '',
                        name: ''
                    });
                }
            });
        },

        _setUserModel: function (userData) {
            var oViewUserModel = new sap.ui.model.json.JSONModel([{
                "displayName": userData.displayName || '',
                "email": userData.email || '',
                "firstname": userData.firstname || '',
                "lastname": userData.lastname || '',
                "name": userData.name || ''
            }]);

            this.getView().setModel(oViewUserModel, "oModelUser");
            sap.ui.getCore().setModel(oViewUserModel, "oModelUser");
            sessionStorage.setItem("displayName", oViewUserModel.getProperty("/0/name"));
            this.oCurrentUser = oViewUserModel.getData()[0];
            this.onGetDM001();
        },


        /**
        * Con la entidad cust_INETUM_SOL_DM_0002 y expand createdByNav recupero nombre usuario, correo, Id
        */

        onGetDM001: async function () {

            var oTable = this.byId("idRequestTable");
            oTable.setShowNoData(false);
            Util.showBI(true);

            try {
                const oModel = this.getOwnerComponent().getModel();
                const aFilters = [
                    new Filter("createdBy", FilterOperator.EQ, this.oCurrentUser.name) //this.oCurrentUser.name -- Usuario actual                  
                ];

                // Parámetros para la consulta
                const oParam = {
                    bParam: true,
                    oParameter: {
                        "$expand": "cust_steps,cust_solFields/cust_fieldtypeNav"
                    }
                };

                // LLamar al servicio
                const { data } = await Service.readDataERP("/cust_INETUM_SOL_DM_0001", oModel, aFilters, oParam);   // ("/cust_INETUM_SOL_C_0001", oModel, [], {} ) Si no se necesitan filtros o parametros

                // Formateo de fecha y status de solicitud
                data.results.forEach(item => {
                    item.cust_status_Str = formatter.formatNameStatus(item.cust_status);
                    item.cust_fechaSol_Str = formatter.formatDate(item.cust_fechaSol);
                });

                const oSolicitudesData = {
                    solicitudes: {
                        results: data.results,
                        totalCount: data.results.length
                    },

                };
                var oSolicitudesModel = new JSONModel(oSolicitudesData);
                this.getView().setModel(oSolicitudesModel, "solicitudes");

                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    var oSorter = new sap.ui.model.Sorter("cust_fechaSol", true);
                    oBinding.sort(oSorter);
                }

                Util.showBI(false);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);
            } finally {
                oTable.setBusy(false);
                oTable.setShowNoData(true);
                Util.showBI(false);
            }
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query");
            var oTable = this.byId("idRequestTable");
            var oBinding = oTable.getBinding("rows");

            if (sQuery) {
                var aFilters = [
                    new sap.ui.model.Filter("cust_nombreSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("cust_nombreTSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("cust_fechaSol_Str", sap.ui.model.FilterOperator.Contains, sQuery)
                ];
                var oMainFilter = new sap.ui.model.Filter(aFilters, false);
                oBinding.filter([oMainFilter]);
            } else {
                oBinding.filter([]);
                this.clearAllFlters();
            }
            this._updateTableCount()
        },

        clearAllFlters: function () {
            var oTable = this.byId("idRequestTable");

            oTable.getBinding()?.sort(null);
            var oUiModel = this.getView().getModel("mLocalModel");
            oUiModel.setProperty("/globalFilter", "");
            oUiModel.setProperty("/availabilityFilterOn", false);

            var aColumns = oTable.getColumns();
            for (var i = 0; i < aColumns.length; i++) {
                oTable.filter(aColumns[i], null);
            }

            this._resetSortingState();

        },
        /**
         * Quita el ordenamiento de cada columna en la tabla  
        **/
        _resetSortingState: function () {
            var oTable = this.byId("idRequestTable");
            var aColumns = oTable.getColumns();
            for (var i = 0; i < aColumns.length; i++) {
                aColumns[i].setSorted(false);
            }
        },

        /**
        * Actualiza la cantidad de registros de la tabla  
       **/
        _updateTableCount: function () {
            var oTable = this.byId("idRequestTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                let iFilteredCount = oBinding.getLength();
                this.getView().getModel("solicitudes").setProperty("/solicitudes/totalCount", iFilteredCount);
            }
        },


        onVisualizarPress: function (oEvent) {
            Util.showBI(true);
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode, false);
        },

        onEditarPress: function (oEvent) {
            Util.showBI(true);
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            if (oSolicitud.cust_status === "RA") {
                this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode, true);
            }
        },

        /**
         * Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: function (oEvent) {
            // Guardar el contexto y datos para usarlos después
            this._oCurrentContext = oEvent.getSource().getBindingContext("solicitudes");
            this._oSolicitudCompleta = this._oCurrentContext.getObject();
            this._sSolicitudId = this._oCurrentContext.getProperty("cust_nombreSol");

            // Configurar el modelo del dialog
            const oDialogModel = new sap.ui.model.json.JSONModel({
                icon: "sap-icon://message-warning",
                type: this.oResourceBundle.getText("confirmCancel"),
                state: "Warning",
                message: this.oResourceBundle.getText("cancelRequestConfirmation", [this._sSolicitudId]),
                acceptText: this.oResourceBundle.getText("aceptar") || "Aceptar",
                cancelText: this.oResourceBundle.getText("cancel") || "Cancelar"
            });

            const oView = this.getView();
            if (!this.byId("commentDialog")) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.inetum.missolicitudes.view.fragment.actionComment",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    oDialog.setModel(oDialogModel, "dialogViewModel");
                   
                    this.byId("acceptButton").attachPress(this.onConfirmCancelacion.bind(this));
                    this.byId("cancelButton").attachPress(this.onCancelComment.bind(this));
                    oDialog.open();

                }.bind(this));
            } else {
                const oTextArea = this.byId("commentTextArea");
                if (oTextArea) {
                    oTextArea.setVisible(false);
                    oTextArea.setValue("");
                }
                this.byId("commentDialog").setModel(oDialogModel, "dialogViewModel");
                this.byId("commentDialog").open();
            }
        },

        onToggleComment: function () {
            const oTextArea = this.byId("commentTextArea");
            if (oTextArea) {
                oTextArea.setVisible(!oTextArea.getVisible());
                if (oTextArea.getVisible()) {
                    oTextArea.focus();
                }
            }
        },

        onConfirmCancelacion: function () {
            // Obtener el comentario si existe
            const oTextArea = this.byId("commentTextArea");
            const sComment = oTextArea && oTextArea.getVisible() ? oTextArea.getValue() : "";

            this.byId("commentDialog").close();
            
            this._oCurrentContext.getModel().setProperty(
                this._oCurrentContext.getPath() + "/cust_status",
                "Cancelado"
            );

            // Guardar el comentario si existe 
            if (sComment && sComment.trim() !== "") {
                this._oCurrentContext.getModel().setProperty(
                    this._oCurrentContext.getPath() + "/cust_comentario",
                    sComment
                );
            }

            // Cambiar el status
            this.onChangeStatus(this._oSolicitudCompleta);
                        
            Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel"),"toast");
            // Actualizar la tabla
            var oTable = this.byId("idRequestTable");
            oTable.getModel("solicitudes").refresh();

            // Limpiar variables
            this._oCurrentContext = null;
            this._oSolicitudCompleta = null;
            this._sSolicitudId = null;
        },

        // Handler para el botón Cancelar del Dialog
        onCancelComment: function () {
            // Limpiar y cerrar el dialog
            const oTextArea = this.byId("commentTextArea");
            if (oTextArea) {
                oTextArea.setValue("");
                oTextArea.setVisible(false);
            }
            this.byId("commentDialog").close();

            // Limpiar variables
            this._oCurrentContext = null;
            this._oSolicitudCompleta = null;
            this._sSolicitudId = null;
        },

        /**
         * Cancelar solicitud desde el dialog de detalles
         * Esta función será llamada desde DinamicFields
         * Retorna una Promise para manejar la respuesta asíncrona
         */
        onCancelarSolicitudFromDetail: function (sNombreSol, sSolicitudId) {
            var that = this;
            var sMessage = this.oResourceBundle.getText("cancelRequestConfirmation", [sNombreSol])

            return new Promise(function (resolve, reject) {
                MessageBox.warning(sMessage, {
                    title: "Confirmar Cancelación",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.YES) {
                            var bSuccess = that._cancelarSolicitudById(sSolicitudId);
                            resolve(bSuccess); // Devuelve true si se canceló exitosamente
                        } else {
                            resolve(false); // Devuelve false si el usuario canceló la acción
                        }
                    }
                });
            });
        },

        /**
         * Cancelar solicitud por ID - función auxiliar
         */
        _cancelarSolicitudById: function (sSolicitudId) {
            var oModel = this.getView().getModel("solicitudes");
            var aSolicitudes = oModel.getProperty("/solicitudes/results");
            var iIndex = aSolicitudes.findIndex(function (item) {
                return item.externalCode === sSolicitudId;
            });

            if (iIndex >= 0) {
                var oSolicitudCompleta = aSolicitudes[iIndex];
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "Cancelado");
                Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [oSolicitudCompleta.cust_nombreSol]), "toast");

                this.onChangeStatus(oSolicitudCompleta);
                // Forzar actualización
                oModel.refresh(sSolicitudId);
                return true;
            }
            return false;
        },

        onChangeStatus: async function (oSolicitud) {

            const oModel = this.getOwnerComponent().getModel();
            var sEntityPath = this._buildEntityPath(oSolicitud.externalCode, oSolicitud.effectiveStartDate);

            try {

                let oDataToUpdate = {
                    externalCode: oSolicitud.externalCode,
                    cust_status: "CA",
                    effectiveStartDate: formatter._formatEffectiveStartDate(oSolicitud.effectiveStartDate),
                    cust_fechaAct: formatter._formatDateForSAP(new Date()),
                    cust_indexStep: "0"
                }

                oModel.update(sEntityPath, oDataToUpdate, {
                    success: function (oData, oResponse) {
                        console.log("Status actualizado");
                    },
                    error: function (oError) {
                        console.error("Error Actualizar", oError);
                    }
                });

                Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [oSolicitud.cust_nombreSol]), "toast");

                this.onGetDM001()

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);

            } finally {
                Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [oSolicitud.cust_nombreSol]), "toast");
            }

        },

        _buildEntityPath: function (sExternalCode, sEffectiveStartDate) {
            // Formatear effectiveStartDate para la URL
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            // Construir path con clave compuesta
            var sEntityPath = `/cust_INETUM_SOL_DM_0001(effectiveStartDate=datetime'${sFormattedDate}',externalCode='${sExternalCode}')`;

            return sEntityPath;

        },

        onDetectorAdjunto: function (oEvent) {
            const oFile = oEvent.getParameter("files")[0];
            if (!oFile) return;

            const oReader = new FileReader();
            oReader.onload = (e) => {
                const sBase64Content = e.target.result.split(",")[1];

                // Guardar para envío posterior
                this._archivosParaSubir = {
                    nombre: oFile.name,
                    contenido: sBase64Content,
                    mimeType: oFile.type
                };

                // 🔹 Crear el UploadCollectionItem manualmente
                const oItem = new sap.m.UploadCollectionItem({
                    fileName: oFile.name,
                    mimeType: oFile.type,
                    url: "data:" + oFile.type + ";base64," + sBase64Content,
                    thumbnailUrl: "sap-icon://pdf-attachment",
                    enableEdit: true,
                    enableDelete: true
                });

                // Buscar el UploadCollection donde se cargó
                const oUploadCollection = oEvent.getSource();
                oUploadCollection.removeAllItems(); // Si solo quieres un archivo
                oUploadCollection.addItem(oItem);

                sap.m.MessageToast.show(this.oResourceBundle.getText("fileReadyToBeSaved"));
            };

            oReader.readAsDataURL(oFile);
        }


    });
});