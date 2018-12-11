"use strict";

/***
* PRESENTATION LAYER
*
* Load in view logic and MVVM
*/

const LX = window.LX || {}; if (!window.LX) window.LX = LX;
const LV = window.LV || {}; if (!window.LV) window.LV = LV;

LV.Vue = require("vue");
LV.Wheelnav = require("wheelnav");
const PouchDB = LV.PouchDB;



//----------------------------------------------------------------------------
LX.View = class View extends LV.EventEmitter {

    constructor() {
        super();
        // setup vue object
        LV.Vue.filter('pluralize', (word, amount) => amount != 1 ? `${word}s` : word)
        this.vue = new LV.Vue({
            el: '#app-container',
            data: {
                app_components: [],
                user: {
                    username: null
                },
                map: false
            }
        });
        this.data = this.vue.$data;
        this.menu = new LX.PieMenu();
    }
}



//----------------------------------------------------------------------------
LX.PieMenu = class PieMenu extends LV.EventEmitter {

    constructor() {
        super();
        this._locked = false;
        this.wheel = null;
        this.element = document.getElementById("pie-menu");
        this.mask_element = document.getElementById("pie-menu-mask");
        this.mask_element.onclick = () => {
            this.close();
        };
    }    

    /**
    * Display menu on canvas on top of a mask
    */
    open(items, pos) {
        if (!items || !items.length) {
            return console.log("[PieMenu] Refusing to show menu with zero items");
        }

        if (this._locked) {
            return console.log("[PieMenu] Refusing to open while menu is in locked state");
        }


        // create icons for menu
        let final_items = [];

        items.forEach((item) => {
            if (item.icon) {
                let icon = "imgsrc:/_/@fortawesome/fontawesome-free/svgs/solid/" + item.icon + ".svg";
                final_items.push(icon);                
            }
            else if (item.label) {
                final_items.push(item.label);
            }
        });

        // create wheel menu
        this.wheel = new wheelnav("pie-menu");
        this.wheel.titleWidth = 22;
        this.wheel.navAngle = 30;
        this.wheel.wheelRadius = 100;
        this.wheel.selectedNavItemIndex = null;;
        this.wheel.createWheel(final_items);

        // define custom methods to handle menu selection
        this.wheel.navItems.forEach((item) => {
        
            item.navigateFunction = () => {
                let matched_item = items[item.itemIndex];

                let event_data = null;
                if(matched_item.method) {
                    event_data = matched_item.method();
                }
                if (matched_item.event) {
                    this.emit(matched_item.event, event_data);
                }
                this.close.call(this);
            }
        });

        // create mask for behind the menu
        this.mask_element.classList = "active";

        // set x/y location for pie menu
        if(pos.x && pos.y) {
            let svg = this.element.childNodes[0];
            let width = svg.width.baseVal.valueAsString;
            let height = svg.height.baseVal.valueAsString;
            this.element.style.left = (pos.x - width/2)+"px";
            this.element.style.top = (pos.y - height/2)+"px";
        }

        this.element.classList = "active";
        this.emit("open");
    }
    
    /**
    * Hide menu from canvas and remove mask
    */
    close() {
        this.element.classList.remove("active")
        this.mask_element.classList.remove("active");
        this.emit("close");
        // prevent accidental duplicate opens
        this.lock();
        setTimeout(() => {
            this.unlock();
        }, 100);
    }


    lock() {
        this._locked = true;
    }

    unlock() {
        this._locked = false;
    }

    isLocked() {
        return this._locked;
    }
}



