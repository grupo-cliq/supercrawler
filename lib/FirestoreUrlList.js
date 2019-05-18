var FirestoreUrlList,
    Promise = require("bluebird"),
    Url = require("./Url"),
    crypto = require("crypto"),
    YEAR_MS = 31536000000,
    collection = 'url',
    firestore;


/**
 * A database backed queue that features retry logic. Generates URLs that:
 * (a) has not been crawled and is not being crawled (errorCode == null && statusCode == null); OR
 * (b) a crawl that failed a certain amount of time ago. (errorCode !== NULL && nextRetryDate < NOW)
 * Provide database details in opts.db. Database connection managed by
 * Sequelize.
 *
 * @param {Object} opts Options
 */
FirestoreUrlList = function (fstore, opts) {
  if (!(this instanceof FirestoreUrlList)) {
    return new FirestoreUrlList(fstore, opts);
  }
  firestore = fstore;
  if (!opts) {
    opts = {
    };
  }
  if (!opts.db){
      opts.db = {};
  }

  // Some options defaults
    if (opts.db.collection === undefined) {
        collection = "url";
    }else{
        collection = opts.db.collection;
    }
    //firestore = new Firestore();
    // if (opts.db.host){
    //     firestore.settings(opts.db)
    // }

  this._recrawlInMs = opts.recrawlInMs || YEAR_MS;

  this._initialRetryTime = 1000 * 60 * 60;
};

/**
 * Create the URL table if it doesn't already exist, and return it (promise).
 *
 * @return {Promise} Promise returning the url collection.
 */
FirestoreUrlList.prototype._getUrlCollection = function () {
    var syncProm = Promise.resolve(),
    self = this;


  return syncProm.then(function () {
    return firestore.collection(collection);
  });
};

/**
 * Insert new URL record if it doesn't already exist. If it does exist, this
 * function resolves anyway.
 *
 * @param  {Url} url    Url object
 * @return {Promise}    Promise resolved when record inserted.
 */
FirestoreUrlList.prototype.insertIfNotExists = function (url) {
  var self = this;

  return this._getUrlCollection().then(function (urlCollection) {
//    console.log('inserting: ' + JSON.stringify(url));
    
    if (!url){
        throw new Error("trying to insert null");
    }
    if (!url.getUrl()){
        throw new Error("url is empty")
    }
    if(!url.urlHash){
        url.urlHash = self._createUrlHash(url.getUrl());
    }
    return urlCollection.doc(url.urlHash).get().then((docSnapshot)=>{
        if (!docSnapshot.exists){
            //console.log(docSnapshot);
            console.log('doesnt exist, create new');
            return urlCollection.doc(url.urlHash).set(self._makeUrlDoc(url));
        }else{
            // console.log(docSnapshot.data());
            return docSnapshot.data();
        }
        
    });
    });
};

/**
 * A method to insert an array of URLs in bulk. This is useful when we are
 * trying to insert 50,000 URLs discovered in a sitemaps file, for example.
 *
 * @param  {Array} urls  Array of URL objects to insert.
 * @return {Promise}     Promise resolves when everything is inserted.
 */
FirestoreUrlList.prototype.insertIfNotExistsBulk = function (urls) {
  var self = this;

  let batch = firestore.batch();


  return this._getUrlCollection().then(function (urlTable) {
    for (let i=0;i<urls.length;i++){
        let docRef = urlTable.doc(urls[i].urlHash);
        batch.set(docRef, urls[i]);
        return batch.commit();
    }
  });
};
/**
 * return url hash of given url
 */
FirestoreUrlList.prototype._createUrlHash = function(url) {
    return crypto.createHash('sha1').update(url).digest("hex");
}

/**
 * Given a URL object, create the corresponding row to be inserted into the
 * urls table.
 *
 * @param  {Url} url    Url object.
 * @return {Object}     Row to be inserted into the url table.
 */
