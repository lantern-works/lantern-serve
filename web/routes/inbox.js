"use strict"

const bodyParser = require("body-parser");
const util = require("../util");
const log = util.Logger;

module.exports = (serv) => {
   
    const msg_apply = {};

    /**
    * Add a node to the database
    */
    msg_apply.add = (data, db) => {
        return new Promise((resolve, reject) => {
            let node = getNode(data, db);
            node.once((v,k) => {
                if (v) {
                    // item already exists, do not try adding again...
                    return resolve(false);
                }
                node.put({}, (ack) => {
                    if (ack.err) {
                        return reject("inbox_add_failed");
                    }
                    resolve(true);
                });
            });
        });
    };

    /**
    * Update existing database field
    */
    msg_apply.update = (data, db) => {
        return new Promise((resolve, reject) => {
            let node = getNode(data, db);

            node.once((v,k) => {
                if (v == undefined) {
                    reject("inbox_update_failed_missing_item");
                }
                else {
                    node
                        .get(data.field_key)
                        .put(data.field_value, (ack) => {
                            if (ack.err) {
                                return reject("inbox_update_failed");
                            }
                            resolve(true);
                        });
                }
            })
        });
    }

    /**
    * Drop a node from database
    */
    msg_apply.drop = (data, db) => {
        return new Promise((resolve, reject) => {
            let node = getNode(data, db);
            node.put(null, (ack) => {
                if (ack.err) {
                    return reject("inbox_drop_failed");
                }                   
                resolve(true);
            });
        });
    }

    /**
    * Regular expressions to identify intent of message
    */
    const msg_regex = {
        add: /([0-9]+)\|([a-z]+)@([0-9\.]+)\+([a-zA-Z0-9]+)/,
        update: /([0-9]+)\|([a-z]+)@([0-9\.]+)\^([a-zA-Z0-9]+)\.([a-z]*)\=(\w+)/,
        drop: /([0-9]+)\|([a-z]+)@([0-9\.]+)\-([a-zA-Z0-9]+)/
    }

    /**
    * Convert regular expression match to key/value pairs
    */
    const getObject = (matches) => {
        let obj = {};
        let keys = {
            0: "message",
            1: "seq",
            2: "package_name",
            3: "package_version",
            4: "item_id",
            5: "field_key",
            6: "field_value"
        }
        for (var idx in matches) {
            if (keys[idx]) {
                obj[keys[idx]] = matches[idx];
            }
        }
        return obj;
    }

    /**
    * Retrieve the working node for this message
    */
    const getNode = (data, db) => {
        // in some cases package may be unknown to this device
        // receive and store data, anyway... just to be safe...
        return db.get("__LX__")
            .get("pkg")
            .get(data.package_name)
            .get("data")
            .get(data.package_version)
            .get(data.item_id);
    }

    

    //---------------------------------------------------------------------- 

    /**
    * List inbox messages received
    */
    serv.get("/api/inbox", (req, res) => {

        let messages = [];
        Object.keys(res.app.locals.inbox).forEach(key => {
            messages.push(key);
        });
        res.status(200).json({
            "messages": messages
        });
    })

    /**
    * Accept messages to convert into database updates
    */
    serv.post("/api/inbox", bodyParser.json(), (req, res) => {
        if (!req.body.message) {
            return res.status(403).json({
                "ok": false, 
                "message": "Ignoring empty message"
            });
        }
        else {
            let msg = req.body.message;

            if (typeof(msg) != "string") {
                throw new Error("Message is not a string");
            }

            let matched = false;
            Object.keys(msg_regex).forEach((k) => {
                let exp = msg_regex[k];

                if (exp.test(msg)) {


                    // log the received messaged for future output
                    // also allows us to prevent infinite loops (don't trigger change hooks on incoming messages)
                    let msg_key = util.getSimpleMessage(msg);
                    res.app.locals.inbox[msg_key] =  res.app.locals.inbox[msg_key]  || {};
                    res.app.locals.inbox[msg_key][new Date().getTime()] = req.ip;

                    log.debug("  inbox -- " + (msg[1] == "|" ? " " : "") + msg);

                    msg_apply[k](getObject(msg.match(exp)), req.app.locals.db)
                        .then((success) => {
                            res.status(200).json({"ok": success});
                        })
                        .catch((e) => {
                            res.status(200).json({"ok": false, "err": e}) 
                        });
                    matched = true;
                }
            });

            if (!matched) {
                return res.status(403).json({
                    "ok": false,
                    "message": "Ignoring invalid message"
                });
            }
        }
    }); 
};
