const EventEmitter = require('event-emitter-es6')

module.exports = class LXOrganization extends EventEmitter {
    constructor (id, name, db) {
        super()
        if (!id) {
            return console.error('[Organization] requires id to construct')
        }

        if (!name) {
            return console.error(`[Organiation] please name your organization`)
        }

        if (!db) {
            return console.error('[Organization] requires database to construct')
        }
        this.id = id
        this.name = name
        this.db = db
        this.node = this.db.get('org').get(this.id)
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[o:${this.id || 'Organization'}]`.padEnd(20, ' ')
    }

    // -------------------------------------------------------------------------

    /**
    * Publish a new data package to the network
    */
    register () {
        return new Promise((resolve, reject) => {
            this.node.once((v, k) => {
                if (v) {
                    console.log(`${this.logPrefix} already registered organization`)
                    return resolve(v)
                } else {
                    // this node may contain fields for "members" and "packages", too
                    console.log(`${this.logPrefix} starting registration for organization`)
                    this.node.put({
                        'name': this.name,
                        'members': {},
                        'packages': {}
                    }, (ack) => {
                        if (ack.err) {
                            return reject(new Error('org_register_failed'))
                        }
                        console.info(`${this.logPrefix} newly registered`, this.name)
                        this.emit('register')
                        resolve(this.name)
                    })
                }
            })
        })
    }

    unregister () {
        return new Promise((resolve, reject) => {
            this.node
                .put(null)
                .once((v, k) => {
                    console.log(`${this.logPrefix} unregistered ${this.id}`)
                    this.emit('unregister')
                    return resolve(v)
                })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Claim ownership over package
    */
    claim (pkg) {
        return new Promise((resolve, reject) => {
            // first, link organization into package
            let node1 = pkg.node.get('organization')
            let node2 = this.node.get('packages')
                .get(pkg.name)
            node1.once((v, k) => {
                if (!v) {
                    node1.put(this.node)
                        .once(() => {
                            console.log(`${this.logPrefix} claimed ${pkg.id}`)
                            // now, organization registers existence of package
                            node2.put(pkg.node).once(resolve)
                        })
                } else {
                    console.log(`${this.logPrefix} already claimed ${pkg.id}`)
                }
            })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Add member user to the organization
    */
    addOneMember (user) {
        return new Promise((resolve, reject) => {
            this.node.get('members')
                .set(user)
                .once(resolve)
        })
    }

    /**
    * Remove member user from the organization
    */
    removeOneMember (user) {
        return new Promise((resolve, reject) => {
            this.node.get('members')
                .unset(user)
                .once(resolve)
        })
    }
}
