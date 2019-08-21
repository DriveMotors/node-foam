const axios = require('axios');
const XML = require('simple-xml');

module.exports = (uri, operation, action, message, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const xml = envelope(operation, message, options);

  const config = {
    headers: headers(action, xml.length),
    timeout: options.timeout
  };

  axios.post(uri, xml, config)
    .then(response => {
      try {
        const json = parseResponse(response.data);
        callback(null, json);
      } catch (err) {
        callback(err);
      }
    })
    .catch(err => {
      err = handleError(err);
      callback(err, null);
    });

  return xml;
};

const envelope = (operation, message, options) => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
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
};

const headers = (schema, length) => {
  return {
    Soapaction: schema,
    'Content-Type': 'text/xml;charset=UTF-8',
    'Content-Length': length,
    'Accept-Encoding': 'gzip',
    Accept: '*/*'
  };
};

const namespaces = ns => {
  let attributes = '';
  for (const name in ns) {
    attributes += name + '="' + ns[name] + '" ';
  }
  return attributes.trim();
};

const serializeOperation = (operation, options) => {
  return '<' + operation + (options.namespace ? ' xmlns="' + options.namespace + '"' : '') + '>';
};

const parseResponse = response => {
  const xml = XML.parse(response);

  if (xml.Envelope) {
    return xml.Envelope.Body;
  }
  throw new Error('Missing envelope: ' + response);
};

const handleError = err => {
  if (!err.config) {
    return err;
  }

  if (err.response) {
    // The request was made and the server responded with a status code that falls out of the range of 2xx
    return new Error(`${err.response.status} ${err.response.statusText}`);
  }
  // The request was made but no response was received
  // OR
  // Something happened in setting up the request that triggered an Error
  return err;
};