FirestoreUrlList.prototype._makeUrlDoc = function (url) {
  var urlHash = this._createUrlHash(url.getUrl());

  return {
    urlHash: urlHash,
    url: url.getUrl(),
    statusCode: url.getStatusCode(),
    errorCode: url.getErrorCode(),
    errorMessage: url.getErrorMessage(),
    numErrors: url.getErrorCode() === null ? 0 : 1,
    nextRetryDate: url.getErrorCode() === null ? this._calcNextRetryDate(0) : this._calcNextRetryDate(1)
  };
};

/**
 * Calculate the next retry date, given the number of errors that have now
 * occurred. The retry interval is based on an exponentially (power of 2)
 * increasing retry time.
 *
 * @param  {number} numErrors Number of errors occurred so far.
 * @return {Date}             Date object of next retry date.
 */
FirestoreUrlList.prototype._calcNextRetryDate = function (numErrors) {
  var date,
      delay;

    date = new Date();

    if (numErrors === 0) {
        // If we want to schedule a crawl now, we subtract a random number of
        // seconds. This ensures the order we crawl URLs is random; otherwise, if
        // we parse a sitemap, we could get stuck crawling one host for hours.
        delay = - Math.random() * YEAR_MS;
    } else {
        delay = this._initialRetryTime * Math.pow(2, numErrors - 1);
    }

    return new Date(date.getTime() + delay);
};

/**
 * Insert a record, or update it if it already exists.
 *
 * @param  {Url} url    Url object.
 * @return {Promise}    Promise resolved once record upserted.
 */
FirestoreUrlList.prototype.upsert = function (url) {
    var self = this, urlHash;

    urlHash = this._createUrlHash(url.getUrl());

    return this._getUrlCollection().then(function (urlCollection) {
        return urlCollection.doc(urlHash).get().then((docSnapshot)=>{
            var numErrors = 0,nextRetryDate
            if (docSnapshot.exists){
                numErrors = docSnapshot.numErrors;
            }

            if (url.getErrorCode() === null) {
                if (url.getStatusCode() === null) {
                    // schedule a crawl immediately
                    nextRetryDate = self._calcNextRetryDate(0);
                } else {
                    // we've already crawled this URL successfully... don't crawl it
                    // again.
                    nextRetryDate = new Date(new Date().getTime() + self._recrawlInMs);
                }
            } else {
                nextRetryDate = self._calcNextRetryDate(numErrors + 1);
            }
            return urlCollection.doc(urlHash).set({
                urlHash: urlHash,
                url: url.getUrl(),
                statusCode: url.getStatusCode(),
                errorCode: url.getErrorCode(),
                errorMessage: url.getErrorMessage(),
                numErrors: url.getErrorCode() === null ? 0 : (numErrors + 1),
                nextRetryDate: nextRetryDate
            })
        });
  });
};

/**
 * Get the next URL to be crawled.
 *
 * @return {Promise} Promise resolving with the next URL to be crawled.
 */
FirestoreUrlList.prototype.getNextUrl = function () {
    var self = this;
    return this._getUrlCollection().then(function (urlTable) {
        return urlTable.where('nextRetryDate', '<=', new Date(new Date().getTime() + 1000) ).orderBy('nextRetryDate', 'asc').limit(1).get().then((snapshot)=>{
            if (snapshot.empty){
                return  Promise.reject(new RangeError("The list has been exhausted."));
            }else{  
                snapshot.forEach((dc)=>{
                    console.log('logging from query');
                    //console.log(dc.id);
                    //console.log(dc);
                    console.log(dc.data());
                })
                let doc = snapshot.docs[0];
                return self._getUrlCollection().then((collection)=>{
                    return collection.doc(doc.id).update( {nextRetryDate: new Date(new Date().getTime() + 60000)}).then(()=>{
                        let url = new Url({
                            url: doc.data().url,
                            statusCode: doc.data().statusCode,
                            errorCode: doc.data().errorCode,
                            errorMessage: doc.data().errorMessage
                        });
                        //console.log(url);
                        return Promise.resolve(url);
                    })
                })
            }
        })
    });
};

module.exports = FirestoreUrlList;
