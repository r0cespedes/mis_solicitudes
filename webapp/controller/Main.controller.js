sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../dinamic/DinamicFields",
    "../service/Service",
    "../model/formatter",
    "../Utils/Util",

], function (Controller, JSONModel, MessageBox, Filter, FilterOperator, DinamicFields, Service, formatter, Util) {
    "use strict";

    return Controller.extend("com.inetum.missolicitudes.controller.Main", {
        formatter: formatter,

        onInit: function () {


            // Modelo para el diálogo de detalles
            var oDetailModel = new JSONModel({});
            this.getView().setModel(oDetailModel, "detailDialog");

            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage();
            console.log("Idioma UI5:", sLanguage);

            this.loadCurrentUser();

            // this.oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            // Util.onShowMessage(oResourceBundle.getText("message"), "error");

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
                error: function (jqXHR, textStatus, errorThrown) {
                    console.error("Error obteniendo usuario:", jqXHR.status, jqXHR.responseText);
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
            this.onGetDM001(oViewUserModel.getData()[0]);
        },

        // onAfterRendering: async function () {

        //     var oModel = this.getOwnerComponent().getModel();

        //     oModel.read("/cust_INETUM_SOL_C_0001", {
        //         urlParameters: {
        //             "$expand": "cust_tipoObjectNav,cust_idTipo2Nav,cust_nombreSolTranslationTextNav,cust_objectNav",
        //             "$format": "json",
        //             "$top": "50"

        //         },
        //         success: function (oData) {
        //             console.log("Datos de SOL_C_0001:", oData);
        //         },
        //         error: function (oError) {
        //             console.error("Error:", oError);
        //         }
        //     });

        //     this.onGetDM001();


        // },

        /**
        * Con la entidad cust_INETUM_SOL_DM_0002 y expand createdByNav recupero nombre usuario, correo, Id
        */

        onGetDM001: async function (oCurrentUser) {
            Util.showBI(true);

            try {
                const oModel = this.getOwnerComponent().getModel();
                const aFilters = [
                    new Filter("createdBy", FilterOperator.EQ, 'SFADMIN_JJD') //oCurrentUser.name)
                ];

                // Parámetros para la consulta
                const oParam = {
                    bParam: true,
                    oParameter: {
                        "$expand": "cust_tipoObjectNav/labelTranslationTextNav,cust_objectNav,cust_statusNav,mdfSystemRecordStatusNav",
                        "$format": "json",
                        "$top": "50"
                        // "$select": "externalCode,cust_nombreSol_localized,cust_status,cust_idTipo,effectiveStartDate,lastModifiedDateTime" cust_fieldTypeNav
                    }
                };

                // LLamar al servicio
                const { data } = await Service.readDataERP("/cust_INETUM_SOL_DM_0001", oModel, [], oParam);   // ("/cust_INETUM_SOL_C_0001", oModel, [], {} ) Si no se necesitan filtros o parametros

                // data.results.forEach(item => {

                    // if (item.cust_status === "CA") {
                    //     item.cust_status = "EC"  // ****** Pruebas para cambiar status de la solicitud ****** //
                    // }

                //     item.cust_status = formatter.formatNameStatus(item.cust_status)
                // });

                data.results.forEach(function(item, idx){
                    item.cust_status = formatter.formatNameStatus(item.cust_status)
                    if(!item.cust_nombreSol || !item.cust_nombreTSol){
                        item.cust_nombreSol  = "Prueba Solicitud " + idx;
                        item.cust_nombreTSol = "Prueba Tipo Solicitud " + idx;

                    }
                });

                const oSolicitudesData = {
                    solicitudes: {
                        results: data.results,
                        totalCount: data.results.length
                    }
                };
                var oSolicitudesModel = new JSONModel(oSolicitudesData);
                this.getView().setModel(oSolicitudesModel, "solicitudes");               
                this.onGetSOL0003();
                Util.showBI(false);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);
            }
        },

        onGetSOL0003: async function () {
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
                        "$expand": "cust_objectNav,cust_tipoObjectNav",
                        "$format": "json",
                        "$top": "50"

                    }
                };

                // LLamar al servicio
                const { data } = await Service.readDataERP("/cust_INETUM_SOL_DM_0003", oModel, [], oParam);   // ("/cust_INETUM_SOL_DM_0003", oModel, [], {} ) Si no se necesitan filtros o parametros

                var oTypeNav = new JSONModel(data);
                this.getView().setModel(oTypeNav, "typeNav");                
                Util.showBI(false);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);
            }
        },

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
                    new sap.ui.model.Filter("cust_status", sap.ui.model.FilterOperator.Contains, sQuery)
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
            Util.showBI(true);
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode);
        },

        /**
         * Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitudCompleta = oContext.getObject();
            var sSolicitudId = oContext.getProperty("externalCode");

            var sMessage = "¿Está seguro que desea cancelar la solicitud '" + sSolicitudId + "'?";

            MessageBox.warning(sMessage, {
                title: "Confirmar Cancelación",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        oContext.getModel().setProperty(oContext.getPath() + "/cust_status", "CANCELADO");
                        this.onChangeStatus(oSolicitudCompleta);

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
                var oSolicitudCompleta = aSolicitudes[iIndex];
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "CANCELADO");
                Util.onShowMessage("Solicitud " + oSolicitudCompleta.externalCode + " cancelada correctamente", 'toast');

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

                let { oResult } = await Service.updateDataERP(sEntityPath, oModel, oDataToUpdate);
                Util.onShowMessage("Solicitud " + oSolicitud.externalCode + " cancelada correctamente", 'toast');
                console.log("Solicitud actualizada en backend exitosamente:", oResult);

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);

            }

        },

        _buildEntityPath: function (sExternalCode, sEffectiveStartDate) {
            // Formatear effectiveStartDate para la URL
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            // Construir path con clave compuesta
            var sEntityPath = `/cust_INETUM_SOL_DM_0001(effectiveStartDate=datetime'${sFormattedDate}',externalCode='${sExternalCode}')`;

            return sEntityPath;
        },


    });
});