## mu

A simple library for working with immutable data in mutable+observable MV* applications.

### Installation

    bower install --save https://github.com/iamnoah/mu.git

mu depends on lodash. It will work with underscore if you map mu to use underscore instead of lodash in your require.confg:

    map: {
        "mu": {
           "lodash": "underscore"
        }
    }

### Description

Functional programming makes programs easier to reason about. Add in persistant data structures, and whole classes of errors can be ruled out, and performance can be optimized easily. But at some point, you need to mutate some state. Being able to observe and bind state changes reduces boiler plate and simplifies application logic.

mu tries to give you tools for finding a happy place between pure functional programming and imperative state mutation.  With mu, you create a few persistent data structures, but have observable updates, and can effectively mutate your data without having to manually copy a bunch of objects. You can make your bindings as coarse or as fine grained as you need to, while still getting the benefits of functional, persistent data structures.


### computes

Computes are used to hold the state. mu does not directly depend on a compute implementation, so you must wrap the state yourself.

### Atoms

Atoms provide an interface for mutiating and breaking down a single immutable structure, wrapped by a compute.

The get(path, to, desired, property) method can be used to create compute functions for any property in the data. e.g.,

	var atom = Atom(data);
    var baz = atom.get("foo", "array", 2, "bar", "baz");
    baz() === data().foo.array[2].bar.baz
    baz(newValue) // equivalent to copying data()
    // setting the value of foo.array[2].bar.baz
    // and setting via data(copy)

### mu's compute

A compute implementation is included if you need one.

## mu

So which is better, functional programming or imperative programming? [mu][1]

[1]: http://en.wikipedia.org/wiki/Mu_(negative)#.22Unasking.22_the_question
