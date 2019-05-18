var Crawler = require("./Crawler"),
    Url = require("./Url"),
    DbUrlList = require("./DbUrlList"),
    FirestoreUrlList = require('./FirestoreUrlList'),
    RedisUrlList = require("./RedisUrlList"),
    htmlLinkParser = require("./handlers/htmlLinkParser"),
    robotsParser = require("./handlers/robotsParser"),
    sitemapsParser = require("./handlers/sitemapsParser");

module.exports = {
  Crawler: Crawler,
  Url: Url,
  DbUrlList: DbUrlList,
  RedisUrlList: RedisUrlList,
  FirestoreUrlList: FirestoreUrlList,
  handlers: {
    htmlLinkParser: htmlLinkParser,
    robotsParser: robotsParser,
    sitemapsParser: sitemapsParser
  }
};
