'use strict';

var path = require('path');
var rework = require('rework');
var reworkUrl = require('rework-plugin-url');
var through = require('through2');
var validator = require('validator');
var chalk = require('chalk');
var dateFormat = require('dateformat');

const PLUGIN_NAME = 'gulp-css-url-rebase';
const FONT_FORMATS = ['.eot', '.ttf', '.woff', '.woff2'];

function log() {
  var args = [].slice.call(arguments, 0),
    now = Date.now(),
    time = '[' + chalk.gray(dateFormat(now, 'isoTime')) + '] ',
    debug = chalk.blue('debug ');

  console.log.apply(this, [time, debug].concat(args));
}

var isAbsolute = function (p) {
  var normal = path.normalize(p);
  var absolute = path.resolve(p);
  if (process.platform === 'win32') {
    absolute = absolute.substr(2);
  }
  return normal === absolute;
};

var isUrl = function (url) {
  if (!url) { return false; }

  // protocol relative URLs
  if (url.indexOf('//') === 0 && validator.isURL(url, { allow_protocol_relative_urls: true })) {
    return true;
  }

  return validator.isURL(url, { require_protocol: true });
};

function getFinalUrl(urlTransform, debug) {
  return function _getFinalUrl(url, queryStr) {
    var newUrl = [url, queryStr].filter(a => !!a).join('?');
    debug && log('new url', newUrl);
    return urlTransform(newUrl);
  }
}

var rebaseUrls = function (css, options) {
  return rework(css)
    .use(reworkUrl(function (_url) {
      if (isAbsolute(_url) || isUrl(_url) || /^(data:.*;.*,)/.test(_url)) {
        return _url;
      }
      var debug = options.debug;
      var getFinalUrlFn = getFinalUrl(options.urlTransform, debug);

      debug && log('def url', _url);
      var pathParts = _url.split('?'),
        q = pathParts[1],
        url = pathParts[0] || '';
      var urlExtName = path.extname(url),
        processedUrl = path.parse(url),
        fontsDir = '../../fonts',
        imagesDir = '../../images',
        result, subDir;

      if (FONT_FORMATS.indexOf(urlExtName) !== -1 || processedUrl.dir === '../fonts') {
        processedUrl.dir = fontsDir;
        return getFinalUrlFn(path.format(processedUrl), q);
      }

      if (processedUrl.dir === imagesDir) {
        return getFinalUrl(path.format(processedUrl), q);
      }

      subDir = path.parse(processedUrl.dir);

      if (subDir.base === '' || /ima?g/.test(subDir.base)) {
        processedUrl.dir = imagesDir;
        return getFinalUrlFn(path.format(processedUrl), q);
      }

      subDir.dir = imagesDir;
      processedUrl.dir = path.format(subDir);
      return getFinalUrlFn(path.format(processedUrl), q);
    })).toString();
};

function identityFn(i) {
  return i;
}

module.exports = function (options) {
  options = options || {};
  var root = options.root || '.';
  var reroot = options.reroot || '';
  var debug = options.debug || false;
  var urlTransform = options.urlTransform || identityFn;

  return through.obj(function (file, enc, cb) {
    var fileDir = path.dirname(file.path);

    // Allows placing the processed CSS in a different root directory while
    // leaving image resources alone.
    if (reroot) {
      var rerootPath = path.join(
        path.relative(root, reroot),
        path.relative(root, fileDir)
      );
    } else {
      rerootPath = '';
    }

    var fileContents = file.contents.toString();
    var css = rebaseUrls(fileContents, {
      currentDir: fileDir,
      root: path.join(file.cwd, root, rerootPath),
      debug: debug,
      urlTransform: urlTransform
    });

    file.contents = new Buffer(css);

    cb(null, file);
  });
};
