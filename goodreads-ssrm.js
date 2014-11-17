// goodreads SSRM (server-side rendering middleware)
'use strict';

var wait = require('wait.for');
var jsdom = require('jsdom');

var jsDomGet = function(appFilename, url, callback) {
  jsdom.env({
    file: appFilename,
    windowLocation: url,
    features: {
      QuerySelector: true
    },
    created: function(errors, window) {

      // angular needs this but jsdom doesn't provide it
      window.scrollTo = function() {};

      window.history.pushState(null, null, url);
    },
    done: function(errors, window) {
      console.log('[DEBUG] window.angular: ' + window.angular);
      callback(errors, window);
    }
  });
};

var renderFileUsingJsDom = function(appFilename, url) {
  var start = Date.now();
  var window = wait.for(jsDomGet, appFilename, url);
  var end = Date.now();
  console.log('[GRSSRM] jsdom took: ' + (end - start) + 'ms');
  return window.document.querySelector('html').innerHTML;
};

var serverSideRender = function(appFilename, req, res) {
  try {
    var doc = renderFileUsingJsDom(appFilename, req.url);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(doc);
    res.end();
  } catch (err) {
    console.error(err);
    res.end(':-(');
  }
};

var isAngularRequest = function(url) {
  return url.match(/\./) === null;
}

var middlewareFactory = function(appFilename) {
  return function(req, res, next) {
    if (isAngularRequest(req.url)) {
      console.log('[GR-SSRM] server-side rendering ng-app ' + appFilename + ' with route ' + req.url);
      wait.launchFiber(serverSideRender, appFilename, req, res);
    } else {
      next();
    }
  };
};

module.exports = {
  middlewareFor: middlewareFactory
};
