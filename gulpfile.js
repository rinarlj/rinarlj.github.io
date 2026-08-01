const { series, parallel, watch, src, dest } = require('gulp');
const csso = require('gulp-csso');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const gulpSass = require('gulp-sass');
const dartSass = require('sass');
const plumber = require('gulp-plumber');
const cp = require('child_process');

const sassCompile = gulpSass(dartSass);
const jekyllCommand = /^win/.test(process.platform) ? 'jekyll.bat' : 'bundle';

function jekyllBuild(done) {
  const child = cp.spawn(jekyllCommand, ['exec', 'jekyll', 'build'], { stdio: 'inherit' });
  child.on('close', (code) => {
    if (code !== 0) {
      done(new Error(`Jekyll exited with code ${code}`));
      return;
    }
    done();
  });
  child.on('error', done);
}

function sassTask() {
  return src('src/styles/**/*.scss')
    .pipe(plumber())
    .pipe(sassCompile().on('error', sassCompile.logError))
    .pipe(csso())
    .pipe(dest('assets/css/'));
}

/** Binary font files must use encoding: false (default utf-8 corrupts .ttf/.woff). */
function fontsTask() {
  return src(
    [
      'src/fonts/*.ttf',
      'src/fonts/*.woff',
      'src/fonts/*.woff2',
      'src/fonts/**/*.ttf',
      'src/fonts/**/*.woff',
      'src/fonts/**/*.woff2',
    ],
    { allowEmpty: true, encoding: false }
  )
    .pipe(plumber())
    .pipe(dest('assets/fonts/'));
}

function jsTask() {
  return src('src/js/**/*.js')
    .pipe(plumber())
    .pipe(concat('main.js'))
    .pipe(uglify())
    .pipe(dest('assets/js/'));
}

/**
 * Long-running: `jekyll serve --livereload` owns the HTTP server, the site rebuild and the
 * browser refresh. done() only fires when the child exits, which under `npm run serve` means
 * the user stopped it (or Jekyll crashed, surfaced as a task error).
 */
function jekyllServe(done) {
  const child = cp.spawn(jekyllCommand, ['exec', 'jekyll', 'serve', '--livereload'], {
    stdio: 'inherit',
  });
  child.on('close', (code) => done(code === 0 ? undefined : new Error(`Jekyll exited with code ${code}`)));
  child.on('error', done);
}

/**
 * Only compiles src/ into assets/. Jekyll's own --watch sees the assets/ write and handles
 * the rebuild + livereload, so there is no jekyllBuild or reload step here. HTML/layouts
 * are watched by Jekyll directly.
 */
function watchFiles(done) {
  watch('src/styles/**/*.scss', sassTask);
  watch('src/js/**/*.js', jsTask);
  watch('src/fonts/**/*', fontsTask);
  done();
}

const buildAssets = parallel(sassTask, jsTask, fontsTask);

exports.sass = sassTask;
exports.js = jsTask;
exports.fonts = fontsTask;
exports.jekyllBuild = jekyllBuild;
exports.buildAssets = buildAssets;
exports.build = series(buildAssets, jekyllBuild);
exports.default = series(buildAssets, parallel(jekyllServe, watchFiles));
