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
        },
        src: "src/mu.js",
        dest: "dist/mu.js"
      },
      compute: {
        options: {
          bundleOptions: {
            standalone: "mu.compute",
          },
        },
        src: "src/compute.js",
        dest: "dist/compute.js"
      },
      demo: {
        options: {
          transform: [ require('grunt-react').browserify ]
        },
        src: "demo/main.jsx",
        dest: "demo/bundle.js"        
      }
    },
    connect: {
      demo: {
        options: {
          livereload: true,
        }
      }
    },
    watch: {
      demo: {
        options: {
          livereload: true,
        },
        files: [
          "src/**/*.js",
          "demo/main.jsx",
        ],
        tasks: ['browserify:demo']
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-react');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');

  // Default task.
  grunt.registerTask('default', ['simplemocha:all', "browserify:mu", "browserify:compute"]);
  grunt.registerTask('demo', ["browserify:demo", "connect:demo", "watch:demo"]);

};
