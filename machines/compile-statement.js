module.exports = {


  friendlyName: 'Compile Statement',


  description: 'Compile a Waterline statement to a native query for MongoDB.',


  cacheable: true,


  sync: true,


  inputs: {

    statement: {
      description: 'A Waterline statement.',
      extendedDescription: 'See documentation for more information.  Note that `opts` may be used for expressing adapter-specific customizations as a sibling to `from`, `where`, `select`, etc.  In other words, recursively deep within a Waterline query statement.  This is distinct from `meta`, which contains adapter-specific customizations about the statement as a whole.',
      moreInfoUrl: 'https://github.com/particlebanana/waterline-query-builder/blob/master/docs/syntax.md',
      example: {},
      required: true
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the adapter.',
      extendedDescription: 'This is reserved for custom adapter-specific extensions.',
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'The provided Waterline statement was compiled successfully.',
      outputVariableName: 'report',
      outputDescription: 'The `nativeQuery` property is the compiled native query for the database.  The `meta` property is reserved for custom adapter-specific extensions.',
      example: {
        nativeQuery: '*',
        meta: '==='
      }
    },

    malformed: {
      description: 'The provided Waterline statement could not be compiled due to malformed syntax.',
      outputVariableName: 'report',
      outputDescription: 'The `error` property is a JavaScript error instance explaining that (or preferably even _why_) the Waterline syntax is not valid.  The `meta` property is reserved for custom adapter-specific extensions.',
      example: {
        error: '===',
        meta: '==='
      }
    },

    notSupported: {
      description: 'The provided Waterline statement could not be compiled because it is not supported by this adapter.',
      extendedDescription: 'If even one clause of the Waterline statement is not supported by the adapter, the compilation of the entire statement _always fails_.',
      outputVariableName: 'report',
      outputDescription: 'The `error` property is a JavaScript error instance explaining that (or preferably even _why_) the Waterline statement is not supported.  The `meta` property is reserved for custom adapter-specific extensions.',
      example: {
        error: '===',
        meta: '==='
      }
    }

  },


  fn: function compileQuery(inputs, exits) {
    var Builder = require('machinepack-mongo-query-builder');

    Builder.generateQuery({
      query: inputs.statement
    }).exec({
      error: function error(err) {
        return exits.error({
          error: err
        });
      },
      malformed: function malformed(err) {
        return exits.malformed({
          error: err
        });
      },
      success: function success(query) {
        return exits.success({
          nativeQuery: query
        });
      }
    });
  }


};
