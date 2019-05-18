var FirestoreUrlList = require("../lib/FirestoreUrlList"),
    expect = require("chai").expect,
    makeUrl = require("./utils/makeUrl");
const firebase = require('@firebase/testing');
const app = firebase.initializeAdminApp({
    projectId: 'test-proj',
    auth :{
        uid: 'jorge'
    }
  });

describe("FirestoreUrlList", function () {
  it("returns an instance when called as a function", function () {
    expect(FirestoreUrlList()).to.be.an.instanceOf(FirestoreUrlList);
  });

  it("returns an element that's been added", function (done) {
    var fifoUrlList,
        url;

    fifoUrlList = new FirestoreUrlList(app.firestore());
    url = makeUrl("https://example.com");
    fifoUrlList.insertIfNotExists(url).then(function () {
        return fifoUrlList.getNextUrl();
    }).then(function (res) {
        expect(res.getUrl()).to.equal(url.url);
        firebase.clearFirestoreData({
            projectId: 'test-proj'
        }).then(()=>{
            done();
        })
    });
  });

  it("gives error if getting next URL when list is empty", function (done) {
    new FirestoreUrlList(app.firestore()).getNextUrl().catch(function (err) {
        console.log('in catch statement, good');
        expect(err).to.be.an.instanceOf(RangeError);
        firebase.clearFirestoreData({
            projectId: 'test-proj'
        }).then(()=>{
            done();
        })
    });
    });

//   it("returns the first element in FIFO queue", function (done) {
//     var fifoUrlList,
//         url1,
//         url2;

//     fifoUrlList = new FirestoreUrlList(app.firestore());
//     url1 = makeUrl("https://example.com/home.html");
//     url2 = makeUrl("https://example.com/privacy.html");
//     console.log('insert 1');
//     fifoUrlList.insertIfNotExists(url1).then(function () {
//         console.log('insert 2');
//         return fifoUrlList.insertIfNotExists(url2);
//     }).then(function () {
//         console.log('get next');
//       return fifoUrlList.getNextUrl();
//     }).then(function (res) {
//         console.log('compare');
//       expect(res.getUrl()).to.equal(url1.getUrl());
//       firebase.clearFirestoreData({
//         projectId: 'test-proj'
//         }).then(()=>{
//             done();
//         })
//     });
//   });

//   it("returns the second element in FIFO queue", function (done) {
//     var fifoUrlList,
//         url1,
//         url2;

//     fifoUrlList = new FirestoreUrlList(app.firestore());
//     url1 = makeUrl("https://example.com/blah.html");
//     url2 = makeUrl("https://example.com/blah2.html");
//     fifoUrlList.insertIfNotExists(url1).then(function () {
//       return fifoUrlList.insertIfNotExists(url2);
//     }).then(function () {
//       return fifoUrlList.getNextUrl();
//     }).then(function () {
//       return fifoUrlList.getNextUrl();
//     }).then(function (res) {
//       expect(res.getUrl()).to.equal(url2.getUrl());
//       firebase.clearFirestoreData({
//         projectId: 'test-proj'
//     }).then(()=>{
//         done();
//     })
//     });
//   });

  it("does not update when using insertIfNotExists", function (done) {
    var fifoUrlList,
        url1,
        url2;

    fifoUrlList = new FirestoreUrlList(app.firestore());
    url1 = makeUrl("https://example.com/ifnotexists.html", null);
    url2 = makeUrl("https://example.com/ifnotexists.html", 200);
    fifoUrlList.insertIfNotExists(url1).then(function () {
      return fifoUrlList.insertIfNotExists(url2);
    }).then(function () {
      return fifoUrlList.getNextUrl();
    }).then(function (res) {
      expect(res.getStatusCode()).to.equal(null);
      firebase.clearFirestoreData({
        projectId: 'test-proj'
    }).then(()=>{
        done();
    })
    });
  });

//   describe("upsert", function () {
//     it("updates if a duplicate", function (done) {
//       var fifoUrlList,
//           url1,
//           url2;

//     fifoUrlList = new FirestoreUrlList(app.firestore());
//       url1 = makeUrl("https://example.com/update", null);
//       url2 = makeUrl("https://example.com/update", 200);
//       fifoUrlList.upsert(url1).then(function () {
//         return fifoUrlList.upsert(url2);
//       }).then(function () {
//         return fifoUrlList.getNextUrl();
//       }).then(function (res) {
//         expect(res.getStatusCode()).to.equal(200);
//         firebase.clearFirestoreData({
//             projectId: 'test-proj'
//         }).then(()=>{
//             done();
//         })
//       });
//     });
//  });
})
