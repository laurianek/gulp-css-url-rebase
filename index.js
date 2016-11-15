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

function getFinalUrl(url, queryStr) {
  return [url, queryStr].filter(a => !!a).join('?');
}

var rebaseUrls = function (css, options) {
  return rework(css)
    .use(reworkUrl(function (_url) {
      if (isAbsolute(_url) || isUrl(_url) || /^(data:.*;.*,)/.test(_url)) {
        return _url;
      }
      var debug = options.debug;

      debug && log('def url', _url);
      var pathParts = _url.split('?'),
        q = pathParts[1],
        url = pathParts[0] || '';
      var urlExtName = path.extname(url),
        processedUrl = path.parse(url),
        result, subDir;

      if (FONT_FORMATS.indexOf(urlExtName) !== -1) {
        processedUrl.dir = '../fonts';
        result = getFinalUrl(path.format(processedUrl), q);
        debug && log('new url', result);
        return result;
      }

      if (processedUrl.dir === '../images' || processedUrl.dir === '../fonts') {
        result = getFinalUrl(path.format(processedUrl), q);
        debug && log('new url', result);
        return result;
      }

      subDir = path.parse(processedUrl.dir);

      if (subDir.base === '') {
        processedUrl.dir = '../images';
        result = getFinalUrl(path.format(processedUrl), q);
        debug && log('new url', result);
        return result;
      }

      subDir.dir = '../images';
      processedUrl.dir = path.format(subDir);
      result = getFinalUrl(path.format(processedUrl), q);

      debug && log('new url', result);
      return result;
    })).toString();
};

module.exports = function (options) {
  options = options || {};
  var root = options.root || '.';
  var reroot = options.reroot || '';
  var debug = options.debug || false;

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

    var css = rebaseUrls(file.contents.toString(), {
      currentDir: fileDir,
      root: path.join(file.cwd, root, rerootPath),
      debug: debug
    });

    file.contents = new Buffer(css);

    //this.push(file);
    cb(null, file);
  });
};
