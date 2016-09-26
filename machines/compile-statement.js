module.exports = {


  friendlyName: 'Compile Statement',


  description: 'Compile a Waterline statement to a native query for the database.',


  cacheable: true,


  sync: true,


  inputs: {

    statement: {
      description: 'A Waterline statement.',
      extendedDescription: 'The provided statement will be coerced to a JSON-serializable dictionary if it isn\'t one already (see [rttc.dehydrate()](https://github.com/node-machine/rttc#dehydratevalue-allownullfalse-dontstringifyfunctionsfalse)). That means any provided Date instances will be converted to timezone-agnostic ISO timestamp strings (i.e. JSON timestamps). See documentation for usage information. Note that `opts` may be used for expressing driver-specific customizations as a sibling to `from`, `where`, `select`, etc. In other words, recursively deep within a Waterline query statement. This is distinct from `meta`, which contains driver-specific customizations about the statement as a whole.',
      moreInfoUrl: 'https://github.com/particlebanana/waterline-query-builder/blob/master/docs/syntax.md',
      example: {},
      required: true
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the driver.',
      extendedDescription: 'This is reserved for custom driver-specific extensions. Please refer to the documentation for the driver you are using for more specific information.',
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'The provided Waterline statement was compiled successfully.',
      extendedDescription: 'The compiled `nativeQuery` will be coerced to a JSON-serializable value if it isn\'t one already (see [rttc.dehydrate()](https://github.com/node-machine/rttc#dehydratevalue-allownullfalse-dontstringifyfunctionsfalse)). That means any Date instances therein will be converted to timezone-agnostic ISO timestamp strings (i.e. JSON timestamps).',
      outputVariableName: 'report',
      outputDescription: 'The `nativeQuery` property is the compiled native query for the database. The `meta` property is reserved for custom driver-specific extensions.',
      example: {
        nativeQuery: '*',
        meta: '==='
      }
    },

    malformed: {
      description: 'The provided Waterline statement could not be compiled due to malformed syntax.',
      outputVariableName: 'report',
      outputDescription: 'The `error` property is a JavaScript error instance explaining that (or preferably even _why_) the Waterline syntax is not valid. The `meta` property is reserved for custom driver-specific extensions.',
      example: {
        error: '===',
        meta: '==='
      }
    },

    notSupported: {
      description: 'The provided Waterline statement could not be compiled because it is not supported by this driver.',
      extendedDescription: 'If even one clause of the Waterline statement is not supported by the driver, the compilation of the entire statement _always fails_.',
      outputVariableName: 'report',
      outputDescription: 'The `error` property is a JavaScript error instance explaining that (or preferably even _why_) the Waterline statement is not supported. The `meta` property is reserved for custom driver-specific extensions.',
      example: {
        error: '===',
        meta: '==='
      }
    }

  },


  fn: function compileQuery(inputs, exits) {
    var Builder = require('mongo-query-builder');

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
          error: err,
          meta: inputs.meta
        });
      },
      success: function success(query) {
        return exits.success({
          nativeQuery: query,
          meta: inputs.meta
        });
      }
    });
  }


};
