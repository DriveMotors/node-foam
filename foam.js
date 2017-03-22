var Wreck = require('wreck')
  , XML = require('simple-xml')
  , StringStream = require('stream-ext').StringStream
  , zlib = require('zlib')
  ;

module.exports = function soap (uri, operation, action, message, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  var xml = envelope(operation, message, options);
  // console.log(xml);
  var wreckOptions = {
    headers: headers(action, xml.length),
    rejectUnauthorized: options.rejectUnauthorized,
    secureProtocol: options.secureProtocol,
    timeout: options.timeout,
    payload: xml
  };
  // console.log('request', {uri, operation, action, message, options, wreckOptions});
  return Wreck.post(uri, wreckOptions, (error, response, payload) => {
    if (error) {
      // console.error('response Error', error, {response});
      callback(error);
      return;
    }

    var result = null;
    try {
      var body = payload.toString();
      // console.log('response', {body, response});
      var xml = XML.parse(body);
      if (xml.Envelope) {
        result = xml.Envelope.Body;
      } else {
        error = 'missing envelope - ' + body;
      }
    } catch (e) {
      error = e;
    }
    callback(error, result);
  });
};

function envelope (operation, message, options) {
  var xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:env="http://schemas.xmlsoap.org/soap/envelope/" ' + namespaces(options.namespaces) + '>';

  if (options.header) {
    xml += '<env:Header>';
    xml += typeof options.header === 'object' ? XML.stringify(options.header) : options.header.toString();
    xml += '</env:Header>';
  }

  xml += '<env:Body>';
  xml += serializeOperation(operation, options); // '<' + operation + ' xmlns="' + options.namespace + '"' + '>';
  xml += typeof message === 'object' ? XML.stringify(message) : message.toString();
  xml += '</' + operation + '>';
  xml += '</env:Body>';
  xml += '</env:Envelope>';

  return xml;
}

function headers (schema, length) {
  return {
    Soapaction: schema,
    'Content-Type': 'text/xml;charset=UTF-8',
    'Content-Length': length,
    'Accept-Encoding': 'gzip',
    Accept: '*/*'
  }
}

function namespaces (ns) {
  var attributes = '';
  for (var name in ns) {
    attributes += name + '="' + ns[name] + '" ';
  }
  return attributes.trim();
}

function serializeOperation (operation, options) {
  return '<' + operation + (options.namespace ? ' xmlns="' + options.namespace + '"' : '') + '>';
}

function gunzip (callback) {
  var gunzip = zlib.createGunzip();
  gunzip.on('error', callback);
  return gunzip;
}

function isGzipped(response) {
  return /gzip/.test(response.headers['content-encoding']);
}
