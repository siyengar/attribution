// Some notes I found that were not in the spec:
// Custom ports are not supported, they always make the conversion request to 443 which is interesting.
// They use a new connection for each request.
// Open Questions:
// what happens with altsvc

const http2 = require('http2');
const httpsPort = 443
fs = require("fs");

landingUrl = 'https://shop.example/shop'

const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_CONTENT_TYPE
} = http2.constants;

function handleRequest(stream, headers, altsvcport) {
  const method = headers[HTTP2_HEADER_METHOD];
  const path = headers[HTTP2_HEADER_PATH];
  console.log('request on port=' + stream.session.socket.localPort);
  if (altsvcport != '') {
    altsvc_header = 'h2=":' + altsvcport + '"';
    console.log('sending altsvc header');
    stream.session.altsvc(altsvc_header, stream.id);
  }
  if (path == '/') {
    console.log('rendered ad link');
    stream.respond({
      'content-type': 'text/html',
      ':status': 200
    });
    stream.end("<a href='" + landingUrl + "' addestination='" + landingUrl + "' adcampaignid='55'>ad click</a>");
  } else if (path.startsWith('/.well')) {
    console.log('hey got the conversion ' + path);
    console.log('referer ' + headers['referer'])
    stream.end();
  } else if (path.startsWith('/tracking')) {
    console.log('returned conversion url');
    stream.respond({
      'content-type': 'text/html',
      ':status': 302,
      'Location': '/.well-known/ad-click-attribution/20'
    });
    stream.end();
  } else if (path.startsWith('/shop')) {
    console.log('Shop rendered tracking url');
    stream.respond({
      'content-type': 'text/html',
      ':status': 200
    });
    stream.end("Tracking pixel <img src='https://search.example/tracking' />");
  } else {
    console.log('no match for ' + path);
  }
}

function setupServer(port, altsvcport) {
  const server = http2.createSecureServer({
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('certificate.pem'),
    allowHTTP1: false
  });

  server.on('stream', (stream, headers) => {
    handleRequest(stream, headers, altsvcport);
  });

  server.on('session', (session) => {
    console.log('new connection localport=' + session.socket.localPort + ' port=' + session.socket.remotePort);
    if (altsvcport != '') {
      console.log('sending altsvc frame');
      session.altsvc('h2=":' + altsvcport + '"', 'https://search.example:' + port);
    }
  });

  server.on('close', () => {
    console.log('connection closed');
  });

  server.listen(port, (err) => {
    if (err) {
      return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
  })
}

// looks like safari does not support altsvc.
setupServer(httpsPort, '');
setupServer(8443, '');
