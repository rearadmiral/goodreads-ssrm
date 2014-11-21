// goodreads SSRM (server-side rendering middleware)
'use strict';

var fs = require('fs');
var wait = require('wait.for');
var phantom = require('node-phantom-simple');
var path = require('path');

var goodreadsState = {};

var syncPhantomRender = function(phantomRuntime, appFilename, url, callback) {
  var start = new Date();
  phantomRuntime.createPage(function(err, page) {
    var appFileUrl = 'http://localhost:9000' + url;
    console.log('[DEBUG] appFileUrl: ' + appFileUrl);
    page.open(appFileUrl, function(err, status) {
    console.log('[GR-SSRM] phantom rendering consumed ' + ((new Date()) - start) + 'ms')
      page.evaluate(function(url) {
          return document.documentElement.outerHTML;
        },
        function(err, result) {
        callback(err, result);
      });
    });
  });
};

var serverSideRender = function(phantomRuntime, appFilename, req, res) {
  var html = wait.for(syncPhantomRender, phantomRuntime, appFilename, req.url);
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(html);
}

var isAngularRequest = function(url) {
  return url.match(/\./) === null;
}

var middlewareFactory = function(appFilename, options) {

  var phantomRuntime;

  var start = new Date();
  phantom.create(function(err, newRuntime) {
    if (err) {
      throw new Error(err);
    }
    console.log('phantom runtime creation consumed ' + ((new Date()) - start) + 'ms');
    phantomRuntime = newRuntime;
  });

  if (options !== undefined && options.skipSsr === true) {
    throw new Error('temporarily disabled');
  }

  return function(req, res, next) {
    if (isAngularRequest(req.url)) {

      if (phantomRuntime === undefined) {
        console.log('[GR-SSRM] cannot yet render pages. phantom runtime not yet available.');
        res.writeHead(503, {'Content-Type': 'text/html'});
        res.end('<html><head><title>:-|</title></head><body><h1>come back later</h1>' +
                '<img src="https://c4.staticflickr.com/8/7157/6540643319_7945715c3a_n.jpg" /></body></html>');
      } else {

        var userAgent = req.headers['user-agent'];
        console.log('[DEBUG] userAgent: ' + userAgent);
        if (userAgent.match('PhantomJS')) {
          console.log('[GR-SSRM] sending ' + appFilename + ' to phantom pre-rendering');
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.write(fs.readFileSync(appFilename));
          res.end();
        } else {
          console.log('[GR-SSRM] server-side rendering appFile ' + appFilename + ' with route ' + req.url);
          wait.launchFiber(serverSideRender, phantomRuntime, appFilename, req, res);
        }
      }

    } else {
      console.log('[GR-SSRM] serving static asset: ' + req.url);
      next();
    }
  };
};

module.exports = {
  middlewareFor: middlewareFactory
};
