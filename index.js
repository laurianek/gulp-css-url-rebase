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

var rebaseUrls = function (css, options) {
  return rework(css)
    .use(reworkUrl(function (url) {
      if (isAbsolute(url) || isUrl(url) || /^(data:.*;.*,)/.test(url)) {
        return url;
      }
      log('default url', url);
      var urlExtName = path.extname(url),
        processedUrl = path.parse(url);

      if (FONT_FORMATS.indexOf(urlExtName) !== -1) {
        processedUrl.dir = '../fonts';
        return path.format(processedUrl);
      }

      if (processedUrl.dir === '../images') {
        return path.format(processedUrl);
      }

      var subDir = path.parse(processedUrl.dir);
      subDir.dir = '../images';

      var dir = path.format(subDir);
      processedUrl.dir = dir;

      log('new url', path.format(processedUrl));
      return path.format(processedUrl);
    })).toString();
};

module.exports = function (options) {
  options = options || {};
  var root = options.root || '.';
  var reroot = options.reroot || '';

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
      root: path.join(file.cwd, root, rerootPath)
    });

    file.contents = new Buffer(css);

    this.push(file);
    cb();
  });
};
