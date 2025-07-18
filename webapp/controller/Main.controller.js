sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "com/inetum/missolicitudes/dinamic/DinamicFields",
    "com/inetum/missolicitudes/service/Service"
], function (Controller, JSONModel, Fragment, MessageToast, MessageBox, Filter, FilterOperator, DinamicFields, Service) {
    "use strict";

    return Controller.extend("com.inetum.missolicitudes.controller.Main", {

        onInit: function () {
            // Crear datos mock directamente aquí para evitar problemas de dependencias
            var oMockData = this._createMockData();
            console.log("Datos mock creados:", oMockData); // Debug
            
            var oSolicitudesModel = new JSONModel(oMockData);
            this.getView().setModel(oSolicitudesModel, "solicitudes");
          
            // Modelo para configuración
            var oConfigModel = new JSONModel({
                titulo2: "Mis Solicitudes",
                cancelar: "Cancelar", 
                aceptar: "Aceptar",
                cerrar: "Cerrar"
            });
            this.getView().setModel(oConfigModel, "config");

            // Modelo para el diálogo de detalles
            var oDetailModel = new JSONModel({});
            this.getView().setModel(oDetailModel, "detailDialog");
            
            // Variable para el fragment
            this._pDetailFragment = null;

            // IMPORTANTE: Pasar la referencia del controlador
            this._oDinamicFields = new DinamicFields(this);
        },

        onAfterRendering: async function() {

            // const oModel = this.getOwnerComponent().getModel("cust_INETUM_SOL_C_0001");
            // var oModel = this.getOwnerComponent().getModel();
 
            // oModel.read("/cust_INETUM_SOL_C_0001", {
            //     urlParameters: {
            //         "$expand": "cust_idTipoNav",
            //         "$format": "json",
            //         "$top": "50"
                    
            //     },
            //     success: function(oData) {
            //         console.log("✅ FUNCIONA sin expand:", oData);
            //     },
            //     error: function(oError) {
            //         console.error("❌ Error:", oError);
            //     }
            // });

            this.onTestRead();


        },

        onTestRead: async function() {
            try {
                        
                const oModel = this.getOwnerComponent().getModel();
                
                // Crear filtros para la prueba
                const aFilters = [
                    new Filter("externalCode", FilterOperator.EQ, 19481)
                ];
                
                // Parámetros para la consulta
                const oParam = {
                    bParam: true,
                    oParameter: {
                        "$expand": "cust_idTipoNav",
                        "$format": "json",
                        "$top": "10",
                        "$select": "externalCode,cust_nombreSol_localized,cust_status,cust_idTipo,effectiveStartDate,lastModifiedDateTime"
                    }
                };
                
                // Llamar al service
                const { data, response } = await Service.readDataERP("/cust_INETUM_SOL_C_0001", oModel, aFilters, oParam );
                MessageToast.show(`READ exitoso: ${data.results ? data.results.length : 0} registros`);
                
                return data;
                
            } catch (error) {
                console.error("❌ PRUEBA READ FALLÓ:", error);
                MessageToast.show("Error en prueba READ: " + (error.message || error));
            }
        },

        
        readDataERP: function(_sEntity, _oService, _aFilter, oParam = { bParam: false, oParameter: undefined }) {
            return new Promise((resolve, reject) => {
                // Validaciones de entrada
                if (!_sEntity || !_oService) {
                    reject(new Error("Entidad y servicio son requeridos"));
                    return;
                }
        
                // CORRECCIÓN: Asegurar que la entidad no tenga "/" al inicio para SuccessFactors
                let sCleanEntity = _sEntity.startsWith('/') ? _sEntity.substring(1) : _sEntity;
                
                // Configuración de parámetros
                const oReadParams = {
                    filters: _aFilter || [],
                    urlParameters: oParam.bParam ? oParam.oParameter : {},
                    success: (data, response) => {
                        console.log("Consulta exitosa a entidad:", sCleanEntity);
                        console.log("Datos recibidos:", data);
                        resolve({ data, response });
                    },
                    error: (error) => {
                        console.error("Error en consulta OData para entidad:", sCleanEntity);
                        console.error("Error detallado:", error);
                        reject(error);
                    }
                };
        
                // Ejecutar la consulta con la entidad limpia
                _oService.read("/" + sCleanEntity, oReadParams);
            });
        },


        /**
         * Crear datos mock directamente en el controller
         */
        _createMockData: function() {
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
         * Formatters para la tabla
         */
        formatStatusState: function(sStatus) {
            switch (sStatus) {
                case "EN_CURSO":
                    return "Warning";
                case "COMPLETADO":
                    return "Success";
                case "CANCELADO":
                    return "None";
                case "RECHAZADO":
                    return "Error";
                default:
                    return "None";
            }
        },

        formatStatusIcon: function(sStatus) {
            switch (sStatus) {
                case "EN_CURSO":
                    return "sap-icon://pending";
                case "COMPLETADO":
                    return "sap-icon://complete";
                case "CANCELADO":
                    return "sap-icon://cancel";
                case "RECHAZADO":
                    return "sap-icon://decline";
                default:
                    return "sap-icon://status-inactive";
            }
        },

        isStatusEnCurso: function(sStatus) {
            return sStatus === "EN_CURSO";
        },

        /**
         * Event handlers básicos
         */
        onRowSelectionChange: function(oEvent) {
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

        onSearch: function(oEvent) {
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

        onEstadoFilterChange: function(oEvent) {
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

        onRefresh: function() {
            var oModel = this.getView().getModel("solicitudes");
            oModel.refresh();
            MessageToast.show("Solicitudes actualizadas");
        },

        onVisualizarPress: function(oEvent){
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();
            
            this._oDinamicFields.showDynamicDetailView(oSolicitud.idSolicitud);
        },

        /**
         * CORREGIDO: Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext("solicitudes");            
            var sNombreSol = oContext.getProperty("cust_nombreSol");
            var sSolicitudId = oContext.getProperty("idSolicitud");
            
            var sMessage = "¿Está seguro que desea cancelar la solicitud '" + sNombreSol + "'?";
            
            MessageBox.warning(sMessage, {
                title: "Confirmar Cancelación",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        // CORREGIDO: Usar el nombre correcto del campo
                        oContext.getModel().setProperty(oContext.getPath() + "/cust_status", "CANCELADO");
                        MessageToast.show("Solicitud " + sSolicitudId + " cancelada correctamente");
                        
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
        onCancelarSolicitudFromDetail: function(sSolicitudId, sNombreSol) {
            var that = this;
            var sMessage = "¿Está seguro que desea cancelar la solicitud '" + sNombreSol + "'?";
            
            return new Promise(function(resolve, reject) {
                MessageBox.warning(sMessage, {
                    title: "Confirmar Cancelación",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function(oAction) {
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
        _cancelarSolicitudById: function(sSolicitudId) {
            var oModel = this.getView().getModel("solicitudes");
            var aSolicitudes = oModel.getProperty("/solicitudes/results");
            var iIndex = aSolicitudes.findIndex(function(item) {
                return item.idSolicitud === sSolicitudId;
            });
            
            if (iIndex >= 0) {
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "CANCELADO");
                MessageToast.show("Solicitud " + sSolicitudId + " cancelada correctamente");
                
                // Forzar actualización
                oModel.refresh();
                return true;
            }
            return false;
        },

        /**
         * Fragment handlers
         */
        _openDetailFragment: function() {
            if (!this._pDetailFragment) {
                this._pDetailFragment = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.inetum.missolicitudeslocal.view.fragment.DetailRequest",
                    controller: this
                }).then(function(oFragment) {
                    this.getView().addDependent(oFragment);
                    return oFragment;
                }.bind(this));
            }
            
            this._pDetailFragment.then(function(oFragment) {
                oFragment.open();
            });
        },

        onCloseDetailDialog: function() {
            this._pDetailFragment.then(function(oFragment) {
                oFragment.close();
            });
        },

        onNuevaSolicitud: function() {
            MessageToast.show("Navegando a Crear Solicitud...");
        },

        onRowPress: function(oEvent) {
            // Manejar click en fila si es necesario
        },

        onSolicitudPress: function(oEvent) {
            // Abrir detalles cuando se hace click en el nombre
            this.onVisualizarPress(oEvent);
        }
    });
});