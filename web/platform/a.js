"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;
LX.Vendor = LX.Vendor || {};



//----------------------------------------------------------------------------
const EventEmitter = LX.Vendor.EventEmitter = require("event-emitter-es6");
const Vue = LX.Vendor.Vue = require("vue");


Array.prototype.getIndexForObjectWithKey = function(key, value) {
    for (var idx in this) {
        var item = this[idx];
        if (item.hasOwnProperty(key) && item[key] == value) {
           return idx;
        }
    }
}

Array.prototype.removeByValue = function(value) {
    for (var idx in this) {
        var item = this[idx];
        if (item == value) {
            return this.splice(idx,1);
        }
    }
}


//----------------------------------------------------------------------------
LX.Config = (() => {
    let self = {};

    self.leaflet_map = {
        zoomDelta: 1.5,
        wheelPxPerZoomLevel: 100,
        contextmenu: true,
        contextmenuWidth: 140,
    };
    
    self.leaflet_tiles = {
        attribution: false,
        dbName: "lx-tiles",
        minZoom: 4,
        maxZoom: 20,
        useCache:  true,
        useOnlyCache: false,
        cacheMaxAge: 365*24*3600*1000,
        crossOrigin: true
    };

    self.leaflet_locatecontrol = {
        returnToPreviousBounds: true,
        cacheLocation: true,
        showCompass: true,
        flyTo: false,
        setView: "untilPanOrZoom",
        position: "bottomright"
    }

    self.maptiler = {
        id: "ade1b05a-496f-40d1-ae23-5d5aeca37da2",
        key: "ZokpyarACItmA6NqGNhr",
        map: "streets"
    };

    self.fetch = {
        mode: "cors",
        cache: "no-cache",
        headers: {
           "Content-Type": "application/json; charset=utf-8"
        }
    };

    return self;
})();



//----------------------------------------------------------------------------
LX.App = class App extends EventEmitter {
    

    constructor(obj) {
        super();
        this.name = obj.name;
        this.tag = `[lx-app-${this.name}]`;
        this.css_id = `lx-app-${this.name}-css`;
        this.children = obj.children;
        this.pages = [];
        this.data = {};
        this.load(); 
    }



    createPageComponent(page_id, body, logic) {
        let cmp = {
            template: body
        };

        let component_id = ["lx", "app", this.name, page_id].join("-");

        let self = this;

        if (logic) {
             if (logic.data) {
                // keep multiple components in same app together with same data
                self.data = logic.data;
                cmp.data = function() {
                    return self.data;
                }
            }

            if (logic.computed) {
                cmp.computed = logic.computed;
            }
            if (logic.methods) {
                cmp.methods = logic.methods;
            }
        }


        let component = Vue.component(component_id, cmp);

        self.pages.push(
            {"id": page_id,
            "component_id": component_id,
            "component": component }
        );

        self.emit("load", component_id);

        if (logic.open) {
            self.open(component_id);
        }

    }

    /**
    * Displays Vue component on the screen
    */
    open(component_id) {
        this.emit("open", component_id);
    }

    /**
    * Hides Vue component but keeps style injection for other open components
    */
    close(component_id) {
        this.emit("close", component_id);
    }


    /**
    * Inject CSS into DOM, allowing apps to redefine global styles if needed
    */
    addCSS(css) {
        let head = document.getElementsByTagName('head')[0];
        let s = document.createElement('style');
        s.setAttribute('type', 'text/css');
        s.id = this.css_id
        if (s.styleSheet) {   // IE
            s.styleSheet.cssText = css;
        } else {                // the world
            s.appendChild(document.createTextNode(css));
        }
        head.appendChild(s);
    }
    
    removeCSS() {
        let s = document.getElementById(this.css_id);
        s.parentNode.removeChild(s);
    }

    /**
    * Load a single HTML page into DOM using Vue
    */
    loadOnePage(filename, page_id, logic) {
        fetch(filename)
            .then((result) => {
                return result.text();
            })
            .then((html) => {
                // rewrite src attribute to point to proper web directory
                let image_re = /(<img[\S\s]*?src=")([\S\s]*?)("[\S\s]*?>)/ig;
                return html.replace(image_re, "$1"+ `/apps/${this.name}/` + "$2$3");
            })
            .then((body) => {
                return this.createPageComponent(page_id, body, logic);
            });
    }

    /**
    * Load all HTML pages for app into DOM using Vue
    */
    loadAllPages(logic) {
        let files = {};
        this.children.forEach((child) => {
            // only load html pages
            if (child.extension != ".html") return;
            let filename = ["/apps", this.name, child.name].join("/");
            let page_id = child.name.split(".")[0];
            this.loadOnePage(filename, page_id, logic);
        });    
    }
    
    /**
    * Use fetch to retrieve any sort of file from app package
    */
    loadOneFile(name,json) {
        return new Promise((resolve, reject) => {
            let exists = false;

            this.children.forEach((child) => {
                if (child.name !=  name) return;
                exists = true;
            });   
            
            if (!exists) return resolve();

            let filename = ["/apps", this.name,  name].join("/");  
            return fetch(filename)
                .then((result) => {
                    if (result.status == 200) {
                        if (json) {
                            return result.json();
                        }
                        else {
                            return result.text();
                        }
                    }
                })
                .then((contents) => {
                    resolve(contents);
                })
                .catch((e) => {
                    console.warn(this.tag + " Could not load file for " + this.name + ": " + name, e);
                })
        });
    }

    load() {
        let logic = {};
        let accepted = ["data", "computed", "methods", "open"];
        this.loadOneFile("app.js")
            .then((result) => {
                result = eval(result);
                accepted.forEach((key) => {
                    if (result.hasOwnProperty(key)) {
                        logic[key] = result[key];
                    }
                });
            })
            .then(() => {
                return this.loadOneFile("app.css")
                    .then((css)  => {
                        if (css) {
                            this.addCSS(css);
                        }
                    });
            })
            .then(() => {
                this.loadAllPages(logic)
            });
    }

    /**
    * Removes all Vue components and related code and style injection
    */
    unload() {
        this.pages.forEach((page) => {
            this.close(page.component_id);
        });
        setTimeout(() => {
            // allows vue to clear DOM to avoid flashes of content
            this.removeCSS();
        }, 300);
    }


}



