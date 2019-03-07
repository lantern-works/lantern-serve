const EventEmitter = require('event-emitter-es6')

module.exports = class Package extends EventEmitter {
    constructor (name, db) {
        super()

        if (!name) {
            console.error(`${this.logPrefix} please name your package to publish`)
            throw new Error('missing_name')
        }

        if (!db || db.constructor.name !== 'Database') {
            return console.error('Package requires database to construct')
        }

        this.version = '0.0.1' // default version

        if (name.indexOf('@') !== -1) {
            let parts = name.split('@')
            name = parts[0]
            this.version = parts[1]
        }

        this._data = {
            'name': name,
            'public': true, // only supporting public packages, for now
            'data': {},
            'version': this.version,
            'seq': 0
        }
        this._data.data[this.version] = {
        }
        this.db = db
        this.node = this.db.get('pkg').get(this.name)
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[p:${this.name || 'new package'}@${this.version}]`.padEnd(20, ' ')
    }

    get name () {
        return this._data.name
    }

    set name (val) {
        this._data.name = val
    }

    get id () {
        return this._data.name + '@' + this.version
    }

    get seq() {
        return this._data.seq
    }
    set seq(val) {
        return this._data.seq = val
    }

    seqUp() {
        this.node.get('seq').once(v => {
            this.seq = v+1
        }).put(this.seq) 
    }

    // -------------------------------------------------------------------------
    /**
    * Publish a new data package to the network
    *
    * Attempts a non-destructive put in case other peers have also published
    */
    publish () {
        return this.db.getOrPut(this.node, this._data)
            .then(saved => {
                if (saved) {
                    this.emit('publish')
                    console.log(`${this.logPrefix} published version: ${this.id}`)
                } else {
                    console.log(`${this.logPrefix} already published version: ${this.id}`)
                }
            })
            .catch((e) => {
                console.error(`${this.logPrefix} failed to publish version: ${this.id}`)
            })
    }

    /*
    * Unpublish removes a data package from the network
    */
    unpublish () {
        return new Promise((resolve, reject) => {
            this.node.get('data').get(this.version || this.version)
                .put(null, (v, k) => {
                    this.emit('unpublish')
                    return resolve()
                })
        })
    }


    // -------------------------------------------------------------------------

    getCurrentVersion() {
        return this.node.get('data').get(this.version)
    }

    /*
    * Gets a specific item in the current version of this package
    */
    getOneItem(id) {
        return this.node.get('data').get(this.version).get(id)
    }

    /**
    * Gets a list of all items in the current version of this package
    */
    getAllItems () {
        return new Promise((resolve, reject) => {
            this.node.get('data').get(this.version).once((v, k) => {
                let itemList = []
                Object.keys(v).forEach((item) => {
                    if (item !== '_') {
                        itemList.push(item)
                    }
                })
                resolve(itemList)
            })
        })
    }
}
