sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../dinamic/DinamicFields",
    "../service/Service",
    "../model/formatter",
    "../Utils/Util",

], function (Controller, JSONModel, Fragment, MessageToast, MessageBox, Filter, FilterOperator, DinamicFields, Service, formatter, Util) {
    "use strict";

    return Controller.extend("com.inetum.missolicitudes.controller.Main", {
        formatter: formatter,

        onInit: function () {
            // Crear datos mock directamente aquí para evitar problemas de dependencias
            // var oMockData = this._createMockData();
            // console.log("Datos mock creados:", oMockData); // Debug

            // var oSolicitudesModel = new JSONModel(oMockData);
            // this.getView().setModel(oSolicitudesModel, "solicitudes");

            // Modelo para el diálogo de detalles
            var oDetailModel = new JSONModel({});
            this.getView().setModel(oDetailModel, "detailDialog");

            // Variable para el fragment
            this._pDetailFragment = null;

            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage();
            console.log("Idioma UI5:", sLanguage);

            var currentUser = sap.ushell.Container.getService("UserInfo");
            console.log("Usuario Actual: ", currentUser);

            // this.oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            // Util.onShowMessage(oResourceBundle.getText("messageNotRedirectToClaimCreation"), "error");

            //Pasar la referencia del controlador
            this._oDinamicFields = new DinamicFields(this);
        },

        onAfterRendering: async function () {


            // var oModel = this.getOwnerComponent().getModel();

            // oModel.read("/cust_INETUM_SOL_C_0001", {
            //     urlParameters: {
            //         "$expand": "cust_idTipoNav",
            //         "$format": "json",
            //         "$top": "50"

            //     },
            //     success: function(oData) {
            //         console.log("Expand:", oData);
            //     },
            //     error: function(oError) {
            //         console.error("Error:", oError);
            //     }
            // });

            this.onGetDM001();


        },

        onGetDM001: async function () {
            Util.showBI(true);
            try {
                const oModel = this.getOwnerComponent().getModel();

                const aFilters = [
                    new Filter("cust_object", FilterOperator.EQ, "SP")
                ];

                // Parámetros para la consulta
                const oParam = {
                    bParam: true,
                    oParameter: {
                        //  "$expand": "cust_idTipo2Nav",                      
                        "$format": "json",
                        "$top": "50"
                        // "$select": "externalCode,cust_nombreSol_localized,cust_status,cust_idTipo,effectiveStartDate,lastModifiedDateTime" cust_fieldTypeNav
                    }
                };

                // LLamar al servicio
                const { data } = await Service.readDataERP("/cust_INETUM_SOL_DM_0001", oModel, [], oParam);   // ("/cust_INETUM_SOL_C_0001", oModel, [], {} ) Si no se necesitan filtros o parametros

                data.results.forEach(item => {
                    item.cust_status = formatter.formatNameStatus(item.cust_status)
                });

                const oSolicitudesData = {
                    solicitudes: {
                        results: data.results,
                        totalCount: data.results.length
                    }
                };
                var oSolicitudesModel = new JSONModel(oSolicitudesData);
                this.getView().setModel(oSolicitudesModel, "solicitudes");
                // this._configureTableRowVisibility(data.results.length);
                Util.onShowMessage(`Se econtraron: ${data.results ? data.results.length : 0} registros`, 'toast');
                this.onGetSOL0004();
                Util.showBI(false);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);
            }
        },

        onGetSOL0004: async function () {
            Util.showBI(true);
            try {
                const oModel = this.getOwnerComponent().getModel();

                const aFilters = [
                    new Filter("externalCode", FilterOperator.EQ, 19481)
                ];

                // Parámetros para la consulta
                const oParam = {
                    bParam: true,
                    oParameter: {
                        "$expand": "cust_fieldTypeNav",
                        "$format": "json",
                        "$top": "50"

                    }
                };

                // LLamar al servicio
                const { data } = await Service.readDataERP("/cust_INETUM_SOL_C_0004", oModel, [], oParam);   // ("/cust_INETUM_SOL_C_0001", oModel, [], {} ) Si no se necesitan filtros o parametros

                var oTypeNav = new JSONModel(data);
                this.getView().setModel(oTypeNav, "typeNav");
                // this._configureTableRowVisibility(data.results.length);
                Util.onShowMessage(`Se econtraron: ${data.results ? data.results.length : 0} registros`, 'toast');
                Util.showBI(false);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);
            }
        },


        /**
         * Crear datos mock directamente en el controller
         */
        _createMockData: function () {
            return {
                solicitudes: {
                    totalCount: 8,
                    results: [
                        {
                            idSolicitud: "SOL-2024-001",
                            cust_nombreSol: "Actualización Datos Personales",
                            cust_nombreTSol: "Cambios Personales",
                            cust_fechaSol: new Date("2024-07-08T09:30:00"),
                            cust_status: "EN_CURSO"
                        },
                        {
                            idSolicitud: "SOL-2024-002",
                            cust_nombreSol: "Solicitud de Vacaciones",
                            cust_nombreTSol: "Permisos y Ausencias",
                            cust_fechaSol: new Date("2024-07-05T14:15:00"),
                            cust_status: "COMPLETADO"
                        },
                        {
                            idSolicitud: "SOL-2024-003",
                            cust_nombreSol: "Cambio de Departamento",
                            cust_nombreTSol: "Cambios Laborales",
                            cust_fechaSol: new Date("2024-07-01T11:20:00"),
                            cust_status: "EN_CURSO"
                        },
                        {
                            idSolicitud: "SOL-2024-004",
                            cust_nombreSol: "Actualización Información Bancaria",
                            cust_nombreTSol: "Cambios Financieros",
                            cust_fechaSol: new Date("2024-06-28T16:45:00"),
                            cust_status: "RECHAZADO"
                        },
                        {
                            idSolicitud: "SOL-2024-005",
                            cust_nombreSol: "Solicitud Permiso Médico",
                            cust_nombreTSol: "Permisos y Ausencias",
                            cust_fechaSol: new Date("2024-06-25T08:00:00"),
                            cust_status: "CANCELADO"
                        },
                        {
                            idSolicitud: "SOL-2024-006",
                            cust_nombreSol: "Cambio de Horario",
                            cust_nombreTSol: "Cambios Laborales",
                            cust_fechaSol: new Date("2024-06-20T13:30:00"),
                            cust_status: "EN_CURSO"
                        },
                        {
                            idSolicitud: "SOL-2024-007",
                            cust_nombreSol: "Solicitud Formación",
                            cust_nombreTSol: "Desarrollo Profesional",
                            cust_fechaSol: new Date("2024-06-15T10:15:00"),
                            cust_status: "COMPLETADO"
                        },
                        {
                            idSolicitud: "SOL-2024-008",
                            cust_nombreSol: "Actualización Dirección",
                            cust_nombreTSol: "Cambios Personales",
                            cust_fechaSol: new Date("2024-06-10T15:45:00"),
                            cust_status: "EN_CURSO"
                        }
                    ]
                }
            };
        },

        /**
         * Event handlers básicos
         */
        onRowSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();
            var aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length > 0) {
                var iSelectedIndex = aSelectedIndices[0];
                var oContext = oTable.getContextByIndex(iSelectedIndex);

                if (oContext) {
                    console.log("Fila seleccionada:", oContext.getObject());
                }
            }
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query");
            var oTable = this.byId("solicitudesTable");
            var oBinding = oTable.getBinding("rows");

            if (sQuery) {
                var aFilters = [
                    new sap.ui.model.Filter("cust_nombreSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("cust_nombreTSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("idSolicitud", sap.ui.model.FilterOperator.Contains, sQuery)
                ];
                var oMainFilter = new sap.ui.model.Filter(aFilters, false);
                oBinding.filter([oMainFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onEstadoFilterChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            var oTable = this.byId("solicitudesTable");
            var oBinding = oTable.getBinding("rows");

            if (sSelectedKey) {
                var oFilter = new sap.ui.model.Filter("cust_status", sap.ui.model.FilterOperator.EQ, sSelectedKey);
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onRefresh: function () {
            var oModel = this.getView().getModel("solicitudes");
            oModel.refresh();
            Util.onShowMessage("Solicitudes actualizadas", 'toast');
        },

        onVisualizarPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode);
        },

        /**
         * Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var sNombreSol = oContext.getProperty("cust_nombreSol");
            var sSolicitudId = oContext.getProperty("externalCode");

            var sMessage = "¿Está seguro que desea cancelar la solicitud '" + sSolicitudId + "'?";

            MessageBox.warning(sMessage, {
                title: "Confirmar Cancelación",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        // CORREGIDO: Usar el nombre correcto del campo
                        oContext.getModel().setProperty(oContext.getPath() + "/cust_status", "CANCELADO");
                        Util.onShowMessage("Solicitud " + sSolicitudId + " cancelada correctamente", "toast");
                        // Forzar actualización de la tabla
                        var oTable = this.byId("solicitudesTable");
                        oTable.getModel("solicitudes").refresh();
                    }
                }.bind(this)
            });
        },

        /**
         * Cancelar solicitud desde el dialog de detalles
         * Esta función será llamada desde DinamicFields
         * Retorna una Promise para manejar la respuesta asíncrona
         */
        onCancelarSolicitudFromDetail: function (sSolicitudId, sNombreSol) {
            var that = this;
            var sMessage = "¿Está seguro que desea cancelar la solicitud '" + sNombreSol + "'?";

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
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "CANCELADO");
                Util.onShowMessage("Solicitud " + sSolicitudId + " cancelada correctamente", 'toast');

                // Forzar actualización
                oModel.refresh();
                return true;
            }
            return false;
        }

    });
});