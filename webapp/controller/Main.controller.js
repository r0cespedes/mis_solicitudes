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
            this.loadCurrentUser();
            //  this.oCurrentUser = sap.ui.getCore().getModel("oModelUser").getData()[0];

            this.oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
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
                    that._getUserLanguage(data.name);
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
            this.oCurrentUser = oViewUserModel.getData()[0];
            this.onGetDM001();
        },

        _getUserLanguage: function (sUserName) {
            var that = this;    
            var oModel = this.getOwnerComponent().getModel();    
            var sEntityPath = "/User('" + sUserName + "')";    
        
            var mParameters = {            
                success: function (oData) {                
                    var sUserLanguage = oData.defaultLocale;                                  
                    that._aplicarIdiomaUI5(sUserLanguage);
                },        
            
                error: function (oError) {
                    console.warn("Error obteniendo idioma del usuario:", oError);
                    console.warn("Detalles del error:", oError.message || oError);        
                },        
            
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },        
        
                async: true,
                urlParameters: {
                    "$format": "json"
                }
            };    

            oModel.read(sEntityPath, mParameters);
        },

        _aplicarIdiomaUI5: function (sIdiomaSuccessFactors) {

            var mMapeoIdiomas = {
                "ca_ES": "ca",     // Catalán
                "en_DEBUG": "en",  // English Debug -> English
                "en_US": "en",     // English US
                "es_ES": "es"      // Español
            };
          
            var sIdiomaUI5 = mMapeoIdiomas[sIdiomaSuccessFactors];

            if (!sIdiomaUI5) {
                console.warn("Idioma no soportado:", sIdiomaSuccessFactors, "- Usando inglés por defecto");
                sIdiomaUI5 = "en";
            }
           
            sap.ui.getCore().getConfiguration().setLanguage(sIdiomaUI5);      

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
                    new Filter("createdBy", FilterOperator.EQ, this.oCurrentUser.name), //this.oCurrentUser.name -- Usuario actual
                    new Filter("cust_status", FilterOperator.EQ, 'EC')
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
                    item.cust_status = formatter.formatNameStatus(item.cust_status);
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

            this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode);
        },

        /**
         * Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitudCompleta = oContext.getObject();
            var sSolicitudId = oContext.getProperty("cust_nombreSol");
            var sMessage = this.oResourceBundle.getText("cancelRequestConfirmation", [sSolicitudId])

            MessageBox.warning(sMessage, {
                title: "Confirmar Cancelación",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        oContext.getModel().setProperty(oContext.getPath() + "/cust_status", "CANCELADO");
                        this.onChangeStatus(oSolicitudCompleta);

                        Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [sSolicitudId]), "toast");

                        // Si se quiere consultar de nuevo las solicitudes despues de cancelar se activa la funcion
                        // this.onGetDM001() 

                        // Forzar actualización de la tabla
                        var oTable = this.byId("idRequestTable");
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
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "CANCELADO");
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

                let { oResult } = await Service.updateDataERP(sEntityPath, oModel, oDataToUpdate);
                Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [oSolicitud.cust_nombreSol]), "toast");

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
            // Se obtiene el archivo cargado.
            const oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                return;
            }

            this._nombreArchivo = oFile.name;
            // Se crea un objeto de tipo FileReader que permite leer el archivo.
            const oReader = new FileReader();

            // Se define la acción a realizar cuando la lectura del archivo sea exitosa.
            oReader.onload = (e) => {
                // Se transforma el archivo en base64 y se almacena en una variable del controlador.
                const sBase64Content = e.target.result.split(",")[1];
                this._contenidoArchivo = sBase64Content;
                sap.m.MessageToast.show(this.oResourceBundle.getText("Archivo listo para ser guardado."));
            };

            // Se define la acción en caso de error.
            oReader.onerror = (e) => {
                sap.m.MessageToast.show("Error al leer el archivo.");
            };

            // Se inicia la lectura del archivo.
            oReader.readAsDataURL(oFile);
        }


    });
});