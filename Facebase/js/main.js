
define([
           'dojo/_base/declare',
           'dojo/_base/lang',
           'dojo/_base/xhr',
           'dojo/_base/array',
           'dojo/Deferred',
           'dojo/dom-construct',
           'JBrowse/Plugin',
           'JBrowse/View/FileDialog/TrackList/BigWigDriver',
           'JBrowse/View/FileDialog/TrackList',
           'JBrowse/Util'
       ],
       function(
           declare,
           lang,
           xhr,
           array,
           Deferred,
           Dom,    
           JBrowsePlugin,
           BigWigDriver,
           TrackList, 
           Util
       ) {
return declare( JBrowsePlugin,
{
    constructor: function( args ) {
	
        console.log( "plugin : FaceBase Plugin");
        
        var thisB = this;
	
        this.browser.afterMilestone( 'completely initialized', function() {
            var ermrest_datasets = "/ermrest/catalog/1/attribute/D:=dataset/"
            var track_query = "/track_data/RID:=D:RID,title:=D:title,filename:=filename,url:=url";

            var fb = thisB._getUrlParam("dataset");
            var track_type = thisB._getUrlParam("type");
        
            if (fb != null) {
                var url = ermrest_datasets;
                var accession_numbers = fb.split(",");
              
                console.log("Getting FB accession: " + accession_numbers);
                
                for (var i = 0; i < accession_numbers.length; i++){
                    url += "RID=" + accession_numbers[i] + ";";
                }
                url = url.substring(0, url.length - 1);
                url += track_query;

                var configCallback = function(results){
                    console.log("Found " + results.length + " results");
		    var resource_list = [];
                    for (var i = 0; i < results.length; i++) {
                         resource_list[i] = {url: results[i]['url'], type: "bigwig", label: results[i]['filename']};
		    }
                
		
		    var trackListControl = thisB._makeTrackListControl();
                
	            // Once the resource list is built, this list is fed to the update function
                    // along with the browser's current tracklist and the type of tracks the user desires (density or xyplot). 
                    thisB.update(resource_list, trackListControl, track_type);
                    var openCallb = {trackConfs: thisB.getTrackConfigurations(trackListControl)};
                    // Once the track and store configurations are built, the openFiles  
                    // function calls the track list, publishes them and displays them in
                    // the browser.
                    thisB.openFiles(openCallb);   
                }
            
                console.log("URL: " + url);
                var xhrArgs = {
                    url: url,
                    handleAs: "json",
                    preventCache : false,
                    error: function(response, ioArgs){
                        console.error(response);
                        console.error(response.stack);
                    }
                };
                var deferred = dojo.xhrGet(xhrArgs);
                deferred.then(configCallback);
            }
	});
    },
    
    /* Function that accesses the user's URL Parameters.
    */
    _getUrlParam: function( name, url ) {
      if (!url) url = window.location.href
      name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
      var regexS = "[\\?&]"+name+"=([^&#]*)";
      var regex = new RegExp( regexS );
      var results = regex.exec( url );
      return results == null ? null : decodeURIComponent(results[1]);
    },
    
    /* Function that accesses the browser's running track list.
    */

    _makeTrackListControl: function() {
        var tl = new TrackList({ browser: this.browser, fileDialog: null});
        this.trackList = tl;
	console.log(tl);
        return tl;
    },
    
    /* The update function creates the store configurations and track configurations for each       
       bigwig file. 
    */
    update: function (resources, trackList, t_type) {
        trackList.storeConfs = {};
        trackList.trackConfs = {};
        this._makeStoreConfs(resources, trackList);
        this._makeTrackConfs(trackList, t_type);

    },
    
    /* Using the BigWig driver module, this function creates the store configurations
       for all the bigwig files from the desired database.
    */
    _makeStoreConfs: function(resources, tl) {
        tl.storeConfs = tl.storeConfs || {};
        //tl.storeConfs = {};
        var bw_driver = new BigWigDriver();
        
        // anneal the given resources into a set of data store
        // configurations by offering each file to each type driver in
        // turn until no more are being accepted
        var lastLength = 0;
        while( resources.length && resources.length != lastLength ) {
            resources = array.filter( resources, function( resource ) {
                //store configuration created here
                return bw_driver.tryResource( tl.storeConfs, resource );
            },this);
            lastLength = resources.length;
        }
        
        array.forEach( bw_driver, function( typeDriver ) {
           bw_driver.finalizeConfiguration( tl.storeConfs );
            //try to merge any singleton BAM and BAI stores
        },this);

        if( resources.length )
            console.warn( "Not all resources could be assigned to tracks.  Unused resources:", resources );
    },
    
    /* Using the store configurations, this function creates the track configurations
       for all the bigwig files from the desired database.
    */
     _makeTrackConfs: function(tl, t_type) {
         var typeMap;
         //constructs the track based on user's preferences for type
        if (t_type == 'density')
            typeMap = 'JBrowse/View/Track/Wiggle/Density';
         else 
            typeMap = 'JBrowse/View/Track/Wiggle/XYPlot';
        
        // find any store configurations that appear to be coverage stores
        var coverageStores = {};
        for( var n in tl.storeConfs ) {
            if( tl.storeConfs[n].fileBasename ) {
                var baseBase = tl.storeConfs[n].fileBasename.replace(/\.(coverage|density|histograms?)$/,'');
                if( baseBase != tl.storeConfs[n].fileBasename ) {
                    coverageStores[baseBase] = { store: tl.storeConfs[n], name: n, used: false };
                }
            }
        }

        // make track configurations for each store configuration
        for( var n in tl.storeConfs ) {
            var store = tl.storeConfs[n];
            var trackType = typeMap;   
            tl.trackConfs = tl.trackConfs || {};

            tl.trackConfs[ n ] =  {
                store: tl.storeConfs[n],
                label: n,
                key: n.replace(/_\d+$/,'').replace(/_/g,' '),
                type: trackType,
                category: "Quantitative Tracks",
                autoscale: "local" // make locally-opened BigWig tracks default to local autoscaling
            };
            

            // if we appear to have a coverage store for this one, use it
            // and mark it to have its track removed after all the tracks are made
            var cov = coverageStores[ store.fileBasename ];
            if( cov ) {
                tl.trackConfs[n].histograms = {
                    store: cov.store,
                    description: cov.store.fileBasename
                };
                cov.used = true;
            }
        }

        // delete the separate track confs for any of the stores that were
        // incorporated into other tracks as histograms
        for( var n in coverageStores ) {
            if( coverageStores[n].used )
                delete tl.trackConfs[ coverageStores[n].name ];
        }
    },
    
    /* Function that returns the track configurations from the browser's track list
    */
    getTrackConfigurations: function(tl){
        return Util.dojof.values( tl.trackConfs || {});
    },
    
    /* Function which publishes the new tracks and displays them for the user
    */
    openFiles: function(openCallback){
        var confs = openCallback.trackConfs || [];
        console.log("Length: " + confs.length);        
         if( confs.length ) {
                    // tuck away each of the store configurations in
                    // our store configuration, and replace them with
                    // their names.
                    array.forEach( confs, function( conf ) {
                        // do it for conf.store
                        var storeConf = conf.store;
                        if( storeConf && typeof storeConf == 'object' ) {
                            delete conf.store;
                            var name = this.browser.addStoreConfig( storeConf.name, storeConf );
                            conf.store = name;
                        }

                        // do it for conf.histograms.store, if it exists
                        storeConf = conf.histograms && conf.histograms.store;
                        if( storeConf && typeof storeConf == 'object' ) {
                            delete conf.histograms.store;
                            var name = this.browser.addStoreConfig( storeConf.name, storeConf );
                            conf.histograms.store = name;
                        }
                    },this);

                    // publish the desired tracks
                    this.browser.publish( '/jbrowse/v1/v/tracks/new', confs );
                    // display the desired tracks
                    this.browser.publish( '/jbrowse/v1/v/tracks/show', confs );
                }
        }
    });
});
