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
      tests: {
        options: {
          bundleOptions: {
            debug: true,
          }
        },
        src: "test/suite.js",
        dest: "dist/browserified-tests.js"
      },      
    },
    watch: {
      tests: {          
        files: ["test/**/*.js", "src/**/*.js"],
        tasks: ["browserify:tests"],
        options: {
          livereload: true,
        },
      },
    },
    connect: {
      tests: {
        options: {
          port: 2345,
          livereload: true,
        }
      }
    },    
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');

  grunt.registerTask('tests', ["browserify:tests", 'connect:tests', 'watch:tests']);  

  // Default task.
  grunt.registerTask('default', ['simplemocha:all', "browserify:mu", "browserify:muProd"]);

};
