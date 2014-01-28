Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

        launch: function() {
            var panel = Ext.create('Ext.panel.Panel', {
                layout: 'hbox',
                itemId: 'parentPanel',
                componentCls: 'panel',
                items: [
                    {
                    xtype: 'rallyprojectpicker',
                    fieldLabel: 'select project',
                        listeners:{
                            change: function(combobox){
                                if ( this.down('#g')) {
                                    console.log('grid exists');
                                    Ext.getCmp('g').destroy();
                                    console.log('grid deleted');
                                }
                                this.onProjectSelected(combobox.getSelectedRecord());
                            },
                            scope: this
                        }
                    },
		    {
                    xtype: 'panel',
                    title: 'Test Sets',
                    itemId: 'childPanel1'
		    },
		    {
                    xtype: 'panel',
                    title: 'Test Cases',
		    width: 600,
                    itemId: 'childPanel2'
		    }
                ],
            });
            this.add(panel);
        },
        
        onProjectSelected:function(record){
            var project = record.data['_ref'];
            console.log('project', project);
            var testSetStore = Ext.create('Rally.data.WsapiDataStore', {
		model: 'TestSet',
		fetch: ['FormattedID','Name', 'Project', 'TestCaseStatus', 'TestCases'],
		pageSize: 100,
		autoLoad: true,
		filters: [
		    {
			property: 'Project',
			value: project
		    }
		    ],
		listeners: {
		    load: this.onTestSetsLoaded,
		    scope: this
		}
	    }); 
            
           
        },
	
	onTestSetsLoaded:function(store, data){
                var testSets = [];
                Ext.Array.each(data, function(testset) {
                    var ts  = {
                        FormattedID: testset.get('FormattedID'),
                        _ref: testset.get('_ref'),  
                        Name: testset.get('Name'),
			TestCaseCount: testset.get('TestCases').Count,
			TestCaseStatus: testset.get('TestCaseStatus')
                    };
                    testSets.push(ts);
                 });
                this.updateGrid(testSets);
	    
	},
        
        
        updateGrid: function(testSets){
	    
	    if (this.down('#g2')) {
		    console.log('g2 exists');
		    var store = this.down('#g2').getStore();
		    store.removeAll();
	    }
	    
	  
	    var store = Ext.create('Rally.data.custom.Store', {
                data: testSets,
                pageSize: 100
            });
	    if (!this.down('#g')) {
   		this.createGrid(store);
	    }
	    else{
   		this.down('#g').reconfigure(store);
	    }

	},
	
        createGrid: function(store){
	    
	    console.log("load grid", store);
	    var that = this;
	    var g = Ext.create('Rally.ui.grid.Grid', {
		    id: 'g',
		    store: store
	    });
	    
	    
	    var g = Ext.create('Rally.ui.grid.Grid', {
		    id: 'g',
		    store: store,
		    
		    columnCfgs: [
		    {
		       text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
			tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
		    },
		    {
			text: 'Name', dataIndex: 'Name'
		    },
		    {
                    text: 'Test Case Count', dataIndex: 'TestCaseCount',
                    },
		    {
			text: 'TestCaseStatus', dataIndex: 'TestCaseStatus'
		    }
		    ],
		    listeners: {
			    celldblclick: function( grid, td, cellIndex, record, tr, rowIndex){
				var id = grid.getStore().getAt(rowIndex).get('FormattedID');
				console.log('id', id);
				that.getTestCases(id);     
			    }
		    }
	    });
	    this.down('#childPanel1').add(g);
	},
	getTestCases:function(id){
	    var selectedTestSetStore = Ext.create('Rally.data.WsapiDataStore', {
		model: 'TestSet',
		fetch: ['FormattedID','Name', 'TestCases'],
		pageSize: 100,
		autoLoad: true,
		filters: [
		    {
			property: 'FormattedID',
			operator: '=',
			value: id
		    }
		    ],
		listeners: {
		    load: this.onSelectedTestSetLoaded,
		    scope: this
		}
        }); 
	},
	
	onSelectedTestSetLoaded:function(store, data){
	    console.log('store',store);
	    console.log('data',data);
	    
	    var selectedTestSets = [];
	    var pendingTestCases = data.length;
	    
	     if (data.length ===0) {
		this.createTestSetGrid(selectedTestSets);  
	     }
	     
	     Ext.Array.each(data, function(selectedTestset){ 
		var ts  = {
		    FormattedID: selectedTestset.get('FormattedID'),
		    TestCaseCount: selectedTestset.get('TestCases').Count,
		    TestCases: [],
		    ResultCount: 0 
		};
		var testCases = selectedTestset.getCollection('TestCases', {fetch: ['FormattedID','ObjectID', 'Results']});
		console.log('testCases:', selectedTestset.get('TestCases').Count, testCases); 
		testCases.load({
				    callback: function(records, operation, success){
					Ext.Array.each(records, function(testcase){
					    console.log("testcase.get('FormattedID')", testcase.get('FormattedID'));  
					    console.log("testcase.get('Results').Count", testcase.get('Results').Count); 
					    ts.ResultCount = testcase.get('Results').Count; 
					    console.log('ts.ResultCount', ts.ResultCount);
					    ts.TestCases.push({_ref: testcase.get('_ref'),
							        FormattedID: testcase.get('FormattedID'),
								ObjectID: testcase.get('ObjectID')
							});
					}, this); 
					--pendingTestCases;
					if (pendingTestCases === 0) {
					    this.makeTestCaseStore(ts.TestCases);
					    
					}
				    },
				    scope: this
				});
		console.log('ts', ts);
		selectedTestSets.push(ts);
	    },this);
	},
	
	makeTestCaseStore:function(testcases){
	    console.log('makeTestCaseStore'); //ok
	    if (testcases.length>0) {
		var idArray = [];
		_.each(testcases, function(testcase){
		    console.log(testcase);
		    console.log('OID', testcase['ObjectID']);
		    idArray.push(testcase['ObjectID']);
		    });
		console.log('idArray',idArray);
		
		var filterArray = [];
		_.each(idArray, function(id){
		    filterArray.push(
			{
			property: 'ObjectID',
			value:id
			}
		    )
		});
		console.log('filterArray', filterArray); //ok
		
		 var filters = Ext.create('Rally.data.QueryFilter', filterArray[0]);
		 
		 filterArray = _.rest(filterArray,1);  
		 
		 _.each(filterArray, function(filter){
		    filters = filters.or(filter)
			},1);
		var testCaseStore = Ext.create('Rally.data.WsapiDataStore', {
		    model: 'TestCase',
		    fetch: ['FormattedID','Name', 'ObjectID', 'Results'],
		    pageSize: 100,
		    autoLoad: true,
		    filters: [filters],
		    listeners: {
			load: this.onTestCasesLoaded,
			scope: this
		    }
		});
	    }
	    else{
		if (this.down('#g2')) {
		    var store = this.down('#g2').getStore();
		    store.removeAll();
		    }
		}
	},
	
	
	onTestCasesLoaded:function(store,data){
	    console.log('onTestCasesLoaded');
	    console.log('store',store);
	    console.log('data',data);
	    var testCases = [];
	    var pendingResults = data.length;
	    Ext.Array.each(data, function(testcase) {
                    var tc  = {
                        FormattedID: testcase.get('FormattedID'),
                        _ref: testcase.get('_ref'),  
                        Name: testcase.get('Name'),
			ResultsCount: testcase.get('Results').Count,
			Results: []
                    };
		    var results = testcase.getCollection('Results');
		    results.load({
			fetch: ['Verdict','Date','Build'],
			callback: function(records, operation, success){
			    Ext.Array.each(records, function(result){
				tc.Results.push({_ref: result.get('_ref'),
                                                 Verdict: result.get('Verdict'),
						 Date: result.get('Date'),
						 Build: result.get('Build'),
                                });
			    },this);
			    --pendingResults;
			     if (pendingResults === 0) {
                                        this.updateGrid2(testCases);
                                    }
			},
			scope:this
			});
		        testCases.push(tc);
			
                  }, this);  
	},
	
	 updateGrid2: function(testCases){
	    console.log(testCases);
	     var store = Ext.create('Rally.data.custom.Store', {
                data: testCases,
                pageSize: 100
            });
	    if (!this.down('#g2')) {
   		this.createGrid2(store);
	    }
	    else{
   		this.down('#g2').reconfigure(store);
	    }
	 },
	 
	 createGrid2: function(store){
	    console.log("load grid", store);
	    var that = this;
	    
	    
	    
	    var g2 = Ext.create('Rally.ui.grid.Grid', {
		    id: 'g2',
		    store: store,
		    
		    columnCfgs: [
		    {
		       text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
			tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
		    },
		    {
			text: 'Name', dataIndex: 'Name',
		    },
		    {
			text: 'Results Count', dataIndex: 'ResultsCount',
                    },
		    {
                    text: 'Results', dataIndex: 'Results', flex:1,
                    renderer: function(value) {
                        var html = [];
                        Ext.Array.each(value, function(result){
                            html.push('<b>Verdict:</b> ' + result.Verdict + '<br />' + '<b>Date:</b> ' +  Rally.util.DateTime.toIsoString(result.Date,true) + '<br />' + '<b>Build</b> ' + result.Build + '<br />')
                        });
                        return html.join('<br /><br />');
			}
		    }
		    ]
	    });
	    this.down('#childPanel2').add(g2);
	 }
});