//----------------------------------------------------------------------------
LX.Director = (() => {

    let self = {
        apps: {},
        profile: null,
        vue: new Vue({
            el: '#app-container',
            data: {
                app_components: [],
                profile: {
                    address: null
                },
                map: {
                    mask: true,
                    marker_count: 0
                } 
            }
        })
    };



    //------------------------------------------------------------------------
    const createApp = (app_files) => {
        if (!app_files.children) {
            console.log("[Direct] Ignoring app directory with no children:", app_files.name);
            return;
        }
        let obj = new LX.App(app_files);
        self.apps[obj.name] = obj;
        obj.on("load", (component_id) => {
            console.log("[Direct] App loads component: ", component_id );
        });

        obj.on("open", (component_id) => {
            console.log("[Direct] App opens component:", component_id);
            self.vue.app_components.push(component_id);
        });

        obj.on("close", (component_id) => {
            console.log("[Direct] App closes component:", component_id);
            self.vue.app_components.removeByValue(component_id);
        });
    }



    //------------------------------------------------------------------------
    self.start = function() {
        console.log("[Direct] Start");

        // define atlas to manage map interface
        self.atlas = new LX.Atlas();

        // load in dynamic apps
        fetch("/api/apps")
            .then((result) => {
                return result.json()
            })
            .then((json) => {
                json.forEach(createApp);
            });

        // get or create a unique profile for this user / device
        self.profile = new LX.Profile();
        self.profile.on("load", () => {
            self.vue.profile.address = self.profile.address;
        });


        self.atlas.on("marker-add", () => {
            this.vue.map.marker_count = self.atlas.getMarkerCount();
        })

    }


    //------------------------------------------------------------------------
    self.closeOneApp = function(app_id) {
        if (this.apps.hasOwnProperty(app_id)) {
            this.apps[app_id].unload();
        }
    }
    
    self.openOneApp = function(app_id) {
        if (this.apps.hasOwnProperty(app_id)) {
            this.apps[app_id].pages.forEach((page) => {
                self.apps[app_id].open(`lx-app-${app_id}-${page.id}`);
            });
        }
    }

    return self;
})();
