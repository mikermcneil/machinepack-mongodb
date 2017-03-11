var url = require('url');
var util = require('util');
var _ = require('@sailshq/lodash');
var NodeMongoDBNativeLib = require('mongodb');

module.exports = {


  friendlyName: 'Create manager',


  description: 'Build and initialize a connection manager instance (in Mongo, this is `db`).',


  moreInfoUrl: 'https://github.com/node-machine/driver-interface/blob/master/machines/create-manager.js',


  inputs: {

    connectionString: {
      description: 'The Mongo connection URL containing the configuration/credentials necessary for connecting to the database.',
      moreInfoUrl: 'http://sailsjs.com/documentation/reference/configuration/sails-config-datastores#?the-connection-url',
      // example: 'mongodb://foo:bar@localhost:27017/thedatabase',
      example: '===',
      required: true
    },

    onUnexpectedFailure: {
      friendlyName: 'On unxpected failure (unused)',
      description: 'A notifier function for otherwise-unhandled error events. (WARNING: Currently, this is ignored by mp-mongo!)',
      moreInfoUrl: 'https://github.com/node-machine/driver-interface/blob/3f3a150ef4ece40dc0d105006e2766e81af23719/machines/create-manager.js#L37-L49',
      // example: '->',
      example: '==='
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'A dictionary of additional options to pass in when instantiating the Mongo client instance. (e.g. `{ssl: true}`)',
      moreInfoUrl: 'https://github.com/node-machine/driver-interface/blob/3f3a150ef4ece40dc0d105006e2766e81af23719/constants/meta.input.js',
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'Connected to Mongo successfully.',
      outputFriendlyName: 'Report',
      outputDescription: 'The `manager` property is a Mongo client instance.  The `meta` property is unused.',
      // outputExample: {
      //   manager: '===',
      //   meta: '==='
      // }
      outputExample: '==='
    },

    malformed: {
      description: 'The provided connection string is malformed.',
      extendedDescription: 'The format of connection strings varies across different databases and their drivers. This exit indicates that the provided string is not valid as per the custom rules of this driver. Note that if this exit is traversed, it means the driver DID NOT ATTEMPT to create a manager-- instead the invalid connection string was discovered during a check performed beforehand.',
      outputFriendlyName: 'Report',
      outputDescription: 'The `error` property is a JavaScript Error instance explaining that (and preferably "why") the provided connection string is invalid. The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: {
        error: '===',
        meta: '==='
      }
    },

    failed: {
      description: 'Could not connect to Mongo using the specified connection URL.',
      extendedDescription:
        'If this exit is called, it might mean any of the following:\n' +
        ' + the credentials encoded in the connection string are incorrect\n' +
        ' + there is no database server running at the provided host (i.e. even if it is just that the database process needs to be started)\n' +
        ' + there is no software "database" with the specified name running on the server\n' +
        ' + the provided connection string does not have necessary access rights for the specified software "database"\n' +
        ' + this Node.js process could not connect to the database, perhaps because of firewall/proxy settings\n' +
        ' + any other miscellaneous connection error\n' +
        '\n' +
        'Note that even if the database is unreachable, bad credentials are being used, etc, ' +
        'this exit will not necessarily be called-- that depends on the implementation of the driver ' +
        'and any special configuration passed to the `meta` input. e.g. if a pool is being used that spins up ' +
        'multiple connections immediately when the manager is created, then this exit will be called if any of ' +
        'those initial attempts fail. On the other hand, if the manager is designed to produce adhoc connections, ' +
        'any errors related to bad credentials, connectivity, etc. will not be caught until `getConnection()` is called.',
      outputFriendlyName: 'Report',
      outputDescription: 'The `error` property is a JavaScript Error instance with more information and a stack trace. The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: {
        error: '===',
        meta: '==='
      }
    }

  },

  fn: function (inputs, exits) {

    // Note:
    // Support for different types of managers is database-specific, and is not
    // built into the Waterline driver spec-- however this type of configurability
    // can be instrumented using `meta`.
    //
    // Feel free to fork this driver and customize as you see fit.  Also note that
    // contributions to the core driver in this area are welcome and greatly appreciated!


    // Build a local variable (`_clientConfig`) to house a dictionary
    // of additional Mongo options that will be passed into the Server config.
    //
    // This is pulled from the `connectionString` and `meta` inputs, and used for
    // configuring stuff like `host` and `password`.
    //
    // For a complete list of available options, see:
    //  • https://github.com/christkv/mongodb-core/blob/2.0/lib/topologies/server.js
    //
    // However, note that supported options are explicitly whitelisted below.
    var _clientConfig = {};


    // Validate and parse `meta` (if specified).
    if (!_.isUndefined(inputs.meta)) {
      if (!_.isObject(inputs.meta)) {
        return exits.error(new Error('If provided, `meta` must be a dictionary.'));
      }

      // Use properties of `meta` directly as Mongo Server config.
      // (note that we're very careful to only stick a property on the client config
      //  if it was not undefined, just in case that matters)
      // http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/connection-settings/
      var configOptions = [
        // Mongo Server Options:
        // ============================================

        // SSL Options:
        'ssl', 'sslValidate', 'sslCA', 'sslCert', 'sslKey', 'sslPass',

        // Connection Options:
        'poolSize', 'autoReconnect', 'noDelay', 'keepAlive', 'connectTimeoutMS',
        'socketTimeoutMS', 'reconnectTries', 'reconnectInterval',

        // Other Options:
        'ha', 'haInterval', 'replicaSet', 'secondaryAcceptableLatencyMS',
        'acceptableLatencyMS', 'connectWithNoPrimary', 'authSource', 'w',
        'wtimeout', 'j', 'forceServerObjectId', 'serializeFunctions',
        'ignoreUndefined', 'raw', 'promoteLongs', 'bufferMaxEntries',
        'readPreference', 'pkFactory', 'readConcern'

      ];

      _.each(configOptions, function addConfigValue(clientConfKeyName) {
        if (!_.isUndefined(inputs.meta[clientConfKeyName])) {
          _clientConfig[clientConfKeyName] = inputs.meta[clientConfKeyName];
        }
      });


      // In the future, other special properties of `meta` could be used
      // as options for the manager-- e.g. the connection strings of replicas, etc.
    }

    // Validate & parse connection string, pulling out Postgres client config
    // (call `malformed` if invalid).
    //
    // Remember: connection string takes priority over `meta` in the event of a conflict.
    var connectionString = inputs.connectionString;
    try {
      // We don't actually care about the protocol, the MongoDB drivr does,
      // plus `url.parse()` returns funky results if the argument doesn't have one.
      // So we'll add one if necessary.
      // See https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Syntax
      if (!connectionString.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
        connectionString = 'mongodb://' + connectionString;
      }
      var parsedConnectionStr = url.parse(connectionString);

      // Validate that a protocol was found before other pieces
      // (otherwise other parsed info will be very weird and wrong)
      if (!parsedConnectionStr.protocol || parsedConnectionStr.protocol !== 'mongodb:') {
        throw new Error('Protocol (i.e. `mongodb://`) is required in connection string.');
      }

      // Parse user & password
      if (parsedConnectionStr.auth && _.isString(parsedConnectionStr.auth)) {
        var authPieces = parsedConnectionStr.auth.split(/:/);
        if (authPieces[0]) {
          _clientConfig.user = authPieces[0];
        }
        if (authPieces[1]) {
          _clientConfig.password = authPieces[1];
        }
      }
    } catch (_e) {
      _e.message = util.format('Provided value (`%s`) is not a valid Mongodb connection string.', inputs.connectionString) + ' Error details: ' + _e.message;
      return exits.malformed({
        error: _e,
        meta: inputs.meta
      });
    }

    NodeMongoDBNativeLib.MongoClient.connect(connectionString, _clientConfig, function connectCb(err, db) {
      if (err) {
        return exits.error(err);
      }

      // `db` will be our manager.
      // (This variable is just for clarity.)
      var manager = db;

      // Now mutate this manager, giving it a telltale.
      //
      // > For more context/history, see:
      // > https://github.com/treelinehq/machinepack-mongo/issues/2#issuecomment-267517800
      // >
      // > (^^But that's not the real reason to include it -- we ended up solving it differently
      // > anyway.  No, the real reason is so that there's a way to tell if a given Mongo client
      // > instance came from mp-mongo or not, for debugging reasons.)
      manager._isFromMPMongo = true;

      return exits.success({
        manager: manager,
        meta: inputs.meta
      });
    });//</ .connect() >
  }


};
