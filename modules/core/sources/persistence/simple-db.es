/*
 * This module will provide an interface for saving / loading persistent data.
 *
 */

import console from '../console';

export default class SimpleDB {
  //
  // @brief constructor
  // @param db  the database instance to use (pouchdb)
  //
  constructor(db, logger = console, contID = 'docData') {
    this.db = db;
    this.contID = contID;
    this.logger = logger;
  }

  upsert(docID, docData) {
    return this.db.get(docID)
      .catch(() => ({ _id: docID, [this.contID]: {} }))
      .then(
        data => this.db.put({
          ...data,
          [this.contID]: {
            ...data.docData,
            ...docData,
          },
        })
      );
  }

  get(docID) {
    return this.db.get(docID)
      .then(doc => doc[this.contID])
      .catch((err) => {
        if (err && err.status && err.status !== 404) {
          this.logger.error(`getDocData: error getting doc ${docID} with err: `, err);
        } else {
          this.logger.log(`missing DB entry for docID ${docID}`);
        }
        return null;
      });
  }

  remove(docID) {
    // https://pouchdb.com/api.html#delete_document
    return this.db.get(docID).then((doc) => {
      this.logger.log(`removeDocData: removing doc ${docID}`);
      return this.db.remove(doc);
    }).then(() => {
      // nothing to do
      this.logger.log(`removeDocData: doc ${docID} removed properly`);
    }).catch((err) => {
      // nothing to do there
      if (err && err.status && err.status !== 404) {
        this.logger.error(`removeDocData: something happened removing the doc: ${docID} - err:`, err);
      } else {
        this.logger.log(`missing DB entry for docID ${docID}`);
      }
    });
  }
}