//----------------------------------------------------------------------------
/*
Copyright (c) 2015 Iván Sánchez Ortega <ivan@mazemap.no>


Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// https://github.com/nikolauskrismer/Leaflet.TileLayer.PouchDBCached/blob/master/L.TileLayer.PouchDBCached.js

L.TileLayer.addInitHook(function() {

    if (!this.options.useCache) {
        this._db     = null;
        this._canvas = null;
        return;
    }

    var dbName = this.options.dbName || 'offline-tiles';
    if (this.options.dbOptions) {
        this._db = new PouchDB(dbName, this.options.dbOptions);
    } else {
        this._db = new PouchDB(dbName);
    }
    this._canvas = document.createElement('canvas');

    if (!(this._canvas.getContext && this._canvas.getContext('2d'))) {
        // HTML5 canvas is needed to pack the tiles as base64 data. If
        //   the browser doesn't support canvas, the code will forcefully
        //   skip caching the tiles.
        this._canvas = null;
    }
});

// 🍂namespace TileLayer
// 🍂section PouchDB tile caching options
// 🍂option useCache: Boolean = false
// Whether to use a PouchDB cache on this tile layer, or not
L.TileLayer.prototype.options.useCache     = false;

// 🍂option saveToCache: Boolean = true
// When caching is enabled, whether to save new tiles to the cache or not
L.TileLayer.prototype.options.saveToCache  = true;

// 🍂option useOnlyCache: Boolean = false
// When caching is enabled, whether to request new tiles from the network or not
L.TileLayer.prototype.options.useOnlyCache = false;

// 🍂option useCache: String = 'image/png'
// The image format to be used when saving the tile images in the cache
L.TileLayer.prototype.options.cacheFormat = 'image/png';

// 🍂option cacheMaxAge: Number = 24*3600*1000
// Maximum age of the cache, in milliseconds
L.TileLayer.prototype.options.cacheMaxAge  = 24*3600*1000;


L.TileLayer.include({

    // Overwrites L.TileLayer.prototype.createTile
    createTile: function(coords, done) {
        var tile = document.createElement('img');

        tile.onerror = L.bind(this._tileOnError, this, done, tile);

        if (this.options.crossOrigin) {
            tile.crossOrigin = '';
        }

        /*
         Alt tag is *set to empty string to keep screen readers from reading URL and for compliance reasons
         http://www.w3.org/TR/WCAG20-TECHS/H67
         */
        tile.alt = '';

        var tileUrl = this.getTileUrl(coords);

        if (this.options.useCache && this._canvas) {
            this._db.get(tileUrl, {revs_info: true}, this._onCacheLookup(tile, tileUrl, done));
        } else {
            // Fall back to standard behaviour
            tile.onload = L.bind(this._tileOnLoad, this, done, tile);
        }

        tile.src = tileUrl;
        return tile;
    },

    // Returns a callback (closure over tile/key/originalSrc) to be run when the DB
    //   backend is finished with a fetch operation.
    _onCacheLookup: function(tile, tileUrl, done) {
        return function(err, data) {
            if (data) {
                this.fire('tilecachehit', {
                    tile: tile,
                    url: tileUrl
                });
                if (Date.now() > data.timestamp + this.options.cacheMaxAge && !this.options.useOnlyCache) {
                    // Tile is too old, try to refresh it
                    //console.log('Tile is too old: ', tileUrl);

                    if (this.options.saveToCache) {
                        tile.onload = L.bind(this._saveTile, this, tile, tileUrl, data._revs_info[0].rev, done);
                    }
                    tile.crossOrigin = 'Anonymous';
                    tile.src = tileUrl;
                    tile.onerror = function(ev) {
                        // If the tile is too old but couldn't be fetched from the network,
                        //   serve the one still in cache.
                        this.src = data.dataUrl;
                    }
                } else {
                    // Serve tile from cached data
                    //console.log('Tile is cached: ', tileUrl);
                    tile.onload = L.bind(this._tileOnLoad, this, done, tile);
                    tile.src = data.dataUrl;    // data.dataUrl is already a base64-encoded PNG image.
                }
            } else {
                this.fire('tilecachemiss', {
                    tile: tile,
                    url: tileUrl
                });
                if (this.options.useOnlyCache) {
                    // Offline, not cached
//                  console.log('Tile not in cache', tileUrl);
                    tile.onload = L.Util.falseFn;
                    tile.src = L.Util.emptyImageUrl;
                } else {
                    //Online, not cached, request the tile normally
//                  console.log('Requesting tile normally', tileUrl);
                    if (this.options.saveToCache) {
                        tile.onload = L.bind(this._saveTile, this, tile, tileUrl, null, done);
                    } else {
                        tile.onload = L.bind(this._tileOnLoad, this, done, tile);
                    }
                    tile.crossOrigin = 'Anonymous';
                    tile.src = tileUrl;
                }
            }
        }.bind(this);
    },

    // Returns an event handler (closure over DB key), which runs
    //   when the tile (which is an <img>) is ready.
    // The handler will delete the document from pouchDB if an existing revision is passed.
    //   This will keep just the latest valid copy of the image in the cache.
    _saveTile: function(tile, tileUrl, existingRevision, done) {
        if (this._canvas === null) return;
        this._canvas.width  = tile.naturalWidth  || tile.width;
        this._canvas.height = tile.naturalHeight || tile.height;

        var context = this._canvas.getContext('2d');
        context.drawImage(tile, 0, 0);

        var dataUrl;
        try {
            dataUrl = this._canvas.toDataURL(this.options.cacheFormat);
        } catch(err) {
            this.fire('tilecacheerror', { tile: tile, error: err });
            return done();
        }

        var doc = {_id: tileUrl, dataUrl: dataUrl, timestamp: Date.now()};
        if (existingRevision) {
          this._db.get(tileUrl).then(function(doc) {
              return this._db.put({
                  _id: doc._id,
                  _rev: doc._rev,
                  dataUrl: dataUrl,
                  timestamp: Date.now()
              });
          }.bind(this)).then(function(response) {
            //console.log('_saveTile update: ', response);
          });
        } else {
          this._db.put(doc).then( function(doc) {
            //console.log('_saveTile insert: ', doc);
          });
        }

        if (done) {
          done();
        }
    },

    // 🍂section PouchDB tile caching options
    // 🍂method seed(bbox: LatLngBounds, minZoom: Number, maxZoom: Number): this
    // Starts seeding the cache given a bounding box and the minimum/maximum zoom levels
    // Use with care! This can spawn thousands of requests and flood tileservers!
    seed: function(bbox, minZoom, maxZoom) {
        if (!this.options.useCache) return;
        if (minZoom > maxZoom) return;
        if (!this._map) return;

        var queue = [];

        for (var z = minZoom; z<=maxZoom; z++) {

            var northEastPoint = this._map.project(bbox.getNorthEast(),z);
            var southWestPoint = this._map.project(bbox.getSouthWest(),z);

            // Calculate tile indexes as per L.TileLayer._update and
            //   L.TileLayer._addTilesFromCenterOut
            var tileSize = this.getTileSize();
            var tileBounds = L.bounds(
                L.point(Math.floor(northEastPoint.x / tileSize.x), Math.floor(northEastPoint.y / tileSize.y)),
                L.point(Math.floor(southWestPoint.x / tileSize.x), Math.floor(southWestPoint.y / tileSize.y)));

            for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
                for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
                    point = new L.Point(i, j);
                    point.z = z;
                    queue.push(this._getTileUrl(point));
                }
            }
        }

        var seedData = {
            bbox: bbox,
            minZoom: minZoom,
            maxZoom: maxZoom,
            queueLength: queue.length
        }
        this.fire('seedstart', seedData);
        var tile = this._createTile();
        tile._layer = this;
        this._seedOneTile(tile, queue, seedData);
        return this;
    },

    _createTile: function () {
        return new Image();
    },

    // Modified L.TileLayer.getTileUrl, this will use the zoom given by the parameter coords
    //  instead of the maps current zoomlevel.
    _getTileUrl: function (coords) {
        var zoom = coords.z;
        if (this.options.zoomReverse) {
            zoom = this.options.maxZoom - zoom;
        }
        zoom += this.options.zoomOffset;
        return L.Util.template(this._url, L.extend({
            r: this.options.detectRetina && L.Browser.retina && this.options.maxZoom > 0 ? '@2x' : '',
            s: this._getSubdomain(coords),
            x: coords.x,
            y: this.options.tms ? this._globalTileRange.max.y - coords.y : coords.y,
            z: this.options.maxNativeZoom ? Math.min(zoom, this.options.maxNativeZoom) : zoom
        }, this.options));
    },

    // Uses a defined tile to eat through one item in the queue and
    //   asynchronously recursively call itself when the tile has
    //   finished loading.
    _seedOneTile: function(tile, remaining, seedData) {
        if (!remaining.length) {
            this.fire('seedend', seedData);
            return;
        }
        this.fire('seedprogress', {
            bbox:    seedData.bbox,
            minZoom: seedData.minZoom,
            maxZoom: seedData.maxZoom,
            queueLength: seedData.queueLength,
            remainingLength: remaining.length
        });

        var url = remaining.pop();

        this._db.get(url, function(err, data) {
            if (!data) {
                tile.onload = function(e) {
                    this._saveTile(tile, url, null);
                    this._seedOneTile(tile, remaining, seedData);
                }.bind(this);
                tile.onerror = function(e) {
                    // Could not load tile, let's continue anyways.
                    this._seedOneTile(tile, remaining, seedData);
                }.bind(this);
                tile.crossOrigin = 'Anonymous';
                tile.src = url;
            } else {
                this._seedOneTile(tile, remaining, seedData);
            }
        }.bind(this));
    }
});



//----------------------------------------------------------------------------
// all required items are loaded in by now. time to start everything up...
window.LT = new LX.Director();