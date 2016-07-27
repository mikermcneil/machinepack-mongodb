module.exports = {


  friendlyName: 'Parse native query error',


  description: 'Attempt to identify and parse a raw error from sending a native query and normalize it to a standard error footprint.',


  cacheable: true,


  sync: true,


  inputs: {

    queryType: {
      description: 'The type of query operation this raw error came from.',
      extendedDescription: 'Either "select", "insert", "delete", or "update". This determines how the provided raw error will be parsed/coerced.',
      moreInfoUrl: 'https://github.com/particlebanana/waterline-query-docs',
      required: true,
      example: 'select'
    },

    nativeQueryError: {
      description: 'The error sent back from the database as a result of a native query.',
      extendedDescription: 'This is referring to e.g. the output (`err`) returned through the `error` exit of `sendNativeQuery()` in this driver.',
      required: true,
      example: '==='
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the driver.',
      extendedDescription: 'This is reserved for custom driver-specific extensions.  Please refer to the documentation for the driver you are using for more specific information.',
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'The normalization is complete. If the error cannot be normalized into any other more specific footprint, then the catchall footprint will be returned.',
      outputVariableName: 'report',
      outputDescription: 'The `footprint` property is the normalized "footprint" representing the provided raw error.  Conforms to one of a handful of standardized footprint types expected by the Waterline driver interface. The `meta` property is reserved for custom driver-specific extensions.',
      example: {
        footprint: {},
        meta: '==='
      }
    }

  },


  fn: function parseNativeQueryError(inputs, exits) {
    var _ = require('lodash');

    // Local variable (`err`) for convenience.
    var err = inputs.nativeQueryError;

    // `footprint` is what will be returned by this machine.
    var footprint = {
      identity: 'catchall'
    };

    // If the incoming native query error is not an object, or it is
    // missing a `code` property, then we'll go ahead and bail out w/
    // the "catchall" footprint to avoid continually doing these basic
    // checks in the more detailed error negotiation below.
    if (!_.isObject(err) || !err.code) {
      return exits.success({
        footprint: footprint
      });
    }

    // Otherwise, continue inspecting the native query error in more detail:
    switch (inputs.queryType) {
      case 'select':
        break;

      case 'insert':
      case 'update':
        // Negotiate `notUnique` error footprint.
        if (err.code === '11000') {
          footprint.identity = 'notUnique';

          // Now manually extract the relevant bits of the error message
          // to build our footprint's `columns` property:
          footprint.columns = [];

          (function matchErrorCode() {
            // Example errmsg: `E11000 duplicate key error index: db_name.model_name.$attribute_name_1 dup key: { : "value" }`
            var matches = /E11000 duplicate key error index: .*?\..*?\.\$(.*?)_\d+\s+dup key: { : (.*) }$/.exec(err.errmsg);
            if (!matches) {
              // Example errmsg: E11000 duplicate key error collection: db_name.model_name index: attribute_name_1 dup key: { : "value" }
              matches = /E11000 duplicate key error collection: .*?\..*? index: (.*?)_\d+\s+dup key: { : (.*) }$/.exec(err.errmsg);
            }

            if (matches) {
              // name of index (without _[digits] at the end)
              var fieldName = matches[1];
              footprint.columns.push(fieldName);
            }
          });
        }
        break;

      case 'delete':
        break;

      default:
    }

    return exits.success({
      footprint: footprint
    });
  }


};
