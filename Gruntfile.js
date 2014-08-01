/*global module:false*/
module.exports = function(grunt) {
  "use strict";
  // Project configuration.
  grunt.initConfig({
    // Task configuration.
    simplemocha: {
      options: {
        globals: ['should'],
        timeout: 3000,
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'tap'
      },

      all: { src: ['test/**/*.js'] }
    },
    browserify: {
      mu: {
        options: {
          bundleOptions: {
            standalone: "mu",
          },
          transform: [["envify", {
            NODE_ENV: "development",
          }]],
        },
        src: "src/mu.js",
        dest: "dist/mu.js",
      },
      muProd: {
        options: {
          bundleOptions: {
            standalone: "mu",
          },
          transform: [["envify", {
            NODE_ENV: "production",
          }]],
        },
        src: "src/mu.js",
        dest: "dist/mu.prod.js"
      },
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('default', ['simplemocha:all', "browserify:mu", "browserify:muProd"]);

};
