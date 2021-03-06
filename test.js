'use strict';

var path = require('path');
var Cache = require('./');
var fs = require('fs');
var chai = require('chai');
var expect = chai.expect;
var RSVP = require('rsvp');
var Mode = require('stat-mode');

describe('cache', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache();
  });

  afterEach(function() {
    return cache.clear();
  });

  it('has expected default root', function() {
    var os = require('os');
    var tmpdir = os.tmpdir();
    var username = require('child_process').execSync('whoami').toString().trim();
    var descriptiveName = 'if-you-need-to-delete-this-open-an-issue-async-disk-cache';
    var defaultKey = 'default-disk-cache';

    expect(cache.root).to.eql(path.join(tmpdir, username, descriptiveName, defaultKey));
  });

  it('pathFor', function() {
    expect(cache.pathFor(key)).to.be.equal(path.join(cache.root, new Buffer(key).toString('base64')));
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      // credit @jgable
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      expect(fs.readFileSync(filePath).toString()).equal(value);
    });
  });

  it('get (doesn\'t exist)', function() {
    return cache.get(key).then(function(details) {
      expect(details.isCached).be.false;
    });
  });

  it('get (does exist)', function() {
    return cache.set(key, value).then(function(filePath) {
      return cache.get(key).then(function(details) {
        expect(details.isCached).be.true;
        expect(details.value).equal(value);
        expect(details.key).equal(filePath);
      });
    });
  });

  it('has (doesn\'t exist)', function() {
    return cache.has(key).then(function(exists) {
      expect(exists).be.false;
    });
  });

  it('has (does exist)', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        expect(exists).be.true;
      });
    });
  });

  it('remove', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        expect(exists).be.true;

        return cache.remove(key).then(function() {
          return cache.has(key).then(function(exists) {
            expect(exists).be.false;
          });
        });
      });
    });
  });
});

var zlib = require('zlib');
var inflate = RSVP.denodeify(zlib.inflate);
var gunzip = RSVP.denodeify(zlib.gunzip);
var inflateRaw = RSVP.denodeify(zlib.inflateRaw);

describe('cache compress: [ deflate ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflate'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      return inflate(fs.readFileSync(filePath)).then(function(result){
        result = result.toString();
        expect(result).equal(value);

        return cache.get(key).then(function(detail) {
          expect(detail.value).equal(value);
        });
      });
    });
  });
});

describe('cache compress: [ gzip ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'gzip'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath){

      return gunzip(fs.readFileSync(filePath)).then(function(result){
        result = result.toString();

        expect(result).equal(value);

        return cache.get(key).then(function(detail){
          expect(detail.value).equal(value);
        });
      });
    });
  });
});

describe('cache compress: [ deflateRaw ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflateRaw'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      return inflateRaw(fs.readFileSync(filePath)).then(function(result){
        result = result.toString();
        expect(result).equal(value);

        return cache.get(key).then(function(detail) {
          expect(detail.value).equal(value);
        });
      });
    });
  });
});

if (!/v0\.10/.test(process.version)) {
  describe('buffer support', function() {
    var key = 'buffer_fixed';
    var value = fs.readFileSync('./common/bufferdemo.png');
    var cache = new Cache('my-testing-cache', { supportBuffer: true });

    it('set', function(done) {

      // set file to cache
      cache.set(key, value).then(function() {

        // get file from cache
        cache.get(key).then(function(cacheEntry) {
          // console.log(cacheEntry.value.length);

          fs.writeFileSync('./common/bufferdemo_fromcache.png', cacheEntry.value);

          var oldFile = fs.readFileSync('./common/bufferdemo.png');
          var newFile = fs.readFileSync('./common/bufferdemo_fromcache.png');

          if (oldFile.toString('binary') !== newFile.toString('binary')) {
            done(new Error('Files didn\'t match!'));
          } else {
            done();
          }

        });
      });
    });
  });

  describe('buffer support disabled', function() {
    var key = 'buffer_fixed';
    var value = fs.readFileSync('./common/bufferdemo.png');
    var cache = new Cache('my-testing-cache');

    it('set', function(done) {

      // set file to cache
      cache.set(key, value).then(function() {

        // get file from cache
        cache.get(key).then(function(cacheEntry) {
          // console.log(cacheEntry.value.length);

          fs.writeFileSync('./common/bufferdemo_fromcache.png', cacheEntry.value);

          var oldFile = fs.readFileSync('./common/bufferdemo.png');
          var newFile = fs.readFileSync('./common/bufferdemo_fromcache.png');

          if (oldFile.toString('binary') !== newFile.toString('binary')) {
            done();
          } else {
            done(new Error('Files still matches, looks like nodejs community has fixed Buffer -> to string -> to buffer conversion bug. Applaud!'));
          }

        });
      });
    });
  });
}